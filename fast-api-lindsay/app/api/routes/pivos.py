"""Rotas de pivôs (FASE 2)"""

from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import get_db
from app.models.schemas import (
    CreatePivoRequest,
    UpdatePivoRequest,
    PivosListResponse,
    PivosStatsResponse
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
        return PivosListResponse(
            total=len(pivos),
            role=user["type"],
            pivos=pivos
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_pivo(
    request: CreatePivoRequest,
    user: dict = Depends(get_current_user)
):
    """Criar novo pivô (cliente only)"""
    db = get_db()
    pivo_service = PivoService(db)
    checker = PermissionChecker(user)

    try:
        pivo = pivo_service.create_pivo(
            user=user,
            pivo_data={
                "codigo": request.codigo,
                "nome": request.nome,
                "owner_id": user["email"],
                "gerente_id": user.get("gerente_id", ""),
                "ativo": True,
                "location": request.location
            },
            checker=checker
        )
        return {"status": "created", "pivo": pivo}
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
    pivo_id: str,
    request: UpdatePivoRequest,
    user: dict = Depends(get_current_user)
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
    """Deletar pivô (admin only)"""
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
