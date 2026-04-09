#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rotas de Histórico — tensão, eventos, SW, alertas e changes feed
"""

import httpx
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

import couchdb

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.schemas import (
    AlertsHistoryResponse,
    ChangesResponse,
    EventItem,
    EventsHistoryResponse,
    SWHistoryResponse,
    SWPoint,
    TensionHistoryResponse,
    TensionPoint,
    TensionDataField,
    MonitorVoltage,
)
from app.services.history import HistoryService
from app.services.permissions import PermissionChecker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history")
BR_TZ = ZoneInfo("America/Sao_Paulo")


# ============================================================================
# Helper de permissão
# ============================================================================


def _verify_irrigador_access(
    irrigador_id: str,
    user: dict,
    checker: PermissionChecker,
    db: couchdb.Database,
) -> None:
    """Verifica se o usuário pode acessar este irrigador. Lança 403/404 se não."""
    if not checker.is_active():
        raise HTTPException(status_code=403, detail="Usuário não está ativo")

    if checker.is_superadmin():
        return  # superadmin vê qualquer irrigador

    try:
        doc = db[irrigador_id]
    except couchdb.ResourceNotFound:
        raise HTTPException(status_code=404, detail="Irrigador não encontrado")

    user_cnpj = user.get("cnpj", "")

    if checker.is_admin():
        if doc.get("cnpj_admin") != user_cnpj:
            raise HTTPException(status_code=403, detail="Acesso negado")
    elif checker.is_revenda():
        if doc.get("cnpj_revenda") != user_cnpj:
            raise HTTPException(status_code=403, detail="Acesso negado")
    elif checker.is_cliente():
        if doc.get("cnpj_cliente") != user_cnpj:
            raise HTTPException(status_code=403, detail="Acesso negado")
    else:
        raise HTTPException(status_code=403, detail="Acesso negado")


def _ensure_equipamentos(doc: Dict[str, Any]) -> List[str]:
    eq = []
    if doc and isinstance(doc.get("equipamentos"), list):
        eq = [str(e) for e in doc.get("equipamentos") if e is not None]
    base = ["Painel 1", "Painel 2"]
    if len(eq) >= 2:
        eq = [
            eq[0] or base[0],
            eq[1] or base[1],
            *[e for e in eq[2:] if e not in base],
        ]
    else:
        tail = [e for e in eq if e not in base]
        eq = base + tail
    return eq


def _find_equipamentos_by_codigo(db: couchdb.Database, codigo: Optional[str]) -> List[str]:
    if not codigo:
        return []
    try:
        result = db.find({
            "selector": {"table": "irrigadores", "codigo": codigo},
            "limit": 5,
        })
        best_doc = None
        best_len = 0
        for doc in result:
            if not isinstance(doc, dict):
                continue
            eq_list = doc.get("equipamentos")
            if isinstance(eq_list, list):
                eq_len = len([e for e in eq_list if e is not None])
                if eq_len > best_len:
                    best_len = eq_len
                    best_doc = doc
        if best_doc:
            return _ensure_equipamentos(best_doc)
        return []
    except Exception:
        return []


def _monitor_name(raw: Any, equipamentos: List[str]) -> str:
    try:
        mid = int(raw)
    except Exception:
        return str(raw or "—")

    if mid == 17:
        idx = 0
    elif mid == 18:
        idx = 1
    else:
        idx = mid + 1

    if idx < 0 or idx >= len(equipamentos):
        return "Ausente"
    return equipamentos[idx] if equipamentos[idx] else "Ausente"


def _parse_br_ts(ts: str) -> Optional[datetime]:
    try:
        return datetime.strptime(ts, "%H:%M:%S %d/%m/%Y")
    except Exception:
        return None


def _parse_any_ts(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        clean = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return _parse_br_ts(ts)


def _build_tension_series(points: List[Dict[str, Any]], equipamentos: List[str]) -> List[Dict[str, Any]]:
    series_map: Dict[str, Dict[str, Any]] = {}

    for p in points:
        ts = p.get("timestamp") or ""
        data = p.get("data") or {}
        monitores = data.get("monitores") or {}
        if not isinstance(monitores, dict):
            continue

        start = 1
        end = 7
        monitor_range = p.get("monitor_range")
        if isinstance(monitor_range, str) and "-" in monitor_range:
            try:
                a, b = monitor_range.split("-")
                start = int(a)
                end = int(b)
            except Exception:
                start, end = 1, 7

        values: Dict[str, float] = {}
        for i in range(start, end + 1):
            key = f"monitor_{i:02d}"
            entry = monitores.get(key) or {}
            v = entry.get("voltage")
            if not isinstance(v, (int, float)) or v <= 0:
                continue
            idx = i + 1
            name = equipamentos[idx] if idx < len(equipamentos) else f"Monitor {i}"
            if name:
                values[name] = float(v)

        if not values:
            continue

        if ts not in series_map:
            series_map[ts] = {"timestamp": ts, "values": {}}
        series_map[ts]["values"].update(values)

    return list(series_map.values())


# ============================================================================
# Tensão
# ============================================================================


@router.get("/{irrigador_id}/tension", response_model=TensionHistoryResponse)
def get_tension_history(
    irrigador_id: str,
    tipo: Optional[str] = Query(default="both"),
    start_ts: Optional[str] = Query(default=None),
    end_ts: Optional[str] = Query(default=None),
    period: Optional[str] = Query(default=None),
    max_points: int = Query(default=1000, ge=10, le=10000),
    user: dict = Depends(get_current_user),
):
    """Histórico de tensão de um irrigador."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)
    irrigador_doc = db[irrigador_id]
    equipamentos = _ensure_equipamentos(irrigador_doc)
    if len(equipamentos) <= 2 and codigo:
        alt = _find_equipamentos_by_codigo(db, codigo)
        if len(alt) > 2:
            equipamentos = alt
    codigo = irrigador_doc.get("codigo") if irrigador_doc else None

    if period and not (start_ts or end_ts):
        now = datetime.now(BR_TZ)
        if period == "last24h":
            start_ts = (now - timedelta(days=1)).isoformat()
            end_ts = now.isoformat()
        elif period == "last7d":
            start_ts = (now - timedelta(days=7)).isoformat()
            end_ts = now.isoformat()
        elif period == "last30d":
            start_ts = (now - timedelta(days=30)).isoformat()
            end_ts = now.isoformat()

    service = HistoryService(db)
    result = service.get_tension_history(
        irrigador_id, tipo, start_ts, end_ts, max_points
    )
    if (not result.get("points")) and codigo:
        result = service.get_tension_history(
            codigo, tipo, start_ts, end_ts, max_points
        )

    points = [
        TensionPoint(
            timestamp=p.get("timestamp", ""),
            tipo=p.get("tipo", ""),
            monitor_range=p.get("monitor_range"),
            data=TensionDataField(
                monitores={
                    k: MonitorVoltage(
                        voltage=v.get("voltage", 0) if isinstance(v, dict) else 0,
                        status=v.get("status", 0) if isinstance(v, dict) else 0,
                    )
                    for k, v in (p.get("data") or {}).get("monitores", {}).items()
                }
            ),
        )
        for p in result["points"]
    ]

    series = _build_tension_series(result["points"], equipamentos)

    return TensionHistoryResponse(
        irrigador_id=irrigador_id,
        points=points,
        total_raw=result["total_raw"],
        aggregated=result["aggregated"],
        series=series,
    )


