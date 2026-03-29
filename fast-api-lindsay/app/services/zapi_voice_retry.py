from __future__ import annotations

import logging
import re
import threading
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, Optional
from zoneinfo import ZoneInfo

import couchdb
import requests

from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger("zapi_voice_retry")
BR_TZ = ZoneInfo(settings.TIMEZONE)
VOICE_TABLE = "zapi_voice_retry"
ANSWERED_EVENTS = {"CALL_VOICE"}
MISSED_EVENTS = {"CALL_MISSED_VOICE"}
MESSAGE_STATUS_CALLBACK_TYPES = {"MESSAGESTATUSCALLBACK"}
CHAT_PRESENCE_CALLBACK_TYPES = {"PRESENCECHATCALLBACK"}
RECEIVED_CALLBACK_TYPES = {"RECEIVEDCALLBACK"}
DELIVERY_CALLBACK_TYPES = {"DELIVERYCALLBACK"}
MESSAGE_STOP_STATUSES = {"READ"}
MESSAGE_LOG_STATUSES = {"SENT", "RECEIVED", "READ", "READ_BY_ME", "PLAYED"}
PRESENCE_STOP_STATUSES = {"AVAILABLE"}
ACTIVE_STATUSES = {"waiting_webhook", "retry_scheduled"}
FINAL_STATUSES = {"answered", "acknowledged", "cancelled", "failed", "max_attempts_reached"}
RETRY_DELAYS = [5.0, 10.0, 20.0, 30.0]
DEFAULT_CONFIRMATION_OPTION_ID = "ACK_OK_RECEBI"
DEFAULT_CONFIRMATION_TEXT = "OK, recebi"
_RETRY_THREADS: dict[str, threading.Thread] = {}
_WAIT_THREADS: dict[str, threading.Thread] = {}
_RETRY_LOCK = threading.Lock()
_WAIT_LOCK = threading.Lock()
_RECONCILER_THREAD: Optional[threading.Thread] = None
_RECONCILER_LOCK = threading.Lock()


def _now() -> datetime:
    return datetime.now(BR_TZ)


def _now_iso() -> str:
    return _now().isoformat()


def normalize_phone(phone: Optional[str]) -> str:
    return re.sub(r"\D", "", phone or "")


def _normalize_token(value: Optional[Any]) -> str:
    return re.sub(r"[^A-Z0-9_]+", "", str(value or "").upper())


def _find_first(payload: Any, key_names: Iterable[str]) -> Optional[Any]:
    key_names = set(key_names)

    def walk(value: Any) -> Optional[Any]:
        if isinstance(value, dict):
            for key, item in value.items():
                if key in key_names and item not in (None, ""):
                    return item
            for item in value.values():
                found = walk(item)
                if found not in (None, ""):
                    return found
        elif isinstance(value, list):
            for item in value:
                found = walk(item)
                if found not in (None, ""):
                    return found
        return None

    return walk(payload)


def _extract_event(payload: Dict[str, Any]) -> Dict[str, Any]:
    notification = _find_first(payload, {"notification", "event"})
    callback_type = _find_first(payload, {"type"})
    status_value = _find_first(payload, {"status"})
    phone = _find_first(payload, {"phone"})
    call_id = _find_first(payload, {"callId"})
    message_id = _find_first(payload, {"messageId", "message_id", "id"})
    message_ids = _find_first(payload, {"ids"})
    zaap_id = _find_first(payload, {"zaapId", "zaap_id"})
    reference_message_id = _find_first(payload, {"referenceMessageId"})
    from_me_raw = _find_first(payload, {"fromMe"})
    selected_row_id = _find_first(payload, {"selectedRowId"})
    button_id = _find_first(payload, {"buttonId"})
    list_response = payload.get("listResponseMessage") if isinstance(payload, dict) else None
    buttons_response = payload.get("buttonsResponseMessage") if isinstance(payload, dict) else None
    text_payload = payload.get("text") if isinstance(payload, dict) else None
    selected_title = None
    if isinstance(list_response, dict):
        selected_title = list_response.get("title")
    if not selected_title and isinstance(buttons_response, dict):
        selected_title = buttons_response.get("selectedDisplayText") or buttons_response.get("title")
    text_message = None
    if isinstance(text_payload, dict):
        text_message = text_payload.get("message")
    if not text_message and isinstance(list_response, dict):
        text_message = list_response.get("message")
    if not text_message and isinstance(buttons_response, dict):
        text_message = buttons_response.get("message")
    normalized_ids = []
    if isinstance(message_ids, list):
        normalized_ids.extend(str(item).strip() for item in message_ids if item not in (None, ""))
    elif message_ids not in (None, ""):
        normalized_ids.append(str(message_ids).strip())
    if message_id and message_id not in normalized_ids:
        normalized_ids.append(message_id)
    return {
        "notification": str(notification or "").strip(),
        "notification_norm": _normalize_token(notification),
        "callback_type": str(callback_type or "").strip(),
        "callback_type_norm": _normalize_token(callback_type),
        "status_value": str(status_value or "").strip(),
        "status_norm": _normalize_token(status_value),
        "phone": str(phone or "").strip(),
        "phone_clean": normalize_phone(phone),
        "call_id": str(call_id or "").strip() or None,
        "message_id": str(message_id or "").strip() or None,
        "message_ids": normalized_ids,
        "zaap_id": str(zaap_id or "").strip() or None,
        "reference_message_id": str(reference_message_id or "").strip() or None,
        "from_me": bool(from_me_raw) if isinstance(from_me_raw, bool) else str(from_me_raw).strip().lower() == "true",
        "text_message": str(text_message or "").strip() or None,
        "selected_row_id": str(selected_row_id or "").strip() or None,
        "button_id": str(button_id or "").strip() or None,
        "selected_title": str(selected_title or "").strip() or None,
    }


