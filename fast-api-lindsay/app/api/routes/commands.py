"""
Rotas de Comandos MQTT

Salva doc no formato que o Lindsay_comandos.py (Python MQTT) espera:
  topic, payload, qos, origin, timer_minutes, scheduled, executed, status
"""

from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

import couchdb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.api.routes.history import _verify_irrigador_access
from app.core.database import get_db
from app.services.permissions import PermissionChecker

router = APIRouter(prefix="/commands")
BR_TZ = ZoneInfo("America/Sao_Paulo")


# ============================================================================
# Schemas
# ============================================================================


class SendCommandRequest(BaseModel):
    irrigador_id: str
    command: str
    monitor: Optional[str] = None      # ex: "17" — concatenado ao payload
    timer_minutes: int = 0
    timer_ref: Optional[str] = None    # "timer:{alertId}:current"


class CommandResponse(BaseModel):
    success: bool
    doc_id: str
    status: str


# ============================================================================
# Endpoint
# ============================================================================


@router.post("", response_model=CommandResponse)
async def send_command(
    body: SendCommandRequest,
    user: dict = Depends(get_current_user),
):
    """
    Envia um comando para um irrigador.

    O backend monta topic e payload no formato que o Lindsay_comandos.py lê:
      topic   = "lindsay/comandos/{irrigador_id}"
      payload = "{irrigador_id};{command}{monitor}"

    O Python MQTT detecta o doc via _changes e publica no broker.
    """
    db = get_db()
    checker = PermissionChecker(user)

    if not checker.is_active():
        raise HTTPException(status_code=403, detail="Usuário não está ativo")

    irrigador_id = body.irrigador_id.strip()
    if not irrigador_id:
        raise HTTPException(status_code=400, detail="irrigador_id obrigatório")

    if not body.command:
        raise HTTPException(status_code=400, detail="command obrigatório")

    # Valida acesso ao irrigador (lança 403/404 se não tiver permissão)
    _verify_irrigador_access(irrigador_id, user, checker, db)

    now = datetime.now(BR_TZ)
    timer_minutes = max(0, body.timer_minutes)
    scheduled_for = (
        (now + timedelta(minutes=timer_minutes)).isoformat()
        if timer_minutes > 0
        else None
    )

    # Monta payload no formato que o Python MQTT espera
    monitor_suffix = body.monitor or ""
    mqtt_payload = f"{irrigador_id};{body.command}{monitor_suffix}"
    topic = f"lindsay/comandos/{irrigador_id}"

    doc_id = f"command:{irrigador_id}:{now.timestamp()}"
    doc = {
        "_id": doc_id,
        "table": "command",
        "topic": topic,
        "payload": mqtt_payload,
        "qos": 0,
        "origin": "app",
        "timer_minutes": timer_minutes,
        "scheduled_for": scheduled_for,
        "timer_ref": body.timer_ref,
        "scheduled": False,
        "executed": False,
        "status": "pending",
        "created_by": user["email"],
        "created_at": now.isoformat(),
        "timestamp": now.isoformat(),
    }

    try:
        db.save(doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar comando: {e}")

    return CommandResponse(
        success=True,
        doc_id=doc_id,
        status=doc["status"],
    )
