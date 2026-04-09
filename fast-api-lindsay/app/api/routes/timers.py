"""
Rotas de Timers (agendamentos de alertas)

Substitui o acesso direto ao CouchDB via useAgendamentos.js + getById/setCurrent/appendHistoryEvent.

Estrutura dos docs no CouchDB:
  - "timer:{alertId}:current"          → estado atual do timer
  - "timer:{alertId}:history:YYYY-MM"  → eventos do mês

O alertId é o _id do documento de alerta (ex: "alert:irrigador:WEGPOC:...").
O backend valida que o irrigador associado ao alerta pertence ao usuário logado.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import couchdb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.api.routes.history import _verify_irrigador_access
from app.core.database import get_db
from app.services.permissions import PermissionChecker

router = APIRouter(prefix="/timers")
BR_TZ = ZoneInfo("America/Sao_Paulo")


# ============================================================================
# Schemas
# ============================================================================


class TimerPatchRequest(BaseModel):
    status: Optional[str] = None
    timer_value: Optional[int] = None
    scheduled_for: Optional[str] = None
    ultimo_agendamento: Optional[str] = None
    responsavel_agendamento: Optional[str] = None
    data_solucao: Optional[str] = None
    responsavel_solucao: Optional[str] = None


class TimerEventRequest(BaseModel):
    type: str                          # "schedule" | "solve"
    at: str                            # ISO datetime
    by: str
    timer_value: Optional[Any] = None
    scheduled_for: Optional[str] = None
    related: Optional[Dict[str, Any]] = None
    note: Optional[str] = None


# ============================================================================
# Helpers
# ============================================================================

MAX_RETRIES = 5


def _current_id(alert_id: str) -> str:
    return f"timer:{alert_id}:current"


def _history_id(alert_id: str, now: datetime) -> str:
    ym = now.strftime("%Y-%m")
    return f"timer:{alert_id}:history:{ym}"


def _get_irrigador_id_from_alert(db: couchdb.Database, alert_id: str) -> Optional[str]:
    """Extrai irrigadorId do doc de alerta para validar permissão."""
    try:
        doc = db[alert_id]
        return doc.get("irrigadorId") or doc.get("irrigador_id")
    except couchdb.ResourceNotFound:
        return None


def _verify_timer_access(alert_id: str, user: dict, checker: PermissionChecker, db: couchdb.Database) -> None:
    """Valida que o usuário tem acesso ao irrigador associado ao alerta.

    Tenta extrair irrigadorId do doc de alerta. Se o doc não existir (alert_id
    é um ID gerado dinamicamente, não um doc persistido), admin/superadmin passam
    livremente; demais roles são verificadas pelo prefixo do alert_id quando possível.
    """
    if not checker.is_active():
        raise HTTPException(status_code=403, detail="Usuário não está ativo")

    # Admin vê tudo
    if checker.is_admin():
        return

    irrigador_id = _get_irrigador_id_from_alert(db, alert_id)
    if irrigador_id:
        _verify_irrigador_access(irrigador_id, user, checker, db)
        return

    # Fallback: tenta extrair irrigadorId do próprio alert_id
    # Formato esperado: "events:irrigador:XXX:..." → irrigador_id = "irrigador:XXX"
    parts = alert_id.split(":")
    if len(parts) >= 3 and parts[1] == "irrigador":
        candidate_id = f"irrigador:{parts[2]}"
        try:
            _verify_irrigador_access(candidate_id, user, checker, db)
            return
        except HTTPException:
            pass

    # Se não conseguiu validar, nega acesso para não-admins
    raise HTTPException(status_code=403, detail="Acesso negado ao timer deste alerta")


def _update_alert_doc(
    db: couchdb.Database,
    alert_id: str,
    patch: Dict[str, Any],
    now_iso: str,
    max_retries: int = 3,
) -> None:
    """Atualiza o doc do alerta com campos de agendamento/solução (se existir)."""
    # Evita sobrescrever campos inexistentes com None
    clean_patch = {k: v for k, v in patch.items() if v is not None}
    if not clean_patch:
        return

    for attempt in range(max_retries):
        try:
            alert_doc = dict(db[alert_id])
        except couchdb.ResourceNotFound:
            return

        alert_doc.update(clean_patch)
        alert_doc["timer_updated_at"] = now_iso

        try:
            db.save(alert_doc)
            return
        except couchdb.ResourceConflict:
            if attempt == max_retries - 1:
                return


def _upsert_with_retry(db: couchdb.Database, build_doc, max_retries: int = MAX_RETRIES) -> dict:
    """Upsert com retry em conflito 409 — equivalente ao upsertWithRetry do frontend."""
    import time
    for attempt in range(max_retries):
        doc = build_doc()
        try:
            db.save(doc)
            return doc
        except couchdb.ResourceConflict:
            if attempt == max_retries - 1:
                raise HTTPException(status_code=409, detail="Conflito ao salvar timer, tente novamente")
            time.sleep(0.05 * (2 ** attempt))
    raise HTTPException(status_code=500, detail="Erro inesperado no upsert")


# ============================================================================
# GET /timers/{alert_id} — lê o estado atual do timer
# ============================================================================


@router.get("/{alert_id:path}")
def get_timer(
    alert_id: str,
    user: dict = Depends(get_current_user),
):
    """Retorna o doc 'timer:{alertId}:current'. Retorna null se não existir."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_timer_access(alert_id, user, checker, db)

    doc_id = _current_id(alert_id)
    try:
        doc = dict(db[doc_id])
        return doc
    except couchdb.ResourceNotFound:
        return None


