"""
Rotas de Alertas e Notificações
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from app.core.database import get_db
from app.models.schemas import StatusResponse
from app.services.alert_service import AlertService
from app.services.push_service import PushService
from app.services.notification_service import notification_service
from app.api.routes.auth import get_current_user
from app.services.permissions import PermissionChecker

router = APIRouter(prefix="/alerts")


# ============================================================================
# Alertas
# ============================================================================

@router.get("")
async def list_alerts(
    irrigador_id: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """Listar alertas (filtrado por role)"""
    db = get_db()
    alert_service = AlertService(db)
    checker = PermissionChecker(user)

    try:
        # Verificar permissões
        if not checker.is_active():
            raise HTTPException(status_code=403, detail="Usuário não está ativo")

        # Admin vê todos
        # Revenda vê de seus clientes
        # Cliente vê apenas seus próprios
        selector = {"table": "event"}

        if checker.is_admin():
            pass  # Vê todos
        elif checker.is_revenda():
            # Vê de seus clientes (precisa expandir para todos os clientes da revenda)
            selector["gerente_id"] = user.get("doc_id")
        elif checker.is_cliente():
            selector["irrigadorId"] = user["email"]
        else:
            raise HTTPException(status_code=403, detail="Acesso negado")

        results = db.find(selector, limit=limit, sort=[{"timestamp": "desc"}])
        return {
            "total": len(results) if results else 0,
            "alerts": results or [],
            "role": user["type"],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{alert_id}")
async def get_alert(alert_id: str, user: dict = Depends(get_current_user)):
    """Obter detalhes de um alerta específico"""
    db = get_db()

    try:
        alert = db.get(alert_id)

        # Verificar permissões
        checker = PermissionChecker(user)
        if not checker.is_active():
            raise HTTPException(status_code=403, detail="Usuário não está ativo")

        if checker.is_admin():
            pass  # Admin vê tudo
        elif checker.is_revenda():
            if alert.get("gerente_id") != user.get("doc_id"):
                raise HTTPException(status_code=403, detail="Acesso negado")
        elif checker.is_cliente():
            if alert.get("irrigadorId") != user["email"]:
                raise HTTPException(status_code=403, detail="Acesso negado")

        return {"alert": alert}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================================
# Notificações
# ============================================================================

@router.post("/notifications/send")
async def send_notification(
    request: dict,
    user: dict = Depends(get_current_user),
):
    """
    Enviar notificações manuais via SMS/WhatsApp/Email

    Body:
    {
        "message": "Seu texto aqui",
        "subject": "Assunto (para email)",
        "phones": ["+5511999999999"],
        "emails": ["user@example.com"],
        "channels": ["sms", "whatsapp", "email"]
    }
    """
    db = get_db()
    checker = PermissionChecker(user)

    try:
        # Apenas revendas e admins podem enviar notificações
        if not (checker.is_admin() or checker.is_revenda()) or not checker.is_active():
            raise HTTPException(status_code=403, detail="Permissão negada")

        message = request.get("message", "")
        subject = request.get("subject", "")
        phones = request.get("phones", [])
        emails = request.get("emails", [])
        channels = request.get("channels", ["sms", "whatsapp", "email"])

        if not message:
            raise HTTPException(status_code=400, detail="Mensagem obrigatória")

        # Enviar notificações
        result = notification_service.send_multi(
            message=message,
            subject=subject,
            phones=phones,
            emails=emails,
            channels=channels,
        )

        # Log
        try:
            log_doc = {
                "_id": f"notification_sent:{user['email']}:{__import__('time').time()}",
                "table": "notification_log",
                "sent_by": user["email"],
                "user_type": user["type"],
                "result": result,
                "timestamp": __import__('datetime').datetime.now(
                    __import__('zoneinfo').ZoneInfo("America/Sao_Paulo")
                ).isoformat(),
            }
            db.save(log_doc)
        except Exception as e:
            pass  # Log error silently

        return {
            "success": True,
            "message": "Notificações enviadas",
            "result": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Push Notifications
# ============================================================================

@router.post("/push/register-device")
async def register_device_token(
    request: dict,
    user: dict = Depends(get_current_user),
):
    """
    Registrar device token para push notifications

    Body:
    {
        "device_token": "ExponentPushToken[xxxxxx]",
        "device_info": {"model": "iPhone 12", "os": "iOS"}
    }
    """
    db = get_db()

    try:
        if not user.get("email"):
            raise HTTPException(status_code=400, detail="Email obrigatório")

        device_token = request.get("device_token", "")
        device_info = request.get("device_info", {})

        if not device_token:
            raise HTTPException(status_code=400, detail="Device token obrigatório")

        push_service = PushService(db)
        result = push_service.register_device_token(
            device_token=device_token,
            irrigador_ids=[user["email"]],  # Cliente pode registrar para seus pivôs
            device_info=device_info,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/push/unregister-device")
async def unregister_device_token(
    request: dict,
    user: dict = Depends(get_current_user),
):
    """Desregistrar device token"""
    db = get_db()

    try:
        device_token = request.get("device_token", "")

        if not device_token:
            raise HTTPException(status_code=400, detail="Device token obrigatório")

        push_service = PushService(db)
        result = push_service.unregister_device_token(device_token)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/push/notifications-history")
async def get_notifications_history(
    irrigador_id: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """Obter histórico de notificações push enviadas"""
    db = get_db()
    checker = PermissionChecker(user)

    try:
        if not checker.is_active():
            raise HTTPException(status_code=403, detail="Usuário não está ativo")

        push_service = PushService(db)

        # Determinar qual irrigador ver
        if checker.is_admin():
            if not irrigador_id:
                raise HTTPException(status_code=400, detail="irrigador_id obrigatório para admin")
            target_irrigador = irrigador_id
        elif checker.is_revenda() or checker.is_cliente():
            target_irrigador = irrigador_id or user["email"]
        else:
            raise HTTPException(status_code=403, detail="Acesso negado")

        logs = push_service.get_notification_logs(target_irrigador, limit)

        return {
            "total": len(logs),
            "logs": logs,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
