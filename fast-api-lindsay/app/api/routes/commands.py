"""
Rotas de Comandos MQTT
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo

import couchdb

from app.core.database import get_db
from app.services.permissions import PermissionChecker
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/commands")
BR_TZ = ZoneInfo("America/Sao_Paulo")


# ============================================================================
# Comandos
# ============================================================================


@router.post("")
async def send_command(
    request: dict,
    user: dict = Depends(get_current_user),
):
    """
    Enviar comando para um irrigador/pivô

    Body:
    {
        "irrigadorId": "123",
        "pivoId": "pivo_001",  # opcional
        "command": "start|stop|pause|emergency_stop",
        "params": {
            "duration": 60,  # minutos
            "flow_rate": 80  # %
        },
        "timer_minutes": 0  # 0 = imediato, >0 = agendado
    }
    """
    db = get_db()
    checker = PermissionChecker(user)

    try:
        # Verificar permissões
        if not checker.is_active():
            raise HTTPException(status_code=403, detail="Usuário não está ativo")

        irrigador_id = request.get("irrigadorId", "").strip()
        pivo_id = request.get("pivoId", "").strip()
        command = request.get("command", "").strip()
        params = request.get("params", {})
        timer_minutes = request.get("timer_minutes", 0)

        if not irrigador_id:
            raise HTTPException(status_code=400, detail="irrigadorId obrigatório")

        if not command:
            raise HTTPException(status_code=400, detail="command obrigatório")

        # Validar comando
        valid_commands = ["start", "stop", "pause", "emergency_stop", "reset"]
        if command not in valid_commands:
            raise HTTPException(
                status_code=400,
                detail=f"Comando inválido. Use: {', '.join(valid_commands)}",
            )

        # Validar permissões: revendas e clientes só podem enviar para seus pivôs
        if checker.is_revenda():
            # Revenda pode enviar para seus clientes
            # (seria necessário verificar se o irrigador_id pertence a um de seus clientes)
            pass
        elif checker.is_cliente():
            # Cliente pode enviar apenas para seus pivôs
            if irrigador_id != user["email"]:
                raise HTTPException(
                    status_code=403,
                    detail="Você só pode enviar comandos para seus próprios pivôs",
                )

        # Criar documento de comando
        doc_id = f"command:{irrigador_id}:{datetime.now(BR_TZ).timestamp()}"

        doc = {
            "_id": doc_id,
            "table": "command",
            "irrigadorId": irrigador_id,
            "pivoId": pivo_id,
            "command": command,
            "params": params,
            "timer_minutes": max(0, int(timer_minutes)),
            "status": "scheduled" if timer_minutes > 0 else "pending",
            "sent_by": user["email"],
            "user_type": user["type"],
            "created_at": datetime.now(BR_TZ).isoformat(),
            "published": False,
        }

        # Salvar no CouchDB
        db.save(doc)

        return {
            "success": True,
            "doc_id": doc_id,
            "message": f"Comando '{command}' enviado para {irrigador_id}",
            "status": doc["status"],
            "will_execute_in": f"{timer_minutes} minuto(s)"
            if timer_minutes > 0
            else "Agora",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{command_id}")
async def get_command(
    command_id: str,
    user: dict = Depends(get_current_user),
):
    """Obter status de um comando"""
    db = get_db()
    checker = PermissionChecker(user)

    try:
        if not checker.is_active():
            raise HTTPException(status_code=403, detail="Usuário não está ativo")

        doc = db.get(command_id)

        if doc.get("table") != "command":
            raise HTTPException(status_code=404, detail="Comando não encontrado")

        # Verificar permissões
        if checker.is_cliente():
            if doc.get("irrigadorId") != user["email"]:
                raise HTTPException(status_code=403, detail="Acesso negado")

        return {
            "command": doc,
            "status": doc.get("status"),
            "published": doc.get("published", False),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{command_id}/cancel")
async def cancel_command(
    command_id: str,
    user: dict = Depends(get_current_user),
):
    """Cancelar um comando agendado"""
    db = get_db()
    checker = PermissionChecker(user)

    try:
        if not checker.is_active():
            raise HTTPException(status_code=403, detail="Usuário não está ativo")

        doc = db.get(command_id)

        if doc.get("table") != "command":
            raise HTTPException(status_code=404, detail="Comando não encontrado")

        # Verificar permissões
        if checker.is_cliente():
            if doc.get("irrigadorId") != user["email"]:
                raise HTTPException(status_code=403, detail="Acesso negado")

        # Verificar se já foi publicado
        if doc.get("published"):
            raise HTTPException(
                status_code=400,
                detail="Não é possível cancelar um comando já publicado",
            )

        # Marcar como cancelado
        doc["status"] = "cancelled"
        doc["cancelled_at"] = datetime.now(BR_TZ).isoformat()
        doc["cancelled_by"] = user["email"]
        db.save(doc)

        return {
            "success": True,
            "message": f"Comando {command_id} cancelado",
            "doc": doc,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_commands(
    irrigador_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """
    Listar comandos

    Query params:
    - irrigador_id: Filtrar por irrigador
    - status: pending, scheduled, published, cancelled
    - limit: Máximo de resultados
    """
    db = get_db()
    checker = PermissionChecker(user)

    try:
        if not checker.is_active():
            raise HTTPException(status_code=403, detail="Usuário não está ativo")

        selector = {"table": "command"}

        # Filtrar por irrigador
        if irrigador_id:
            if checker.is_cliente() and irrigador_id != user["email"]:
                raise HTTPException(status_code=403, detail="Acesso negado")
            selector["irrigadorId"] = irrigador_id
        elif checker.is_cliente():
            # Cliente só vê seus próprios
            selector["irrigadorId"] = user["email"]

        # Filtrar por status
        if status and status in ["pending", "scheduled", "published", "cancelled"]:
            selector["status"] = status

        # Executar query
        results = db.find(selector, limit=limit, sort=[{"created_at": "desc"}])

        return {
            "total": len(results) if results else 0,
            "commands": results or [],
            "filters": {
                "irrigador_id": irrigador_id,
                "status": status,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
