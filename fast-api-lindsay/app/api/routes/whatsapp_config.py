"""
Rotas de configuração global do WhatsApp

Substitui o acesso direto ao documento 'whatsapp' no CouchDB via whatsappStore.js.
Apenas admin/superadmin pode editar. Qualquer usuário ativo pode ler.
"""

import time
from typing import Any, Dict, Optional

import couchdb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.routes.auth import get_current_user
from app.core.database import get_db
from app.services.permissions import PermissionChecker

router = APIRouter(prefix="/whatsapp-config")

DOC_ID = "whatsapp"
MAX_RETRIES = 5


# ============================================================================
# Schemas
# ============================================================================


class WhatsappConfigResponse(BaseModel):
    enabled: bool
    extra: Dict[str, Any] = {}


class WhatsappConfigUpdateRequest(BaseModel):
    enabled: bool


# ============================================================================
# Helpers
# ============================================================================


def _get_doc(db: couchdb.Database) -> Dict:
    try:
        return dict(db[DOC_ID])
    except couchdb.ResourceNotFound:
        return {"_id": DOC_ID, "enabled": False}


# ============================================================================
# GET /whatsapp-config
# ============================================================================


@router.get("", response_model=WhatsappConfigResponse)
def get_whatsapp_config(user: dict = Depends(get_current_user)):
    """Retorna a configuração global do WhatsApp."""
    checker = PermissionChecker(user)
    if not checker.is_active():
        raise HTTPException(status_code=403, detail="Usuário não está ativo")

    db = get_db()
    doc = _get_doc(db)
    extra = {k: v for k, v in doc.items() if k not in ("_id", "_rev", "enabled")}
    return WhatsappConfigResponse(enabled=bool(doc.get("enabled", False)), extra=extra)


# ============================================================================
# PUT /whatsapp-config
# ============================================================================


@router.put("", response_model=WhatsappConfigResponse)
def update_whatsapp_config(
    body: WhatsappConfigUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Atualiza o campo 'enabled' da configuração global. Restrito a admin/superadmin."""
    checker = PermissionChecker(user)
    if not checker.is_active():
        raise HTTPException(status_code=403, detail="Usuário não está ativo")
    if not checker.is_admin():
        raise HTTPException(status_code=403, detail="Apenas admins podem alterar a configuração do WhatsApp")

    db = get_db()

    for attempt in range(MAX_RETRIES):
        doc = _get_doc(db)
        doc["enabled"] = body.enabled
        try:
            db.save(doc)
            extra = {k: v for k, v in doc.items() if k not in ("_id", "_rev", "enabled")}
            return WhatsappConfigResponse(enabled=bool(doc["enabled"]), extra=extra)
        except couchdb.ResourceConflict:
            if attempt == MAX_RETRIES - 1:
                raise HTTPException(status_code=409, detail="Conflito ao salvar, tente novamente")
            time.sleep(0.05 * (2 ** attempt))

    raise HTTPException(status_code=500, detail="Erro inesperado")
