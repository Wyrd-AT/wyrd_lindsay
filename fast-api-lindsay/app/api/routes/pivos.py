"""Rotas de pivôs (FASE 2)"""

import logging
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import get_db, get_users_db
from app.core.config import settings

logger = logging.getLogger(__name__)
from app.models.schemas import (
    CreatePivoRequest,
    UpdatePivoRequest,
    PivosListResponse,
    PivosStatsResponse,
)
from app.services.pivo import PivoService
from app.services.permissions import PermissionChecker
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/pivos")


@router.get("", response_model=PivosListResponse)
async def list_pivos(user: dict = Depends(get_current_user)):
    """Listar pivôs (filtrado por role)"""
    db = get_db()
    pivo_service = PivoService(db)
    checker = PermissionChecker(user)

    try:
        pivos = pivo_service.list_pivos(user, checker)
        return PivosListResponse(total=len(pivos), role=user["type"], pivos=pivos)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_pivo(
    request: CreatePivoRequest, user: dict = Depends(get_current_user)
):
    """Criar novo pivô (apenas admin); associação por cnpj_cliente (enviado em cliente_id)."""
    checker = PermissionChecker(user)
    if not checker.is_admin():
        raise HTTPException(
            status_code=403, detail="Apenas admin/superadmin podem criar pivôs"
        )

    if not request.cliente_id:
        raise HTTPException(
            status_code=400, detail="cliente_id é obrigatório (cnpj_cliente do cliente)"
        )

    cnpj_cliente = request.cliente_id.strip()
    logger.info(
        "[create_pivo] Requisição: cnpj_cliente=%r, codigo=%r, nome=%r",
        cnpj_cliente,
        request.codigo,
        request.nome,
    )

    db = get_db()
    users_db = get_users_db()
    pivo_service = PivoService(db)
    try:
        # Buscar cliente por cnpj_cliente (lindsay-users; fallback lindsay-data)
        cliente_doc = None
        cliente_db = None
        try:
            found = list(
                users_db.find(
                    {
                        "selector": {"type": "cliente", "cnpj_cliente": cnpj_cliente},
                        "limit": 1,
                    }
                )
            )
            if found:
                cliente_doc = found[0]
                cliente_db = users_db
                logger.info(
                    "[create_pivo] Cliente encontrado em %s", settings.COUCHDB_USERS_DB
                )
        except Exception as e:
            logger.exception(
                "[create_pivo] Erro ao buscar em %s: %s", settings.COUCHDB_USERS_DB, e
            )
        if not cliente_doc:
            try:
                found = list(
                    db.find(
                        {
                            "selector": {
                                "type": "cliente",
                                "cnpj_cliente": cnpj_cliente,
                            },
                            "limit": 1,
                        }
                    )
                )
                if found:
                    cliente_doc = found[0]
                    cliente_db = db
                    logger.info(
                        "[create_pivo] Cliente encontrado em %s (fallback)",
                        settings.COUCHDB_DB,
                    )
            except Exception as e2:
                logger.exception(
                    "[create_pivo] Fallback em %s: %s", settings.COUCHDB_DB, e2
                )

        if not cliente_doc or cliente_doc.get("type") != "cliente":
            raise HTTPException(status_code=404, detail="Cliente não encontrado")

        owner_id = cliente_doc.get("email")
        cnpj_cliente = cliente_doc.get("cnpj_cliente")
        cnpj_revenda = cliente_doc.get("cnpj_revenda")
        cnpj_admin = cliente_doc.get("cnpj_admin")
        revenda_id = cliente_doc.get("revenda_id")
        nome_cliente = cliente_doc.get("name")
        nome_revenda = None
        nome_admin = None

        # Resolver nomes do admin e da revenda (para exibição no card)
        if cnpj_admin:
            try:
                admins = list(
                    users_db.find(
                        {
                            "selector": {"type": "admin", "cnpj_admin": cnpj_admin},
                            "limit": 1,
                        }
                    )
                )
                if admins:
                    nome_admin = admins[0].get("name")
            except Exception:
                pass
        if cnpj_revenda:
            try:
                revendas = list(
                    users_db.find(
                        {
                            "selector": {
                                "type": "revenda",
                                "cnpj_revenda": cnpj_revenda,
                            },
                            "limit": 1,
                        }
                    )
                )
                if revendas:
                    nome_revenda = revendas[0].get("name")
            except Exception:
                pass

        pivo = pivo_service.create_pivo(
            user=user,
            pivo_data={
                "codigo": request.codigo,
                "nome": request.nome,
                "owner_id": owner_id,
                "cnpj_cliente": cnpj_cliente,
                "nome_cliente": nome_cliente,
                "cnpj_revenda": cnpj_revenda,
                "nome_revenda": nome_revenda,
                "cnpj_admin": cnpj_admin,
                "nome_admin": nome_admin,
                "revenda_id": revenda_id,
                "equipamentos": request.equipamentos,
                "ativo": True,
                "location": request.location,
                "contacts": {
                    "whatsapp": request.whatsapp,
                    "sms": request.sms,
                    "email": request.email,
                },
            },
            checker=checker,
        )

        # Atualizar cliente.irrigadores[] no mesmo banco de onde o doc foi lido (users ou data)
        try:
            irrigadores = cliente_doc.get("irrigadores", [])
            if request.codigo not in irrigadores:
                irrigadores.append(request.codigo)
                cliente_doc["irrigadores"] = irrigadores
                cliente_db.save(cliente_doc)
                print(f"✅ Cliente.irrigadores[] atualizado com {request.codigo}")
        except Exception as e:
            print(f"⚠️ Aviso ao atualizar cliente.irrigadores[]: {e}")

        return {"status": "created", "pivo": pivo}
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{pivo_id}")
async def get_pivo(pivo_id: str, user: dict = Depends(get_current_user)):
    """Obter pivô específico"""
    db = get_db()
    pivo_service = PivoService(db)
    checker = PermissionChecker(user)

    try:
        pivo = pivo_service.get_pivo(user, pivo_id, checker)
        return {"pivo": pivo}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Acesso negado")
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{pivo_id}")
async def update_pivo(
    pivo_id: str, request: UpdatePivoRequest, user: dict = Depends(get_current_user)
):
    """Atualizar pivô"""
    db = get_db()
    pivo_service = PivoService(db)
    checker = PermissionChecker(user)

    try:
        pivo_data = {}
        if request.nome:
            pivo_data["nome"] = request.nome
        if request.ativo is not None:
            pivo_data["ativo"] = request.ativo
        if request.location:
            pivo_data["location"] = request.location

        pivo = pivo_service.update_pivo(user, pivo_id, pivo_data, checker)
        return {"status": "updated", "pivo": pivo}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Acesso negado")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{pivo_id}")
async def delete_pivo(pivo_id: str, user: dict = Depends(get_current_user)):
    """Deletar pivô (admin/superadmin)"""
    db = get_db()
    pivo_service = PivoService(db)
    checker = PermissionChecker(user)

    try:
        success = pivo_service.delete_pivo(user, pivo_id, checker)
        return {"status": "deleted" if success else "error"}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Acesso negado")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats")
async def get_pivos_stats(user: dict = Depends(get_current_user)):
    """Obter estatísticas de pivôs"""
    db = get_db()
    pivo_service = PivoService(db)
    checker = PermissionChecker(user)

    try:
        stats = pivo_service.get_pivos_stats(user, checker)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