def _notification_enabled(db: couchdb.Database) -> bool:
    try:
        result = db.find({"selector": {"table": "notificacao"}, "limit": 1})
        doc = next(result, None)
        return bool(doc and doc.get("status"))
    except Exception as exc:
        logger.warning("Falha ao verificar notificação global: %s", exc)
        return False


def _whatsapp_call_enabled(db: couchdb.Database, irrigador_id: str) -> bool:
    try:
        config_doc = db.get(f"whatsapp_config:{irrigador_id}")
        if config_doc is None:
            return False
        return bool(config_doc.get("whatsapp_call_enabled", False))
    except Exception as exc:
        logger.warning("Falha ao verificar whatsapp_call_enabled para %s: %s", irrigador_id, exc)
        return False


def _sort_key(doc: Dict[str, Any]) -> str:
    return str(doc.get("updated_at") or doc.get("created_at") or "")


def _pick_tracking_doc(results: list[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not results:
        return None
    results.sort(key=_sort_key, reverse=True)
    for doc in results:
        if doc.get("status") in ACTIVE_STATUSES:
            return doc
    return results[0]


def _find_tracking_doc(
    db: couchdb.Database,
    event: Dict[str, Any],
) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    selectors: list[tuple[Dict[str, Any], str]] = []
    if event.get("reference_message_id"):
        selectors.append(({"table": VOICE_TABLE, "last_text_message_id": event["reference_message_id"]}, "text_reference_message_id"))
        selectors.append(({"table": VOICE_TABLE, "last_message_id": event["reference_message_id"]}, "call_reference_message_id"))
    for message_id in event.get("message_ids", []):
        selectors.append(({"table": VOICE_TABLE, "last_message_id": message_id}, "call_message_id"))
        selectors.append(({"table": VOICE_TABLE, "last_text_message_id": message_id}, "text_message_id"))
    if event.get("zaap_id"):
        selectors.append(({"table": VOICE_TABLE, "last_zaap_id": event["zaap_id"]}, "call_zaap_id"))
        selectors.append(({"table": VOICE_TABLE, "last_text_zaap_id": event["zaap_id"]}, "text_zaap_id"))
    if event.get("call_id"):
        selectors.append(({"table": VOICE_TABLE, "call_id": event["call_id"]}, "call_id"))
    if event.get("phone_clean"):
        selectors.append(({"table": VOICE_TABLE, "phone_clean": event["phone_clean"]}, "phone"))

    for selector, match_type in selectors:
        try:
            result = list(db.find({"selector": selector, "limit": 10}))
        except Exception as exc:
            logger.warning("Falha ao buscar tracking doc %s: %s", selector, exc)
            continue

        doc = _pick_tracking_doc(result)
        if doc:
            return doc, match_type

    return None, None


def _append_history(doc: Dict[str, Any], entry: Dict[str, Any]) -> None:
    doc.setdefault("history", []).append(entry)


def _save_doc(db: couchdb.Database, doc: Dict[str, Any]) -> Dict[str, Any]:
    db.save(doc)
    return doc


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=BR_TZ)
    return parsed.astimezone(BR_TZ)


def _waiting_webhook_timeout_seconds(doc: Dict[str, Any]) -> float:
    base_timeout = max(5, int(getattr(settings, "ZAPI_WEBHOOK_WAIT_TIMEOUT_SECONDS", 45)))
    try:
        call_duration = int(doc.get("call_duration") or 0)
    except (TypeError, ValueError):
        call_duration = 0
    return float(max(base_timeout, call_duration + 15 if call_duration > 0 else base_timeout))


def _tracking_reference_time(doc: Dict[str, Any]) -> datetime:
    return (
        _parse_iso_datetime(doc.get("last_attempt_at"))
        or _parse_iso_datetime(doc.get("updated_at"))
        or _parse_iso_datetime(doc.get("created_at"))
        or _now()
    )


def _tracking_is_stale(doc: Dict[str, Any]) -> bool:
    max_age = max(60, int(getattr(settings, "ZAPI_RETRY_TRACKING_MAX_AGE_SECONDS", 300)))
    age_seconds = (_now() - _tracking_reference_time(doc)).total_seconds()
    return age_seconds > max_age


def _cancel_stale_tracking_doc(db: couchdb.Database, doc: Dict[str, Any], reason: str) -> None:
    doc["status"] = "cancelled"
    doc["cancel_reason"] = reason
    doc["updated_at"] = _now_iso()
    _append_history(
        doc,
        {
            "timestamp": _now_iso(),
            "event": "cancelled",
            "reason": reason,
        },
    )
    _save_doc(db, doc)


def _call_zapi(phone_clean: str, call_duration: Optional[int], max_attempts: int) -> Dict[str, Any]:
    if not settings.ZAPI_INSTANCE or not settings.ZAPI_TOKEN or not settings.ZAPI_CLIENT_TOKEN:
        return {"success": False, "error": "Z-API não configurado"}

    url = f"{settings.ZAPI_BASE_URL}/instances/{settings.ZAPI_INSTANCE}/token/{settings.ZAPI_TOKEN}/send-call"
    headers = {"Client-Token": settings.ZAPI_CLIENT_TOKEN, "Content-Type": "application/json"}
    payload: Dict[str, Any] = {"phone": phone_clean}
    if call_duration is not None:
        payload["callDuration"] = call_duration

    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if 200 <= response.status_code < 300:
                data = response.json() if response.content else {}
                return {
                    "success": True,
                    "attempt": attempt,
                    "message_id": data.get("messageId") or data.get("id"),
                    "zaap_id": data.get("zaapId"),
                }

            retryable = response.status_code in {408, 409, 429} or response.status_code >= 500
            if retryable and attempt < max_attempts:
                time.sleep(RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)])
                continue
            return {"success": False, "attempt": attempt, "error": f"HTTP {response.status_code}: {response.text}"}
        except requests.RequestException as exc:
            if attempt < max_attempts:
                time.sleep(RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)])
                continue
            return {"success": False, "attempt": attempt, "error": str(exc)}

    return {"success": False, "attempt": max_attempts, "error": "Falha desconhecida na ligação Z-API"}


