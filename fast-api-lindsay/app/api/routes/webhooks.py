from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body

from app.services.zapi_voice_retry import process_zapi_webhook

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/zapi")
async def zapi_webhook(payload: Dict[str, Any] = Body(default_factory=dict)):
    return process_zapi_webhook(payload)
