"""Rotas de pivôs (FASE 2)"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import settings
from app.core.database import get_db, get_users_db

logger = logging.getLogger(__name__)
from app.api.routes.auth import get_current_user
from app.models.schemas import (
    CreatePivoRequest,
    PivosListResponse,
    PivosStatsResponse,
    PivosRecentResponse,
    UpdatePivoRequest,
)
from app.services.permissions import PermissionChecker
from app.services.pivo import PivoService


# ---------------------------------------------------------------------------
# Helpers de status recente (inline para evitar acoplamento entre rotas)
# ---------------------------------------------------------------------------

def _count_alarm_sw(data: Optional[Dict[str, Any]]) -> int:
    """Conta alarmes ativos nos dados de SW de um irrigador."""
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
        for key in monitores:
            m = monitores.get(key) or {}
            if (
                is_alarm(m.get("fim_de_curso_1"))
                or is_alarm(m.get("fim_de_curso_2"))
                or is_alarm(m.get("status"))
            ):
                total += 1
    return total


def _format_ts(ts: Optional[str]) -> Optional[str]:
    """Converte timestamp ISO ou BR para formato legível pt-BR."""
    if not ts:
        return None
    try:
        clean = ts.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        return dt.strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        pass
    try:
        dt = datetime.strptime(ts, "%H:%M:%S %d/%m/%Y")
        return dt.strftime("%d/%m/%Y %H:%M:%S")
    except Exception:
        return None


def _parse_any_ts(ts: Optional[str]) -> Optional[datetime]:
    """Parse ISO ou BR para datetime (para comparação)."""
    if not ts:
        return None
    try:
        clean = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        pass
    try:
        return datetime.strptime(ts, "%H:%M:%S %d/%m/%Y")
    except Exception:
        return None


def _extract_ts(doc: Optional[Dict[str, Any]]) -> Optional[str]:
    if not doc or not isinstance(doc, dict):
        return None
    data = doc.get("data") if isinstance(doc.get("data"), dict) else {}
    return data.get("timestamp") or doc.get("updated_at")

router = APIRouter(prefix="/pivos")


def _build_recent_for_pivos(
    db,
    pivos: list[Dict[str, Any]],
    debug_out: Optional[Dict[str, Any]] = None,
) -> list[Dict[str, Any]]:
    if not pivos:
        return []

    pivo_ids = [p["_id"] for p in pivos if p.get("_id")]
    pivo_codigos = [p.get("codigo") for p in pivos if p.get("codigo")]
    if debug_out is not None:
        debug_out.update({
            "pivos": len(pivos),
            "ids": len(pivo_ids),
            "codigos": len(pivo_codigos),
        })

    # SW docs (novo + legado)
    sw_doc_ids = []
    for pid in pivo_ids:
        sw_doc_ids.append(f"sw_recente::{pid}")
        sw_doc_ids.append(f"recente_sw::{pid}")
    for codigo in pivo_codigos:
        sw_doc_ids.append(f"sw_recente::{codigo}")
        sw_doc_ids.append(f"recente_sw::{codigo}")

    def _fetch_docs_by_ids(ids: list[str], label: str) -> list[Dict[str, Any]]:
        if not ids:
            return []
        # Tenta Mango ($in). Se falhar, faz fallback para _all_docs com keys.
        try:
            result = db.find({
                "selector": {"_id": {"$in": ids}},
                "limit": len(ids),
            })
            docs = [doc for doc in result if isinstance(doc, dict)]
            if debug_out is not None:
                debug_out[f"{label}_ids"] = len(ids)
                debug_out[f"{label}_mango_found"] = len(docs)
            return docs
        except Exception as e:
            if debug_out is not None:
                debug_out[f"{label}_mango_error"] = str(e)
            try:
                rows = db.view("_all_docs", keys=ids, include_docs=True)
                docs = [r.doc for r in rows if getattr(r, "doc", None)]
                if debug_out is not None:
                    debug_out[f"{label}_all_docs_found"] = len(docs)
                return docs
            except Exception as e2:
                if debug_out is not None:
                    debug_out[f"{label}_all_docs_error"] = str(e2)
                return []

    recent_sw_map: Dict[str, Dict] = {}
    sw_docs = _fetch_docs_by_ids(sw_doc_ids, "sw")
    if debug_out is not None:
        debug_out["sw_docs"] = len(sw_docs)
    for doc in sw_docs:
        doc_id = doc.get("_id", "")
        if "::" in doc_id:
            key = doc_id.split("::", 1)[1]
            if key not in recent_sw_map:
                recent_sw_map[key] = doc

    # Tensão docs (A/B/C/D)
    tensao_doc_ids = []
    for pid in pivo_ids:
        for tipo in ("A", "B", "C", "D"):
            tensao_doc_ids.append(f"tensao_recente::{pid}::{tipo}")
            tensao_doc_ids.append(f"recente_tensao::{pid}::{tipo}")
    for codigo in pivo_codigos:
        for tipo in ("A", "B", "C", "D"):
            tensao_doc_ids.append(f"tensao_recente::{codigo}::{tipo}")
            tensao_doc_ids.append(f"recente_tensao::{codigo}::{tipo}")

    recent_tensao_ts: Dict[str, Tuple[Optional[datetime], Optional[str]]] = {}
    tensao_docs = _fetch_docs_by_ids(tensao_doc_ids, "tensao")
    if debug_out is not None:
        debug_out["tensao_docs"] = len(tensao_docs)
    for doc in tensao_docs:
        doc_id = doc.get("_id", "")
        parts = doc_id.split("::")
        if len(parts) < 3:
            continue
        key = parts[1]
        raw_ts = _extract_ts(doc)
        dt = _parse_any_ts(raw_ts)
        if not dt:
            continue
        prev = recent_tensao_ts.get(key)
        if not prev or prev[0] is None or dt > prev[0]:
            recent_tensao_ts[key] = (dt, raw_ts)

    recents: list[Dict[str, Any]] = []
    for p in pivos:
        pid = p.get("_id", "")
        codigo = p.get("codigo")
        sw_doc = recent_sw_map.get(pid) or (recent_sw_map.get(codigo) if codigo else None)
        sw_data = (sw_doc or {}).get("data") if sw_doc else None
        alarm_count = _count_alarm_sw(sw_data)
        sw_raw_ts = _extract_ts(sw_doc)
        last_sw_at = _format_ts(sw_raw_ts)

        tensao_dt, tensao_raw = recent_tensao_ts.get(pid, (None, None))
        if not tensao_dt and codigo:
            tensao_dt, tensao_raw = recent_tensao_ts.get(codigo, (None, None))
        last_tensao_at = _format_ts(tensao_raw)

        sw_dt = _parse_any_ts(sw_raw_ts)
        last_data_raw = None
        last_data_source = None
        if sw_dt and tensao_dt:
            if sw_dt >= tensao_dt:
                last_data_raw = sw_raw_ts
                last_data_source = "sw"
            else:
                last_data_raw = tensao_raw
                last_data_source = "tensao"
        elif sw_dt:
            last_data_raw = sw_raw_ts
            last_data_source = "sw"
        elif tensao_dt:
            last_data_raw = tensao_raw
            last_data_source = "tensao"

        recents.append({
            "_id": pid,
            "alarm_count": alarm_count or 0,
            "has_alarm": bool(alarm_count and alarm_count > 0),
            "last_sw_at": last_sw_at,
            "last_tensao_at": last_tensao_at,
            "last_data_at": _format_ts(last_data_raw),
            "last_data_source": last_data_source,
            "last_alert_date": last_sw_at,
        })

    if debug_out is not None:
        debug_out["recents_out"] = len(recents)
    return recents


@router.get("", response_model=PivosListResponse)
async def list_pivos(
    user: dict = Depends(get_current_user),
    with_recent: bool = Query(default=False, description="Incluir alarm_count e last_alert_date de cada pivô"),
):
    """Listar pivôs (filtrado por role). Com with_recent=true, retorna status de alarme em batch."""
    db = get_db()
    pivo_service = PivoService(db)
    checker = PermissionChecker(user)

    try:
        pivos = pivo_service.list_pivos(user, checker)

        if with_recent and pivos:
            recents = _build_recent_for_pivos(db, pivos)
            recent_map = {r["_id"]: r for r in recents}
            for p in pivos:
                r = recent_map.get(p.get("_id"))
                if not r:
                    continue
                p.update(r)

            # Ordena: pivôs com alarme primeiro
            pivos.sort(key=lambda p: p.get("alarm_count", 0) or 0, reverse=True)

        return PivosListResponse(total=len(pivos), role=user["type"], pivos=pivos)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_pivo(
    request: CreatePivoRequest, user: dict = Depends(get_current_user)
):
    """Criar novo pivô (admin/superadmin).

    - Se cliente_id informado: associa ao cliente (cnpj_cliente).
    - Se cliente_id vazio: cria pivô próprio do admin/superadmin (sem cliente).
    """
    checker = PermissionChecker(user)
    if not checker.can_create_pivo():
        raise HTTPException(
            status_code=403,
            detail="Seu perfil não possui os privilégios necessários para criar pivôs.",
        )

    if not request.cliente_id:
        # Criar pivô próprio (sem cliente associado)
        # Revenda não pode criar pivô próprio - deve sempre vincular a cliente
        is_revenda = checker.is_revenda()
        if is_revenda:
            raise HTTPException(
                status_code=400,
                detail="Revenda deve obrigatoriamente vincular o pivô a um cliente.",
            )

        user_cnpj = user.get("cnpj")

        if not user_cnpj:
            raise HTTPException(
                status_code=400,
                detail="O CNPJ do utilizador é obrigatório para criar um pivô próprio.",
            )

        # Identificar o perfil para preencher as chaves corretas
        is_admin = checker.is_admin()

        pivo = PivoService(get_db()).create_pivo(
            user=user,
            pivo_data={
                "codigo": request.codigo,
                "nome": request.nome,
                "owner_id": user.get("email"),
                "cnpj_cliente": None,
                "nome_cliente": None,
                # Preenche apenas se for revenda
                "cnpj_revenda": user_cnpj if is_revenda else None,
                "nome_revenda": user.get("name") if is_revenda else None,
                "revenda_id": user.get("doc_id") if is_revenda else None,
                # Preenche apenas se for admin
                "cnpj_admin": user_cnpj if is_admin else None,
                "nome_admin": user.get("name") if is_admin else None,
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
        return {"status": "created", "pivo": pivo}

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

        # Validar que admin/revenda pode criar pivô para este cliente
        is_revenda_user = checker.is_revenda()
        is_admin_user = checker.is_admin()
        is_superadmin = checker.is_superadmin()

        if not is_superadmin:
            cliente_revenda_id = cliente_doc.get("revenda_id")
            cliente_cnpj_admin = cliente_doc.get("cnpj_admin")

            if is_revenda_user:
                # Revenda: cliente deve estar em sua hierarquia
                if cliente_revenda_id != user.get("doc_id"):
                    raise HTTPException(
                        status_code=403,
                        detail="Você não tem permissão para criar pivô para este cliente.",
                    )
            elif is_admin_user:
                # Admin: cliente deve estar em uma de suas revendas
                if cliente_cnpj_admin != user.get("cnpj"):
                    raise HTTPException(
                        status_code=403,
                        detail="Você não tem permissão para criar pivô para este cliente.",
                    )

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


@router.get("/recent", response_model=PivosRecentResponse)
async def get_pivos_recent(
    user: dict = Depends(get_current_user),
    debug: bool = Query(default=False),
):
    """Status recente leve para cards (batch)"""
    db = get_db()
    pivo_service = PivoService(db)
    checker = PermissionChecker(user)

    try:
        pivos = pivo_service.list_pivos(user, checker)
        debug_out: Optional[Dict[str, Any]] = {} if debug else None
        recents = _build_recent_for_pivos(db, pivos, debug_out=debug_out)
        return PivosRecentResponse(
            total=len(recents),
            recents=recents,
            debug=debug_out,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        if request.codigo:
            pivo_data["codigo"] = request.codigo
        if request.irrigador:
            pivo_data["irrigador"] = request.irrigador
        if request.ativo is not None:
            pivo_data["ativo"] = request.ativo
        if request.location:
            pivo_data["location"] = request.location
        if request.equipamentos is not None:
            pivo_data["equipamentos"] = request.equipamentos

        contacts_payload = None
        if request.contacts:
            contacts_payload = request.contacts
        elif request.whatsapp or request.sms or request.email:
            contacts_payload = {
                "whatsapp": request.whatsapp,
                "sms": request.sms,
                "email": request.email,
            }
        if contacts_payload is not None:
            pivo_data["contacts"] = contacts_payload

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