def _retry_worker(doc_id: str, delay_seconds: float) -> None:
    try:
        if delay_seconds > 0:
            time.sleep(delay_seconds)

        db = get_db()
        doc = db.get(doc_id)
        if not doc:
            return
        if doc.get("status") != "retry_scheduled":
            return

        irrigador_id = doc.get("irrigadorId", "")
        if not _notification_enabled(db):
            doc["status"] = "cancelled"
            doc["cancel_reason"] = "notify_disabled"
            doc["updated_at"] = _now_iso()
            _append_history(doc, {"timestamp": _now_iso(), "event": "cancelled", "reason": "notify_disabled"})
            _save_doc(db, doc)
            return

        if not _whatsapp_call_enabled(db, irrigador_id):
            doc["status"] = "cancelled"
            doc["cancel_reason"] = "whatsapp_call_disabled"
            doc["updated_at"] = _now_iso()
            _append_history(doc, {"timestamp": _now_iso(), "event": "cancelled", "reason": "whatsapp_call_disabled"})
            _save_doc(db, doc)
            return

        attempts_made = int(doc.get("attempts_made", 1))
        max_attempts = int(doc.get("max_attempts", settings.VOICE_ZAPI_MAX_ATTEMPTS))
        next_attempt = attempts_made + 1
        if next_attempt > max_attempts:
            doc["status"] = "max_attempts_reached"
            doc["updated_at"] = _now_iso()
            _append_history(doc, {"timestamp": _now_iso(), "event": "max_attempts_reached", "attempt": attempts_made})
            _save_doc(db, doc)
            return

        result = _call_zapi(doc.get("phone_clean", ""), doc.get("call_duration"), max_attempts)
        doc["updated_at"] = _now_iso()
        doc["next_retry_at"] = None

        if result["success"]:
            doc["status"] = "waiting_webhook"
            doc["attempts_made"] = next_attempt
            doc["last_attempt_at"] = _now_iso()
            doc["last_message_id"] = result.get("message_id")
            doc["last_zaap_id"] = result.get("zaap_id")
            _append_history(
                doc,
                {
                    "timestamp": _now_iso(),
                    "event": "retry_started",
                    "attempt": next_attempt,
                    "message_id": result.get("message_id"),
                    "zaap_id": result.get("zaap_id"),
                },
            )
        else:
            doc["status"] = "failed"
            doc["last_error"] = result.get("error")
            _append_history(
                doc,
                {
                    "timestamp": _now_iso(),
                    "event": "retry_failed",
                    "attempt": next_attempt,
                    "error": result.get("error"),
                },
            )

        _save_doc(db, doc)
    except Exception as exc:
        logger.exception("Erro no retry worker de ligação Z-API para %s: %s", doc_id, exc)
    finally:
        with _RETRY_LOCK:
            _RETRY_THREADS.pop(doc_id, None)