# ============================================================================
# PUT /timers/{alert_id} — upsert do estado atual
# ============================================================================


@router.put("/{alert_id:path}")
def upsert_timer(
    alert_id: str,
    body: TimerPatchRequest,
    user: dict = Depends(get_current_user),
):
    """Cria ou atualiza o doc 'timer:{alertId}:current'."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_timer_access(alert_id, user, checker, db)

    doc_id = _current_id(alert_id)
    now_iso = datetime.now(BR_TZ).isoformat()

    patch = {k: v for k, v in body.model_dump().items() if v is not None}

    def build():
        try:
            existing = dict(db[doc_id])
        except couchdb.ResourceNotFound:
            existing = {
                "_id": doc_id,
                "id_origem": alert_id,
                "created_at": now_iso,
            }
        return {**existing, **patch, "updated_at": now_iso}

    saved = _upsert_with_retry(db, build)

    # Também grava no doc do alerta (denormalização para consultas rápidas)
    _update_alert_doc(db, alert_id, patch, now_iso)
    return saved


# ============================================================================
# POST /timers/{alert_id}/events — appenda evento ao histórico mensal
# ============================================================================


@router.post("/{alert_id:path}/events")
def append_timer_event(
    alert_id: str,
    body: TimerEventRequest,
    user: dict = Depends(get_current_user),
):
    """Appenda um evento ao doc 'timer:{alertId}:history:YYYY-MM'."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_timer_access(alert_id, user, checker, db)

    now = datetime.now(BR_TZ)
    doc_id = _history_id(alert_id, now)
    now_iso = now.isoformat()

    event = {k: v for k, v in body.model_dump().items() if v is not None}

    MAX_EVENTS = 5000

    def build():
        try:
            existing = dict(db[doc_id])
        except couchdb.ResourceNotFound:
            existing = {
                "_id": doc_id,
                "id_origem": alert_id,
                "events": [],
                "event_count": 0,
                "created_at": now_iso,
            }
        events: list = list(existing.get("events", []))
        events.append(event)
        if len(events) > MAX_EVENTS:
            events = events[-MAX_EVENTS:]
        return {
            **existing,
            "events": events,
            "event_count": existing.get("event_count", 0) + 1,
            "updated_at": now_iso,
        }

    saved = _upsert_with_retry(db, build)
    return {"ok": True, "event_count": saved.get("event_count")}


# ============================================================================
# GET /timers/{alert_id}/history — lê todos os eventos históricos
# ============================================================================


@router.get("/{alert_id:path}/history")
def get_timer_history(
    alert_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Retorna lista normalizada de todos os eventos de timer para o alerta.
    Lê todos os docs 'timer:{alertId}:history:*' via _all_docs com startkey/endkey.
    Fallback para modelo legado (find por id_origem) se não houver docs novos.
    """
    db = get_db()
    checker = PermissionChecker(user)
    _verify_timer_access(alert_id, user, checker, db)

    prefix = f"timer:{alert_id}:history:"
    startkey = prefix
    endkey = prefix + "\ufff0"

    events: List[Dict[str, Any]] = []

    try:
        result = db.view(
            "_all_docs",
            startkey=startkey,
            endkey=endkey,
            include_docs=True,
        )
        for row in result:
            doc = row.doc if hasattr(row, "doc") else row.get("doc", {})
            if not doc:
                continue
            for ev in doc.get("events", []):
                at_iso = ev.get("at", "")
                try:
                    at_iso = datetime.fromisoformat(at_iso).isoformat()
                except Exception:
                    at_iso = at_iso

                events.append({
                    "type": ev.get("type", "schedule"),
                    "at": at_iso,
                    "by": ev.get("by", "—"),
                    "timer_value": ev.get("timer_value"),
                    "scheduled_for": ev.get("scheduled_for"),
                    "related": ev.get("related"),
                })
    except Exception:
        pass

    if not events:
        # Fallback legado: find por id_origem
        try:
            legacy_docs = list(db.find({
                "selector": {"id_origem": {"$eq": alert_id}},
                "limit": 2000,
            }))
            for d in legacy_docs:
                at_base = d.get("updated_at") or d.get("created_at") or d.get("data_solucao")
                try:
                    at_iso = datetime.fromisoformat(at_base).isoformat() if at_base else ""
                except Exception:
                    at_iso = at_base or ""

                if d.get("status") == "solucionado":
                    events.append({
                        "type": "solve",
                        "at": at_iso,
                        "by": d.get("responsavel_solucao", "—"),
                        "timer_value": d.get("timer_value"),
                        "scheduled_for": d.get("scheduled_for"),
                        "related": {
                            "scheduled_for": d.get("scheduled_for"),
                            "timer_value": d.get("timer_value"),
                        },
                    })
                else:
                    events.append({
                        "type": "schedule",
                        "at": at_iso,
                        "by": d.get("responsavel_agendamento", "—"),
                        "timer_value": d.get("timer_value"),
                        "scheduled_for": d.get("scheduled_for"),
                        "related": None,
                    })
        except Exception:
            pass

    events.sort(key=lambda e: e.get("at") or "")
    return {"alert_id": alert_id, "events": events}
