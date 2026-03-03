"""Rotas de revendas (Admin only)"""

import boto3
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import get_db, get_users_db
from app.core.config import settings
from app.models.schemas import (
    RevendasListResponse,
    ApprovalRequest,
    AdminCreateRevendaRequest,
)
from app.services.auth import AuthService
from app.services.permissions import PermissionChecker
from app.services.revenda import RevendaService
from app.utils.validators import validate_password, validate_cnpj_or_cpf, format_cnpj
from app.utils.cognito_utils import get_secret_hash
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/revendas")


@router.get("", response_model=RevendasListResponse)
async def list_revendas(user: dict = Depends(get_current_user)):
    """Listar revendas (admin only) - Filtradas por CNPJ do admin"""
    checker = PermissionChecker(user)
    if not checker.can_manage_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        # Filtrar revendas por cnpj_admin do usuário admin
        admin_cnpj = user.get("cnpj")

        if admin_cnpj:
            # Buscar revendas criadas por este admin (cnpj_admin == admin.cnpj)
            selector = {"type": "revenda", "cnpj_admin": admin_cnpj}
        else:
            # Fallback: se admin não tem CNPJ (admin root), retorna todas
            selector = {"type": "revenda"}

        result = db.find({"selector": selector, "limit": 500})

        revendas = [
            {
                "_id": row.get("_id"),
                "_rev": row.get("_rev"),
                "email": row.get("email"),
                "name": row.get("name"),
                "cnpj_revenda": row.get("cnpj_revenda"),
                "status": row.get("status"),
                "created_at": row.get("created_at"),
            }
            for row in result
        ]
        return RevendasListResponse(total=len(revendas), revendas=revendas)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending")