def _waiting_webhook_worker(doc_id: str, delay_seconds: float) -> None:
    try:
        if delay_seconds > 0:
            time.sleep(delay_seconds)

        db = get_db()
        doc = db.get(doc_id)
        if not doc or doc.get("status") != "waiting_webhook":
            return

        now_iso = _now_iso()
        doc["updated_at"] = now_iso
        _append_history(
            doc,
            {
                "timestamp": now_iso,
                "event": "webhook_timeout",
                "attempt": int(doc.get("attempts_made", 1)),
                "timeout_seconds": _waiting_webhook_timeout_seconds(doc),
            },
        )

        delay = _schedule_retry(doc, "webhook_timeout")
        if delay <= 0:
            _save_doc(db, doc)
    except Exception as exc:
        logger.exception("Erro no timeout de waiting_webhook para %s: %s", doc_id, exc)
    finally:
        with _WAIT_LOCK:
            _WAIT_THREADS.pop(doc_id, None)


def _ensure_waiting_webhook_timeout(doc: Dict[str, Any]) -> float:
    if not doc.get("_id") or doc.get("status") != "waiting_webhook":
        return 0.0

    timeout_seconds = _waiting_webhook_timeout_seconds(doc)
    reference = _tracking_reference_time(doc)
    remaining = max(0.0, timeout_seconds - max(0.0, (_now() - reference).total_seconds()))

    with _WAIT_LOCK:
        existing = _WAIT_THREADS.get(doc["_id"])
        if existing and existing.is_alive():
            return remaining

        thread = threading.Thread(
            target=_waiting_webhook_worker,
            args=(doc["_id"], remaining),
            daemon=True,
            name=f"voice-wait-{doc['_id'][-12:]}",
        )
        _WAIT_THREADS[doc["_id"]] = thread
        thread.start()

    return remaining


def _schedule_retry(doc: Dict[str, Any], reason: str) -> float:
    attempts_made = int(doc.get("attempts_made", 1))
    max_attempts = int(doc.get("max_attempts", settings.VOICE_ZAPI_MAX_ATTEMPTS))
    if attempts_made >= max_attempts:
        doc["status"] = "max_attempts_reached"
        doc["updated_at"] = _now_iso()
        return 0.0

    delay = RETRY_DELAYS[min(attempts_made - 1, len(RETRY_DELAYS) - 1)]
    doc["status"] = "retry_scheduled"
    doc["updated_at"] = _now_iso()
    doc["next_retry_at"] = (_now() + timedelta(seconds=delay)).isoformat()
    _append_history(
        doc,
        {
            "timestamp": _now_iso(),
            "event": "retry_scheduled",
            "attempt": attempts_made + 1,
            "delay_seconds": delay,
            "reason": reason,
        },
    )

    db = get_db()
    _save_doc(db, doc)

    with _RETRY_LOCK:
        existing = _RETRY_THREADS.get(doc["_id"])
        if existing and existing.is_alive():
            return delay

        thread = threading.Thread(
            target=_retry_worker,
            args=(doc["_id"], delay),
            daemon=True,
            name=f"voice-retry-{doc['_id'][-12:]}",
        )
        _RETRY_THREADS[doc["_id"]] = thread
        thread.start()

    return delay


