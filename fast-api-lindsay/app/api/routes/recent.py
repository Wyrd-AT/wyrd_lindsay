#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rotas de snapshots recentes — estado atual de tensão e SW por irrigador
"""

from fastapi import APIRouter, Depends, HTTPException, Path
from typing import Any, Dict, Optional, List
from datetime import datetime

import couchdb

from app.api.routes.auth import get_current_user
from app.api.routes.history import _verify_irrigador_access
from app.core.database import get_db
from app.models.schemas import RecentAllResponse, RecentSWResponse, RecentTensionResponse
from app.services.permissions import PermissionChecker

router = APIRouter(prefix="/recent")

TIPOS = ["A", "B", "C", "D"]


def _get_doc_safe(db: couchdb.Database, doc_id: str) -> Optional[Dict]:
    try:
        return dict(db[doc_id])
    except couchdb.ResourceNotFound:
        return None


def _ensure_equipamentos(irrigador_doc: Optional[Dict]) -> List[str]:
    eq = []
    if irrigador_doc and isinstance(irrigador_doc.get("equipamentos"), list):
        eq = [str(e) for e in irrigador_doc.get("equipamentos") if e is not None]
    # garante Painel 1 e Painel 2 como base
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


def _parse_br_ts(ts: str) -> Optional[datetime]:
    try:
        # formato: HH:MM:SS DD/MM/YYYY
        dt = datetime.strptime(ts, "%H:%M:%S %d/%m/%Y")
        return dt
    except Exception:
        return None


def _format_pt_br(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y %H:%M:%S")


def _format_ts(ts: Optional[str]) -> Optional[str]:
    if not ts:
        return None
    # tenta ISO
    try:
        clean = ts.replace("Z", "+00:00") if isinstance(ts, str) else ts
        dt = datetime.fromisoformat(clean)
        return _format_pt_br(dt)
    except Exception:
        pass
    # tenta BR
    dt = _parse_br_ts(ts)
    if dt:
        return _format_pt_br(dt)
    return None


def _parse_sw_vector(data: Optional[Dict]) -> Optional[Dict[str, Any]]:
    if not data or not isinstance(data, dict):
        return None
    to_str = lambda v: "0" if v is None else str(v)
    m_arr: List[Dict[str, Any]] = []
    monitores = data.get("monitores")
    if isinstance(monitores, dict):
        for k in sorted(monitores.keys()):
            m = monitores.get(k) or {}
            m_arr.append(
                {
                    "statusSw1": to_str(m.get("fim_de_curso_1")),
                    "statusSw2": to_str(m.get("fim_de_curso_2")),
                    "armadilha": m.get("armadilha", 0),
                    "statusTensao": m.get("status"),
                }
            )
    return {
        "status_manutencao": "1" if int(data.get("manutencao") or 0) > 0 else "0",
        "sirene": "1" if int(data.get("sirene") or 0) > 0 else "0",
        "painel_1": to_str(data.get("painel_1")),
        "painel_2": to_str(data.get("painel_2")),
        "monitores": m_arr,
    }


def _count_alarm_sw(data: Optional[Dict]) -> int:
    if not data or not isinstance(data, dict):
        return 0

    def is_alarm(v: Any) -> bool:
        return isinstance(v, (int, float)) and int(v) == 1

    total = 0
    for k in ("painel_1", "painel_2"):
        if is_alarm(data.get(k)):
            total += 1

    monitores = data.get("monitores")
    if isinstance(monitores, dict):
        for key in monitores.keys():
            m = monitores.get(key) or {}
            if (
                is_alarm(m.get("fim_de_curso_1"))
                or is_alarm(m.get("fim_de_curso_2"))
                or is_alarm(m.get("status"))
            ):
                total += 1
    return total


def _monitores_to_voltage_map(doc: Optional[Dict]) -> Dict[int, float]:
    out: Dict[int, float] = {}
    monitores = (doc or {}).get("data", {}).get("monitores", {})
    if not isinstance(monitores, dict):
        return out
    for key, val in monitores.items():
        if not isinstance(key, str):
            continue
        if not key.startswith("monitor_"):
            continue
        try:
            mt = int(key.replace("monitor_", ""))
            v = float((val or {}).get("voltage"))
            out[mt] = v
        except Exception:
            continue
    return out


def _build_overview_cards(
    parsed_sw: Dict[str, Any],
    equipamentos: List[str],
    tensao_a: Optional[Dict],
    tensao_b: Optional[Dict],
) -> List[Dict[str, Any]]:
    cards: List[Dict[str, Any]] = []

    # base painéis
    cards.append(
        {
            "id": "painel-1",
            "title": equipamentos[0] if equipamentos else "Painel 1",
            "statuses": [{"label": "status", "value": parsed_sw.get("painel_1")}],
        }
    )
    cards.append(
        {
            "id": "painel-2",
            "title": (equipamentos[1] if len(equipamentos) > 1 else "Painel 2"),
            "statuses": [
                {
                    "label": "status",
                    "value": parsed_sw.get("painel_2")
                    or parsed_sw.get("painel_1"),
                }
            ],
        }
    )

    volt_a = _monitores_to_voltage_map(tensao_a)
    volt_b = _monitores_to_voltage_map(tensao_b)

    monitores = parsed_sw.get("monitores") or []
    for i, m in enumerate(monitores):
        idx = i + 2
        title = (
            equipamentos[idx] if idx < len(equipamentos) else f"Monitor {i + 1}"
        )
        a = volt_a.get(i + 1)
        b = volt_b.get(i + 1)
        val = None
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            val = (a + b) / 2
        elif isinstance(a, (int, float)):
            val = a
        elif isinstance(b, (int, float)):
            val = b

        statuses = [
            {"label": "SW1", "value": m.get("statusSw1")},
            {"label": "SW2", "value": m.get("statusSw2")},
            {"label": "Falha por tensão", "value": m.get("armadilha")},
            {"label": "Tensão SW", "value": m.get("statusTensao")},
        ]
        if isinstance(val, (int, float)):
            statuses.append({"label": "Tensão (V)", "value": f"{val:.2f}"})
        cards.append(
            {
                "id": f"{title}-{i}",
                "title": title,
                "statuses": statuses,
            }
        )

    # remove cards "Ausente"
    return [c for c in cards if c.get("title") != "Ausente"]


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/{irrigador_id}", response_model=RecentAllResponse)
def get_recent_all(
    irrigador_id: str = Path(...),
    user: dict = Depends(get_current_user),
):
    """Retorna o estado atual (tensão A/B/C/D + SW) de um irrigador."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)

    tensao: Dict[str, Any] = {}
    # tenta também pelo código do irrigador (alguns ambientes usam codigo nos docs recentes)
    irrigador_doc = _get_doc_safe(db, irrigador_id)
    codigo = irrigador_doc.get("codigo") if irrigador_doc else None

    for tipo in TIPOS:
        doc_id = f"tensao_recente::{irrigador_id}::{tipo}"
        doc = _get_doc_safe(db, doc_id)
        if not doc:
            legacy_id = f"recente_tensao::{irrigador_id}::{tipo}"
            doc = _get_doc_safe(db, legacy_id)
        if not doc and codigo:
            doc = _get_doc_safe(db, f"tensao_recente::{codigo}::{tipo}")
        if not doc and codigo:
            doc = _get_doc_safe(db, f"recente_tensao::{codigo}::{tipo}")
        if doc:
            tensao[tipo] = doc

    sw_doc_id = f"sw_recente::{irrigador_id}"
    sw = _get_doc_safe(db, sw_doc_id)
    if not sw:
        legacy_sw_id = f"recente_sw::{irrigador_id}"
        sw = _get_doc_safe(db, legacy_sw_id)
    if not sw and codigo:
        sw = _get_doc_safe(db, f"sw_recente::{codigo}")
    if not sw and codigo:
        sw = _get_doc_safe(db, f"recente_sw::{codigo}")

    # equipamentos do irrigador (para labels)
    equipamentos = _ensure_equipamentos(irrigador_doc)
    if len(equipamentos) <= 2 and codigo:
        alt = _find_equipamentos_by_codigo(db, codigo)
        if len(alt) > 2:
            equipamentos = alt

    parsed_sw = _parse_sw_vector((sw or {}).get("data") if sw else None)
    cards = []
    if parsed_sw:
        cards = _build_overview_cards(
            parsed_sw,
            equipamentos,
            tensao.get("A") if isinstance(tensao, dict) else None,
            tensao.get("B") if isinstance(tensao, dict) else None,
        )

    status_sw_at = None
    tensao_at = None
    if sw:
        status_sw_at = _format_ts((sw.get("data") or {}).get("timestamp")) or _format_ts(
            sw.get("updated_at")
        )
    alarm_count = _count_alarm_sw((sw or {}).get("data") if sw else None)
    if tensao and isinstance(tensao, dict):
        t_doc = tensao.get("A") or tensao.get("B") or tensao.get("C") or tensao.get("D")
        if t_doc:
            tensao_at = _format_ts((t_doc.get("data") or {}).get("timestamp")) or _format_ts(
                t_doc.get("updated_at")
            )

    last_data_at = None
    sw_dt = _parse_br_ts(status_sw_at) if status_sw_at else None
    tensao_dt = _parse_br_ts(tensao_at) if tensao_at else None
    if sw_dt and tensao_dt:
        last_data_at = status_sw_at if sw_dt >= tensao_dt else tensao_at
    elif sw_dt:
        last_data_at = status_sw_at
    elif tensao_dt:
        last_data_at = tensao_at

    overview = {
        "equipamentos": equipamentos,
        "cards": cards,
        "is_in_maintenance": parsed_sw.get("status_manutencao") == "1"
        if parsed_sw
        else False,
        "is_sirene_active": parsed_sw.get("sirene") == "1" if parsed_sw else False,
        "status_sw_at": status_sw_at,
        "tensao_at": tensao_at,
        "alarm_count": alarm_count,
        "last_alert_date": status_sw_at,
        "last_data_at": last_data_at,
    }

    return RecentAllResponse(
        tensao=tensao if tensao else None,
        sw=sw,
        overview=overview,
    )


