"""Rotas de administradores (Admin only)"""

import boto3
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import get_users_db
from app.core.config import settings
from app.models.schemas import AdminCreateAdminRequest
from app.services.auth import AuthService
from app.services.permissions import PermissionChecker
from app.utils.cognito_utils import get_secret_hash
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/admins")


@router.get("")
async def list_admins(user: dict = Depends(get_current_user)):
    """Listar admins (admin only)"""
    checker = PermissionChecker(user)
    if not checker.is_admin():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        result = db.find({"selector": {"type": "admin"}, "limit": 500})
        admins = [
            {
                "_id": row.get("_id"),
                "email": row.get("email"),
                "name": row.get("name"),
                "cnpj_admin": row.get("cnpj_admin"),
                "status": row.get("status", "active"),
                "created_at": row.get("created_at"),
            }
            for row in result
        ]
        return {"total": len(admins), "admins": admins}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", status_code=201)
async def create_admin(
    body: AdminCreateAdminRequest, user: dict = Depends(get_current_user)
):
    """Criar novo admin (admin only)"""
    checker = PermissionChecker(user)
    if not checker.is_admin():
        raise HTTPException(status_code=403, detail="Acesso negado")

    doc_id = None
    cognito_client = None

    try:
        # PASSO 1: Criar no CouchDB
        auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)
        result = auth_service.register_admin(
            email=body.email,
            name=body.name,
            password=body.password,
            cnpj_admin=body.cnpj_admin,
            created_by=user.get("email"),
        )

        if result.status == "error":
            raise HTTPException(status_code=400, detail=result.message)

        doc_id = result.document_id

        # PASSO 2: Criar no Cognito
        try:
            cognito_client = boto3.client(
                "cognito-idp", region_name=settings.AWS_REGION
            )

            sign_up_params = {
                "ClientId": settings.COGNITO_CLIENT_ID,
                "Username": body.email,
                "Password": body.password,
                "UserAttributes": [
                    {"Name": "email", "Value": body.email},
                    {"Name": "name", "Value": body.name},
                    {"Name": "custom:type", "Value": "admin"},
                    {"Name": "custom:status", "Value": "active"},
                    {"Name": "custom:cnpj", "Value": body.cnpj_admin},
                    {"Name": "custom:doc_id", "Value": doc_id or ""},
                ],
            }

            secret_hash = get_secret_hash(body.email)
            if secret_hash:
                sign_up_params["SecretHash"] = secret_hash

            cognito_response = cognito_client.sign_up(**sign_up_params)
            cognito_sub = cognito_response.get("UserSub")

            # Atualizar CouchDB com cognito_sub
            try:
                db = get_users_db()
                admin_doc = db.get(doc_id)
                admin_doc["cognito_sub"] = cognito_sub
                db.save(admin_doc)
            except Exception as e:
                print(f"⚠️ Aviso ao atualizar cognito_sub: {e}")

            # Confirmar no Cognito
            try:
                cognito_client.admin_confirm_sign_up(
                    UserPoolId=settings.COGNITO_USER_POOL_ID,
                    Username=body.email,
                )
            except Exception as e:
                print(f"⚠️ Aviso ao confirmar admin no Cognito: {e}")

        except Exception as cognito_error:
            print(f"❌ Erro ao criar admin no Cognito: {cognito_error}")
            # Rollback CouchDB
            try:
                db = get_users_db()
                db.delete(db.get(doc_id))
            except Exception:
                pass
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao sincronizar com Cognito: {str(cognito_error)}",
            )

        return {
            "status": "success",
            "message": "Admin criado com sucesso!",
            "admin_id": doc_id,
            "email": body.email,
            "name": body.name,
            "cnpj_admin": body.cnpj_admin,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar admin: {str(e)}")