def _doc_confirmation_option_id(doc: Dict[str, Any]) -> str:
    return _normalize_token(doc.get("confirmation_option_id") or DEFAULT_CONFIRMATION_OPTION_ID)


def _doc_confirmation_text(doc: Dict[str, Any]) -> str:
    return _normalize_token(doc.get("confirmation_text") or DEFAULT_CONFIRMATION_TEXT)


def _matches_confirmation_signal(doc: Dict[str, Any], event: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    option_id = _doc_confirmation_option_id(doc)
    confirmation_text = _doc_confirmation_text(doc)
    selected_row_id = _normalize_token(event.get("selected_row_id"))
    button_id = _normalize_token(event.get("button_id"))
    selected_title = _normalize_token(event.get("selected_title"))
    text_message = _normalize_token(event.get("text_message"))

    if selected_row_id and selected_row_id == option_id:
        return True, "list_option_selected"
    if button_id and button_id == option_id:
        return True, "button_selected"
    if selected_title and selected_title == confirmation_text:
        return True, "selected_title_matched"
    if text_message and text_message in {confirmation_text, "OK", "RECEBI"}:
        return True, "typed_confirmation_text"

    return False, None


def _is_message_status_event(event: Dict[str, Any]) -> bool:
    return event.get("callback_type_norm") in MESSAGE_STATUS_CALLBACK_TYPES


def _is_chat_presence_event(event: Dict[str, Any]) -> bool:
    return event.get("callback_type_norm") in CHAT_PRESENCE_CALLBACK_TYPES


def _is_received_callback_event(event: Dict[str, Any]) -> bool:
    return event.get("callback_type_norm") in RECEIVED_CALLBACK_TYPES


def _is_delivery_callback_event(event: Dict[str, Any]) -> bool:
    return event.get("callback_type_norm") in DELIVERY_CALLBACK_TYPES


def _mark_doc_finished(
    db: couchdb.Database,
    doc: Dict[str, Any],
    *,
    status: str,
    reason: str,
    event: Dict[str, Any],
    match_type: Optional[str],
) -> Dict[str, Any]:
    now_iso = _now_iso()
    doc["status"] = status
    doc["updated_at"] = now_iso
    doc["completion_reason"] = reason
    if status == "answered":
        doc["answered_at"] = now_iso
    else:
        doc["acknowledged_at"] = now_iso
    _append_history(
        doc,
        {
            "timestamp": now_iso,
            "event": "completion_signal",
            "reason": reason,
            "match_type": match_type,
            "notification": event.get("notification"),
            "callback_type": event.get("callback_type"),
            "status_value": event.get("status_value"),
            "message_ids": event.get("message_ids"),
            "phone": event.get("phone"),
            "call_id": event.get("call_id"),
        },
    )
    _save_doc(db, doc)
    return {"handled": True, "action": reason, "doc_id": doc["_id"], "status": doc.get("status")}


def _process_call_webhook(db: couchdb.Database, event: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    doc, match_type = _find_tracking_doc(db, event)
    if not doc:
        logger.warning("Webhook de chamada sem tracking correspondente: %s", payload)
        return {"handled": False, "reason": "tracking_not_found", "notification": event.get("notification")}

    doc["updated_at"] = _now_iso()
    if event.get("call_id"):
        doc["call_id"] = event["call_id"]
    if event.get("message_id"):
        doc["last_message_id"] = event["message_id"]
    if event.get("zaap_id"):
        doc["last_zaap_id"] = event["zaap_id"]

    _append_history(
        doc,
        {
            "timestamp": _now_iso(),
            "event": "webhook_received",
            "notification": event.get("notification"),
            "call_id": event.get("call_id"),
            "message_id": event.get("message_id"),
            "zaap_id": event.get("zaap_id"),
            "match_type": match_type,
        },
    )

    if doc.get("status") in FINAL_STATUSES:
        _save_doc(db, doc)
        return {"handled": True, "action": "final_status_ignored", "doc_id": doc["_id"], "status": doc.get("status")}

    if event.get("notification_norm") in ANSWERED_EVENTS:
        return _mark_doc_finished(
            db,
            doc,
            status="answered",
            reason="call_answered",
            event=event,
            match_type=match_type,
        )

    if doc.get("status") == "retry_scheduled":
        _save_doc(db, doc)
        return {"handled": True, "action": "already_scheduled", "doc_id": doc["_id"]}

    delay = _schedule_retry(doc, event.get("notification") or "call_missed")
    if delay <= 0:
        _save_doc(db, doc)
        return {"handled": True, "action": "max_attempts_reached", "doc_id": doc["_id"]}
    return {"handled": True, "action": "retry_scheduled", "delay_seconds": delay, "doc_id": doc["_id"]}


def _process_message_status_webhook(db: couchdb.Database, event: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    logger.info(
        "Webhook Z-API message-status: status=%s ids=%s phone=%s",
        event.get("status_value") or "<vazio>",
        event.get("message_ids") or [],
        event.get("phone") or "<vazio>",
    )

    doc, match_type = _find_tracking_doc(db, event)
    if not doc:
        logger.info("Message-status sem tracking de voz correspondente: %s", payload)
        return {
            "handled": True,
            "action": "message_status_logged_without_tracking",
            "status": event.get("status_value"),
        }

    doc["updated_at"] = _now_iso()
    doc["last_message_status"] = event.get("status_value")
    _append_history(
        doc,
        {
            "timestamp": _now_iso(),
            "event": "message_status_received",
            "status": event.get("status_value"),
            "message_ids": event.get("message_ids"),
            "match_type": match_type,
        },
    )

    if doc.get("status") in FINAL_STATUSES:
        _save_doc(db, doc)
        return {"handled": True, "action": "final_status_ignored", "doc_id": doc["_id"], "status": doc.get("status")}

    if event.get("status_norm") in MESSAGE_STOP_STATUSES and match_type in {"call_message_id", "call_zaap_id", "call_reference_message_id"}:
        return _mark_doc_finished(
            db,
            doc,
            status="acknowledged",
            reason="call_message_read",
            event=event,
            match_type=match_type,
        )

    if match_type in {"text_message_id", "text_zaap_id", "text_reference_message_id"} and event.get("status_norm") == "READ":
        doc["text_message_read_at"] = _now_iso()
        _save_doc(db, doc)
        return {"handled": True, "action": "text_message_read_logged", "doc_id": doc["_id"]}

    _save_doc(db, doc)
    return {"handled": True, "action": "message_status_logged", "doc_id": doc["_id"]}


def _process_chat_presence_webhook(db: couchdb.Database, event: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    logger.info(
        "Webhook Z-API chat-presence: status=%s phone=%s",
        event.get("status_value") or "<vazio>",
        event.get("phone") or "<vazio>",
    )

    doc, match_type = _find_tracking_doc(db, event)
    if not doc:
        logger.info("Chat-presence sem tracking de voz correspondente: %s", payload)
        return {
            "handled": True,
            "action": "chat_presence_logged_without_tracking",
            "status": event.get("status_value"),
        }

    doc["updated_at"] = _now_iso()
    doc["last_chat_presence"] = event.get("status_value")
    _append_history(
        doc,
        {
            "timestamp": _now_iso(),
            "event": "chat_presence_received",
            "status": event.get("status_value"),
            "match_type": match_type,
        },
    )

    if doc.get("status") in FINAL_STATUSES:
        _save_doc(db, doc)
        return {"handled": True, "action": "final_status_ignored", "doc_id": doc["_id"], "status": doc.get("status")}

    if event.get("status_norm") in PRESENCE_STOP_STATUSES:
        return _mark_doc_finished(
            db,
            doc,
            status="acknowledged",
            reason="chat_available",
            event=event,
            match_type=match_type,
        )

    _save_doc(db, doc)
    return {"handled": True, "action": "chat_presence_logged", "doc_id": doc["_id"]}


def _process_delivery_callback(db: couchdb.Database, event: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    logger.info(
        "Webhook Z-API delivery-callback: message_id=%s zaap_id=%s phone=%s",
        event.get("message_id") or "<vazio>",
        event.get("zaap_id") or "<vazio>",
        event.get("phone") or "<vazio>",
    )
    doc, match_type = _find_tracking_doc(db, event)
    if not doc:
        logger.info("Delivery-callback sem tracking correspondente: %s", payload)
        return {"handled": True, "action": "delivery_logged_without_tracking"}

    doc["updated_at"] = _now_iso()
    _append_history(
        doc,
        {
            "timestamp": _now_iso(),
            "event": "delivery_callback_received",
            "message_id": event.get("message_id"),
            "zaap_id": event.get("zaap_id"),
            "match_type": match_type,
        },
    )
    _save_doc(db, doc)
    return {"handled": True, "action": "delivery_logged", "doc_id": doc["_id"]}


def _process_received_callback(db: couchdb.Database, event: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    logger.info(
        "Webhook Z-API received-callback: from_me=%s status=%s phone=%s message_ids=%s reference_message_id=%s text=%s selected_row_id=%s",
        event.get("from_me"),
        event.get("status_value") or "<vazio>",
        event.get("phone") or "<vazio>",
        event.get("message_ids") or [],
        event.get("reference_message_id") or "<vazio>",
        event.get("text_message") or "<vazio>",
        event.get("selected_row_id") or "<vazio>",
    )

    doc, match_type = _find_tracking_doc(db, event)
    if not doc:
        logger.info("Received-callback sem tracking correspondente: %s", payload)
        return {"handled": True, "action": "received_callback_without_tracking"}

    doc["updated_at"] = _now_iso()
    _append_history(
        doc,
        {
            "timestamp": _now_iso(),
            "event": "received_callback",
            "from_me": event.get("from_me"),
            "status": event.get("status_value"),
            "message_ids": event.get("message_ids"),
            "reference_message_id": event.get("reference_message_id"),
            "text_message": event.get("text_message"),
            "selected_row_id": event.get("selected_row_id"),
            "selected_title": event.get("selected_title"),
            "match_type": match_type,
        },
    )

    if doc.get("status") in FINAL_STATUSES:
        _save_doc(db, doc)
        return {"handled": True, "action": "final_status_ignored", "doc_id": doc["_id"], "status": doc.get("status")}

    if event.get("from_me"):
        doc["last_message_status"] = event.get("status_value")
        if event.get("status_norm") in MESSAGE_STOP_STATUSES and match_type in {"call_message_id", "call_zaap_id", "call_reference_message_id"}:
            return _mark_doc_finished(
                db,
                doc,
                status="acknowledged",
                reason="call_message_read",
                event=event,
                match_type=match_type,
            )
        if event.get("status_norm") == "READ" and match_type in {"text_message_id", "text_zaap_id", "text_reference_message_id"}:
            doc["text_message_read_at"] = _now_iso()
            _save_doc(db, doc)
            return {"handled": True, "action": "text_message_read_logged", "doc_id": doc["_id"]}
        _save_doc(db, doc)
        return {"handled": True, "action": "outbound_received_callback_logged", "doc_id": doc["_id"]}

    matched, source = _matches_confirmation_signal(doc, event)
    if matched:
        return _mark_doc_finished(
            db,
            doc,
            status="acknowledged",
            reason=f"message_confirmation_{source}",
            event=event,
            match_type=match_type,
        )

    doc["last_inbound_message_at"] = _now_iso()
    _save_doc(db, doc)
    return {"handled": True, "action": "inbound_message_logged", "doc_id": doc["_id"]}


def process_zapi_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    event = _extract_event(payload)
    logger.info(
        "Webhook Z-API recebido: notification=%s callback_type=%s status=%s phone=%s message_ids=%s zaap_id=%s call_id=%s reference_message_id=%s from_me=%s",
        event.get("notification") or "<vazio>",
        event.get("callback_type") or "<vazio>",
        event.get("status_value") or "<vazio>",
        event.get("phone") or "<vazio>",
        event.get("message_ids") or [],
        event.get("zaap_id") or "<vazio>",
        event.get("call_id") or "<vazio>",
        event.get("reference_message_id") or "<vazio>",
        event.get("from_me"),
    )

    db = get_db()

    if _is_delivery_callback_event(event):
        return _process_delivery_callback(db, event, payload)

    if _is_received_callback_event(event):
        return _process_received_callback(db, event, payload)

    if _is_message_status_event(event):
        return _process_message_status_webhook(db, event, payload)

    if _is_chat_presence_event(event):
        return _process_chat_presence_webhook(db, event, payload)

    if not event.get("notification"):
        logger.warning("Webhook Z-API sem notification reconhecivel: %s", payload)
        return {"handled": False, "reason": "notification_missing"}

    if event.get("notification_norm") not in ANSWERED_EVENTS | MISSED_EVENTS:
        logger.info("Webhook Z-API ignorado: notification=%s payload=%s", event.get("notification"), payload)
        return {"handled": False, "reason": "notification_ignored", "notification": event.get("notification")}

    return _process_call_webhook(db, event, payload)


def resume_scheduled_voice_retries() -> int:
    try:
        db = get_db()
        retry_docs = list(db.find({"selector": {"table": VOICE_TABLE, "status": "retry_scheduled"}, "limit": 100}))
        waiting_docs = list(db.find({"selector": {"table": VOICE_TABLE, "status": "waiting_webhook"}, "limit": 100}))
    except Exception as exc:
        logger.warning("Falha ao consultar retries agendados de voz: %s", exc)
        return 0

    resumed = 0
    now = _now()
    for doc in retry_docs:
        if _tracking_is_stale(doc):
            _cancel_stale_tracking_doc(db, doc, "stale_retry_tracking")
            continue
        next_retry_at = doc.get("next_retry_at")
        delay = 0.0
        if next_retry_at:
            try:
                retry_at = datetime.fromisoformat(next_retry_at)
                delay = max(0.0, (retry_at - now).total_seconds())
            except ValueError:
                delay = 0.0
        with _RETRY_LOCK:
            existing = _RETRY_THREADS.get(doc["_id"])
            if existing and existing.is_alive():
                continue
            thread = threading.Thread(
                target=_retry_worker,
                args=(doc["_id"], delay),
                daemon=True,
                name=f"voice-retry-{doc['_id'][-12:]}",
            )
            _RETRY_THREADS[doc["_id"]] = thread
            thread.start()
            resumed += 1
    for doc in waiting_docs:
        if _tracking_is_stale(doc):
            _cancel_stale_tracking_doc(db, doc, "stale_waiting_webhook")
            continue
        if _ensure_waiting_webhook_timeout(doc) >= 0:
            resumed += 1
    return resumed


def _voice_retry_reconciler_worker(interval_seconds: float) -> None:
    while True:
        try:
            resume_scheduled_voice_retries()
        except Exception as exc:
            logger.exception("Erro no reconciliador de voice retry: %s", exc)
        time.sleep(interval_seconds)


def start_voice_retry_reconciler() -> bool:
    interval_seconds = max(5.0, float(getattr(settings, "VOICE_RETRY_RECONCILE_SECONDS", 10)))
    with _RECONCILER_LOCK:
        global _RECONCILER_THREAD
        if _RECONCILER_THREAD and _RECONCILER_THREAD.is_alive():
            return False
        _RECONCILER_THREAD = threading.Thread(
            target=_voice_retry_reconciler_worker,
            args=(interval_seconds,),
            daemon=True,
            name="voice-retry-reconciler",
        )
        _RECONCILER_THREAD.start()
        return True


def configure_zapi_webhook_if_enabled() -> bool:
    enabled = str(getattr(settings, "ZAPI_AUTO_CONFIGURE_WEBHOOK", False)).lower() in {"1", "true", "yes", "on"}
    if not enabled:
        return False

    if not settings.ZAPI_INSTANCE or not settings.ZAPI_TOKEN or not settings.ZAPI_CLIENT_TOKEN:
        logger.warning("Z-API webhook auto-config ignorado: credenciais ausentes")
        return False

    webhook_base = getattr(settings, "ZAPI_WEBHOOK_URL", "") or getattr(settings, "API_PUBLIC_BASE_URL", "")
    if not webhook_base:
        logger.warning("Z-API webhook auto-config ignorado: URL pública ausente")
        return False

    webhook_url = webhook_base.rstrip("/")
    if not webhook_url.endswith("/api/webhooks/zapi"):
        webhook_url = webhook_url + "/api/webhooks/zapi"

    headers = {"Client-Token": settings.ZAPI_CLIENT_TOKEN, "Content-Type": "application/json"}
    base = f"{settings.ZAPI_BASE_URL}/instances/{settings.ZAPI_INSTANCE}/token/{settings.ZAPI_TOKEN}"
    payload = {"value": webhook_url, "notifySentByMe": True}

    try:
        requests.put(f"{base}/update-every-webhooks", json=payload, headers=headers, timeout=15)
        requests.put(f"{base}/update-notify-sent-by-me", json={"notifySentByMe": True}, headers=headers, timeout=15)
        logger.info("Webhook da Z-API apontado para %s", webhook_url)
        return True
    except Exception as exc:
        logger.warning("Falha ao configurar webhook da Z-API: %s", exc)
        return False