async def get_pending_revendas(user: dict = Depends(get_current_user)):
    """Listar revendas pendentes (admin only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)
    try:
        pending = auth_service.get_pending_revendas()
        return {"total": len(pending), "revendas": pending}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", status_code=201)
async def create_revenda_admin(
    body: AdminCreateRevendaRequest, user: dict = Depends(get_current_user)
):
    """Criar revenda (admin only - criada já com status active)"""
    checker = PermissionChecker(user)
    if not checker.can_manage_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Validar senha
    is_valid_password, password_error = validate_password(body.password)
    if not is_valid_password:
        raise HTTPException(status_code=400, detail=password_error)

    # Validar CNPJ ou CPF da revenda
    print(f"📝 DEBUG: Recebido cnpj_revenda = '{body.cnpj_revenda}'")
    is_valid_doc, doc_error = validate_cnpj_or_cpf(body.cnpj_revenda)
    if not is_valid_doc:
        raise HTTPException(status_code=400, detail=doc_error)

    # Formatar CNPJ da revenda
    cnpj_revenda_formatted = format_cnpj(body.cnpj_revenda)
    print(f"📝 DEBUG: CNPJ formatado = '{cnpj_revenda_formatted}'")

    doc_id = None
    cognito_client = None

    try:
        # ✅ PASSO 1: Criar documento no CouchDB PRIMEIRO (sem Cognito Sub ainda)
        print(f"📝 DEBUG: Criando revenda no CouchDB...")
        revenda_service = RevendaService(
            settings.COUCHDB_URL,
            settings.COUCHDB_USERS_DB,
            cognito_region=settings.AWS_REGION,
            cognito_pool_id=settings.COGNITO_USER_POOL_ID,
        )

        success, msg, doc_id = revenda_service.create_revenda_couchdb(
            email=body.email,
            name=body.name,
            cnpj_revenda=cnpj_revenda_formatted,
            cognito_sub=None,  # Será preenchido depois
            initial_status="pending",  # ✅ Sempre pending, admin precisa aprovar depois
            cnpj_admin=body.cnpj_admin,
        )

        if not success:
            print(f"❌ ERRO ao criar revenda no CouchDB: {msg}")
            raise HTTPException(status_code=400, detail=msg)

        print(f"✅ Revenda criada no CouchDB: {doc_id}")

        # ✅ PASSO 2: Criar usuário no Cognito (DEPOIS de CouchDB funcionar)
        try:
            cognito_client = boto3.client(
                "cognito-idp", region_name=settings.AWS_REGION
            )

            # ✅ Passar custom attributes JÁ no sign_up
            sign_up_params = {
                "ClientId": settings.COGNITO_CLIENT_ID,
                "Username": body.email,
                "Password": body.password,
                "UserAttributes": [
                    {"Name": "email", "Value": body.email},
                    {"Name": "name", "Value": body.name},
                    {"Name": "custom:type", "Value": "revenda"},
                    {"Name": "custom:status", "Value": "pending"},
                    {"Name": "custom:cnpj", "Value": cnpj_revenda_formatted},
                    {"Name": "custom:doc_id", "Value": doc_id},
                ],
            }

            secret_hash = get_secret_hash(body.email)
            if secret_hash:
                sign_up_params["SecretHash"] = secret_hash

            cognito_response = cognito_client.sign_up(**sign_up_params)
            cognito_sub = cognito_response.get("UserSub")
            print(f"✅ Usuário criado no Cognito: {cognito_sub}")
            print(
                f"✅ Custom attributes salvos: type=revenda, status=pending, cnpj={cnpj_revenda_formatted}, doc_id={doc_id}"
            )

            # ✅ PASSO 3: Atualizar revenda no CouchDB com cognito_sub
            try:
                revenda_doc = revenda_service.db.get(doc_id)
                revenda_doc["cognito_sub"] = cognito_sub
                revenda_doc["cognito_synced"] = True
                revenda_service.db.save(revenda_doc)
                print(f"✅ Cognito Sub atualizado no CouchDB")
            except Exception as e:
                print(f"⚠️ Aviso ao atualizar cognito_sub: {e}")

            # ✅ PASSO 4: Confirmar usuário no Cognito automaticamente
            try:
                cognito_client.admin_confirm_sign_up(
                    UserPoolId=settings.COGNITO_USER_POOL_ID, Username=body.email
                )
                print(f"✅ Usuário confirmado no Cognito")
            except Exception as e:
                print(f"⚠️ Aviso ao confirmar usuário: {e}")
                # Continua mesmo se falhar - custom attributes já foram salvos no sign_up

            # ✅ PASSO 5: Atualizar admin.revendas[] com o cnpj_revenda
            try:
                admin_doc_id = user.get("doc_id")
                if admin_doc_id:
                    admin_doc = revenda_service.db.get(admin_doc_id)
                    if admin_doc:
                        revendas_list = admin_doc.get("revendas", [])
                        if cnpj_revenda_formatted not in revendas_list:
                            revendas_list.append(cnpj_revenda_formatted)
                            admin_doc["revendas"] = revendas_list
                            revenda_service.db.save(admin_doc)
                            print(
                                f"✅ Admin.revendas[] atualizado com {cnpj_revenda_formatted}"
                            )
            except Exception as e:
                print(f"⚠️ Aviso ao atualizar admin.revendas[]: {e}")

            return {
                "status": "success",
                "message": "Revenda criada com sucesso!",
                "revenda_id": doc_id,
                "email": body.email,
                "name": body.name,
                "cnpj": cnpj_revenda_formatted,
                "status_code": 201,
            }

        except Exception as cognito_error:
            print(f"❌ ERRO ao criar revenda no Cognito: {str(cognito_error)}")
            print(f"   Fazendo rollback no CouchDB...")

            # ❌ ROLLBACK: Deletar do CouchDB se Cognito falhar
            try:
                revenda_service.db.delete(revenda_service.db.get(doc_id))
                print(f"✅ Revenda deletada do CouchDB (rollback)")
            except Exception as rollback_error:
                print(f"❌ Erro ao fazer rollback no CouchDB: {rollback_error}")

            raise HTTPException(
                status_code=500,
                detail=f"Erro ao sincronizar com Cognito. Revenda não foi criada: {str(cognito_error)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERRO geral: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao criar revenda: {str(e)}")


@router.post("/{email}/approve")
async def approve_revenda(email: str, user: dict = Depends(get_current_user)):
    """Aprovar revenda (admin only) - muda status de pending para active"""
    checker = PermissionChecker(user)
    if not checker.can_approve_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    revenda_service = RevendaService(
        settings.COUCHDB_URL,
        settings.COUCHDB_USERS_DB,
        cognito_region=settings.AWS_REGION,
        cognito_pool_id=settings.COGNITO_USER_POOL_ID,
    )

    try:
        # 1. Aprovar no CouchDB
        success, msg = revenda_service.approve_revenda(email)
        if not success:
            raise HTTPException(status_code=400, detail=msg)

        # 2. Atualizar status no Cognito também
        try:
            cognito_client = boto3.client(
                "cognito-idp", region_name=settings.AWS_REGION
            )
            cognito_client.admin_update_user_attributes(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=email,
                UserAttributes=[{"Name": "custom:status", "Value": "active"}],
            )
            print(f"✅ Status atualizado no Cognito para {email}")
        except Exception as cognito_err:
            print(f"⚠️ Aviso ao atualizar Cognito: {cognito_err}")
            # Continua mesmo se Cognito falhar, pois CouchDB já foi atualizado

        return {"status": "success", "message": msg}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao aprovar revenda: {str(e)}"
        )


@router.post("/{email}/reject")
async def reject_revenda(email: str, user: dict = Depends(get_current_user)):
    """Rejeitar revenda (admin only) - muda status de pending para rejected"""
    checker = PermissionChecker(user)
    if not checker.can_approve_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    revenda_service = RevendaService(
        settings.COUCHDB_URL,
        settings.COUCHDB_USERS_DB,
        cognito_region=settings.AWS_REGION,
        cognito_pool_id=settings.COGNITO_USER_POOL_ID,
    )

    try:
        # 1. Rejeitar no CouchDB
        success, msg = revenda_service.reject_revenda(email)
        if not success:
            raise HTTPException(status_code=400, detail=msg)

        # 2. Atualizar status no Cognito também
        try:
            cognito_client = boto3.client(
                "cognito-idp", region_name=settings.AWS_REGION
            )
            cognito_client.admin_update_user_attributes(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=email,
                UserAttributes=[{"Name": "custom:status", "Value": "rejected"}],
            )
            print(f"✅ Status atualizado no Cognito para {email}")
        except Exception as cognito_err:
            print(f"⚠️ Aviso ao atualizar Cognito: {cognito_err}")
            # Continua mesmo se Cognito falhar, pois CouchDB já foi atualizado

        return {"status": "success", "message": msg}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao rejeitar revenda: {str(e)}"
        )