# ============================================================================
# Eventos
# ============================================================================


@router.get("/{irrigador_id}/events", response_model=EventsHistoryResponse)
def get_events_history(
    irrigador_id: str,
    event_type: Optional[str] = Query(default=None),
    start_ts: Optional[str] = Query(default=None),
    end_ts: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    """Histórico de eventos de um irrigador."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)

    service = HistoryService(db)
    result = service.get_events_history(irrigador_id, event_type, start_ts, end_ts, skip, limit)

    items = [
        EventItem(**{**item, "_id": item.get("_id", item.get("id", ""))})
        for item in result["items"]
    ]

    return EventsHistoryResponse(
        irrigador_id=irrigador_id,
        total=result["total"],
        skip=result["skip"],
        limit=result["limit"],
        items=items,
    )


# ============================================================================
# SW
# ============================================================================


@router.get("/{irrigador_id}/sw", response_model=SWHistoryResponse)
def get_sw_history(
    irrigador_id: str,
    start_ts: Optional[str] = Query(default=None),
    end_ts: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    """Histórico de SW (chaves/sensores) de um irrigador."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)

    service = HistoryService(db)
    result = service.get_sw_history(irrigador_id, start_ts, end_ts, skip, limit)

    items = [
        SWPoint(**{**item, "_id": item.get("_id", item.get("id", ""))})
        for item in result["items"]
    ]

    return SWHistoryResponse(
        irrigador_id=irrigador_id,
        skip=result["skip"],
        limit=result["limit"],
        items=items,
    )


# ============================================================================
# Alertas
# ============================================================================


@router.get("/{irrigador_id}/alerts", response_model=AlertsHistoryResponse)
def get_alerts_history(
    irrigador_id: str,
    start_ts: Optional[str] = Query(default=None),
    end_ts: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    monitor: Optional[str] = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """Histórico de alertas de um irrigador."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)
    irrigador_doc = db[irrigador_id]
    equipamentos = _ensure_equipamentos(irrigador_doc)
    codigo = irrigador_doc.get("codigo") if irrigador_doc else None

    service = HistoryService(db)
    result = service.get_alerts_history(irrigador_id, start_ts, end_ts, skip, limit, monitor=monitor)
    if (not result.get("items")) and codigo:
        result = service.get_alerts_history(codigo, start_ts, end_ts, skip, limit, monitor=monitor)

    items = [
        EventItem(**{**item, "_id": item.get("_id", item.get("id", ""))})
        for item in result["items"]
    ]

    alerts = []
    for item in result["items"]:
        ts = item.get("timestamp", "")
        dt = _parse_any_ts(ts)
        alert_id = item.get("_id", item.get("id", ""))
        timer_doc = None
        if alert_id:
            timer_doc_id = f"timer:{alert_id}:current"
            try:
                timer_doc = db[timer_doc_id]
            except couchdb.ResourceNotFound:
                timer_doc = None
            except Exception:
                timer_doc = None
        alerts.append(
            {
                "_id": alert_id,
                "irrigadorId": item.get("irrigadorId", irrigador_id),
                "date": dt.strftime("%d/%m/%Y") if dt else "",
                "time": dt.strftime("%H:%M:%S") if dt else "",
                "monitor": item.get("monitor"),
                "monitor_name": _monitor_name(item.get("monitor"), equipamentos),
                "alarme": (item.get("eventType") or "")[:1],
                "estado": item.get("estado"),
                "status": item.get("status"),
                "timestamp": ts,
                "description": item.get("description"),
                "responsible": item.get("responsible"),
                "scheduled_for": (timer_doc or {}).get("scheduled_for") or item.get("scheduled_for"),
                "ultimo_agendamento": (timer_doc or {}).get("ultimo_agendamento") or item.get("ultimo_agendamento"),
                "responsavel_agendamento": (timer_doc or {}).get("responsavel_agendamento") or item.get("responsavel_agendamento"),
                "timer_value": (timer_doc or {}).get("timer_value") or item.get("timer_value"),
                "data_solucao": (timer_doc or {}).get("data_solucao") or item.get("data_solucao"),
                "responsavel_solucao": (timer_doc or {}).get("responsavel_solucao") or item.get("responsavel_solucao"),
            }
        )

    return AlertsHistoryResponse(
        irrigador_id=irrigador_id,
        total=result["total"],
        skip=result["skip"],
        limit=result["limit"],
        items=items,
        alerts=alerts,
    )


# ============================================================================
# Changes feed (proxy)
# ============================================================================


@router.get("/changes", response_model=ChangesResponse)
async def get_changes(
    since: str = Query(default="now"),
    limit: int = Query(default=1000, ge=1, le=5000),
    feed: str = Query(default="normal"),
    timeout_ms: int = Query(default=30000, ge=1000, le=60000),
    irrigador_id: Optional[str] = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """Proxy do CouchDB _changes feed, filtrado por permissão do usuário."""
    db = get_db()
    checker = PermissionChecker(user)

    if not checker.is_active():
        raise HTTPException(status_code=403, detail="Usuário não está ativo")

    # Verificar acesso a irrigador específico se fornecido
    if irrigador_id:
        _verify_irrigador_access(irrigador_id, user, checker, db)

    # Montar lista de doc_ids permitidos
    permitted_ids: Optional[list] = None
    if not checker.is_admin():
        user_cnpj = user.get("cnpj", "")
        if checker.is_revenda():
            field = "cnpj_revenda"
        else:
            field = "cnpj_cliente"

        pivos = list(db.find({
            "selector": {"table": "irrigadores", field: user_cnpj},
            "fields": ["_id"],
            "limit": 2000,
        }))
        permitted_ids = [p["_id"] for p in pivos]

        # Se um irrigador_id específico foi pedido, restringir ainda mais
        if irrigador_id and irrigador_id in permitted_ids:
            permitted_ids = [irrigador_id]
        elif irrigador_id:
            raise HTTPException(status_code=403, detail="Acesso negado")
    elif irrigador_id:
        # Admin com irrigador_id específico: filtrar apenas aquele irrigador
        permitted_ids = [irrigador_id]

    params = {
        "since": since,
        "limit": limit,
        "feed": feed,
        "timeout": timeout_ms,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_ms / 1000 + 10) as client:
            if permitted_ids is not None:
                response = await client.post(
                    f"{settings.COUCHDB_URL}/{settings.COUCHDB_DB}/_changes",
                    params={**params, "filter": "_doc_ids"},
                    json={"doc_ids": permitted_ids},
                )
            else:
                response = await client.get(
                    f"{settings.COUCHDB_URL}/{settings.COUCHDB_DB}/_changes",
                    params=params,
                )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        logger.warning(
            "[changes] CouchDB HTTP error status=%s url=%s body=%s",
            e.response.status_code,
            str(e.request.url),
            (e.response.text or "")[:300],
        )
        if feed == "longpoll":
            return ChangesResponse(last_seq=since, results=[])
        raise HTTPException(status_code=502, detail=f"CouchDB error: {e.response.status_code}")
    except httpx.RequestError as e:
        logger.warning(
            "[changes] CouchDB request error url=%s err=%s",
            str(e.request.url) if e.request else "",
            str(e),
        )
        if feed == "longpoll":
            return ChangesResponse(last_seq=since, results=[])
        raise HTTPException(status_code=502, detail=f"CouchDB unreachable: {str(e)}")