@router.get("/{irrigador_id}/tension/{tipo}", response_model=RecentTensionResponse)
def get_recent_tension(
    irrigador_id: str = Path(...),
    tipo: str = Path(...),
    user: dict = Depends(get_current_user),
):
    """Retorna o snapshot mais recente de tensão para um tipo (A/B/C/D)."""
    if tipo not in TIPOS:
        raise HTTPException(status_code=400, detail=f"tipo deve ser um de: {TIPOS}")

    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)

    doc_id = f"tensao_recente::{irrigador_id}::{tipo}"
    doc = _get_doc_safe(db, doc_id)
    if not doc:
        legacy_id = f"recente_tensao::{irrigador_id}::{tipo}"
        doc = _get_doc_safe(db, legacy_id)
    if not doc:
        irrigador_doc = _get_doc_safe(db, irrigador_id)
        codigo = irrigador_doc.get("codigo") if irrigador_doc else None
        if codigo:
            doc = _get_doc_safe(db, f"tensao_recente::{codigo}::{tipo}")
        if not doc and codigo:
            doc = _get_doc_safe(db, f"recente_tensao::{codigo}::{tipo}")
    if not doc:
        raise HTTPException(status_code=404, detail="Snapshot de tensão não encontrado")

    return RecentTensionResponse(**{**doc, "_id": doc.get("_id", doc_id)})


@router.get("/{irrigador_id}/sw", response_model=RecentSWResponse)
def get_recent_sw(
    irrigador_id: str = Path(...),
    user: dict = Depends(get_current_user),
):
    """Retorna o snapshot mais recente de SW (chaves/sensores)."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)

    doc_id = f"sw_recente::{irrigador_id}"
    doc = _get_doc_safe(db, doc_id)
    if not doc:
        legacy_id = f"recente_sw::{irrigador_id}"
        doc = _get_doc_safe(db, legacy_id)
    if not doc:
        irrigador_doc = _get_doc_safe(db, irrigador_id)
        codigo = irrigador_doc.get("codigo") if irrigador_doc else None
        if codigo:
            doc = _get_doc_safe(db, f"sw_recente::{codigo}")
        if not doc and codigo:
            doc = _get_doc_safe(db, f"recente_sw::{codigo}")
    if not doc:
        raise HTTPException(status_code=404, detail="Snapshot de SW não encontrado")

    return RecentSWResponse(**{**doc, "_id": doc.get("_id", doc_id)})
