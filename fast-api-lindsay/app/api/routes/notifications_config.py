#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rotas de configuração de notificações por irrigador
Substitui o acesso direto ao documento 'notificacoes:{irrigadorId}' no CouchDB
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List

import couchdb

from app.api.routes.auth import get_current_user
from app.api.routes.history import _verify_irrigador_access
from app.core.database import get_db
from app.models.schemas import (
    NotificationsConfigResponse,
    NotificationsConfigUpdateRequest,
    NotifAssinante,
    StatusResponse,
)
from app.services.permissions import PermissionChecker

router = APIRouter(prefix="/notifications-config")


def _get_or_init_doc(db: couchdb.Database, irrigador_id: str) -> Dict:
    doc_id = f"notificacoes:{irrigador_id}"
    try:
        return dict(db[doc_id])
    except couchdb.ResourceNotFound:
        return {"_id": doc_id, "irrigador_id": irrigador_id, "assinantes": []}


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/{irrigador_id}", response_model=NotificationsConfigResponse)
def get_notifications_config(
    irrigador_id: str,
    user: dict = Depends(get_current_user),
):
    """Retorna a configuração de notificações de um irrigador."""
    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)

    doc = _get_or_init_doc(db, irrigador_id)
    assinantes = [
        NotifAssinante(
            email=a.get("email", ""),
            msg_enabled=a.get("msg_enabled", False),
            call_enabled=a.get("call_enabled", False),
        )
        for a in doc.get("assinantes", [])
    ]
    return NotificationsConfigResponse(irrigador_id=irrigador_id, assinantes=assinantes)


@router.put("/{irrigador_id}", response_model=StatusResponse)
def update_notifications_config(
    irrigador_id: str,
    body: NotificationsConfigUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """
    Atualiza a configuração de notificações de um assinante para o irrigador.
    Cria o documento se não existir. Retry automático em conflito 409.
    """
    db = get_db()
    checker = PermissionChecker(user)
    _verify_irrigador_access(irrigador_id, user, checker, db)

    doc_id = f"notificacoes:{irrigador_id}"
    max_retries = 5

    for attempt in range(max_retries):
        doc = _get_or_init_doc(db, irrigador_id)
        assinantes: List[Dict] = list(doc.get("assinantes", []))

        # Atualiza ou insere o assinante pelo email
        updated = False
        for a in assinantes:
            if a.get("email") == body.email:
                a["msg_enabled"] = body.msg_enabled
                a["call_enabled"] = body.call_enabled
                updated = True
                break
        if not updated:
            assinantes.append({
                "email": body.email,
                "msg_enabled": body.msg_enabled,
                "call_enabled": body.call_enabled,
            })

        doc["assinantes"] = assinantes

        try:
            db.save(doc)
            return StatusResponse(status="ok", message="Configuração atualizada")
        except couchdb.ResourceConflict:
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=409,
                    detail="Conflito ao salvar configuração, tente novamente",
                )
            continue

    raise HTTPException(status_code=500, detail="Erro inesperado ao salvar configuração")
