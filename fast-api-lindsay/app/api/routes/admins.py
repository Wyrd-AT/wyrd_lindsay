"""Rotas de administradores (Admin only)"""

import boto3
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import get_users_db
from app.core.config import settings
from app.models.schemas import AdminCreateAdminRequest, AdminUpdateRequest
from app.services.auth import AuthService
from app.services.permissions import PermissionChecker
from app.api.routes.auth import get_current_user

from app.core.aws import get_cognito_client

router = APIRouter(prefix="/admins")


@router.get("")
async def list_admins(user: dict = Depends(get_current_user)):
    """Listar admins (admin only)"""
    checker = PermissionChecker(user)
    if not checker.is_admin():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        # Superadmin vê todos os admins, admin regular vê apenas sua equipe
        if checker.is_superadmin():
            selector = {"type": {"$in": ["admin", "superadmin"]}}
        else:
            selector = {"type": "admin", "cnpj_admin": user["cnpj"]}
        result = db.find({"selector": selector, "limit": 500})
        admins = [
            {
                "_id": row.get("_id"),
                "email": row.get("email"),
                "name": row.get("name"),
                "type": row.get("type"),
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
    body: AdminCreateAdminRequest,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Criar novo admin ou superadmin (admin/superadmin only)"""
    checker = PermissionChecker(user)
    if not checker.is_admin():
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Superadmin pode escolher o tipo; admin regular sempre cria admin da mesma equipe
    if checker.is_superadmin():
        new_type = body.new_type if body.new_type in ("superadmin", "admin") else "superadmin"
        # Superadmin criando admin externo: usa cnpj_admin do body
        # Superadmin criando superadmin (mesma equipe): herda o próprio cnpj
        if new_type == "admin" and body.cnpj_admin:
            cnpj_admin = body.cnpj_admin
        else:
            cnpj_admin = user["cnpj"]
    else:
        new_type = "admin"
        cnpj_admin = user["cnpj"]
    doc_id = None

    try:
        # PASSO 1: Criar no CouchDB
        auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)
        result = auth_service.register_admin(
            email=body.email,
            name=body.name,
            password=body.password,
            cnpj_admin=cnpj_admin,
            created_by=user.get("email"),
            user_type=new_type,
        )

        if result.status == "error":
            raise HTTPException(status_code=400, detail=result.message)

        doc_id = result.document_id

        # PASSO 2: Criar no Cognito
        try:
            sign_up_params = {
                "ClientId": settings.COGNITO_CLIENT_ID,
                "Username": body.email,
                "Password": body.password,
                "UserAttributes": [
                    {"Name": "email", "Value": body.email},
                    {"Name": "name", "Value": body.name},
                    {"Name": "custom:type", "Value": new_type},
                    {"Name": "custom:status", "Value": "active"},
                    {"Name": "custom:cnpj", "Value": cnpj_admin},
                    {"Name": "custom:doc_id", "Value": doc_id or ""},
                ],
            }

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
            "message": f"{'Superadmin' if new_type == 'superadmin' else 'Admin'} criado com sucesso!",
            "admin_id": doc_id,
            "email": body.email,
            "name": body.name,
            "type": new_type,
            "cnpj_admin": cnpj_admin,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar admin: {str(e)}")


@router.put("/{admin_id}")
async def update_admin(
    admin_id: str,
    body: AdminUpdateRequest,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Atualizar admin/superadmin. Superadmin pode editar qualquer admin."""
    checker = PermissionChecker(user)
    if not checker.is_admin():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        target = db.get(admin_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Admin não encontrado")

    if target.get("type") not in ("admin", "superadmin"):
        raise HTTPException(status_code=404, detail="Admin não encontrado")

    # Admin regular só pode editar admins da própria equipe e nunca superadmin
    if not checker.is_superadmin():
        if target.get("type") == "superadmin":
            raise HTTPException(
                status_code=403, detail="Apenas superadmin pode editar superadmin"
            )
        if target.get("cnpj_admin") != user.get("cnpj"):
            raise HTTPException(status_code=403, detail="Acesso negado")

    changed = False
    cognito_attrs = []

    if body.name is not None and body.name != target.get("name"):
        target["name"] = body.name
        cognito_attrs.append({"Name": "name", "Value": body.name})
        changed = True

    if body.status is not None and body.status != target.get("status"):
        target["status"] = body.status
        cognito_attrs.append({"Name": "custom:status", "Value": body.status})
        changed = True

    if body.cnpj_admin is not None and body.cnpj_admin != target.get("cnpj_admin"):
        # Apenas superadmin pode trocar cnpj_admin do admin
        if not checker.is_superadmin():
            raise HTTPException(
                status_code=403, detail="Apenas superadmin pode alterar CNPJ do admin"
            )
        target["cnpj_admin"] = body.cnpj_admin
        cognito_attrs.append({"Name": "custom:cnpj", "Value": body.cnpj_admin})
        changed = True

    if not changed:
        return {"status": "success", "message": "Nenhuma alteração aplicada", "admin": target}

    db.save(target)

    try:
        if cognito_attrs and target.get("email"):
            cognito_client.admin_update_user_attributes(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=target["email"],
                UserAttributes=cognito_attrs,
            )
    except Exception as e:
        print(f"⚠️ Aviso ao atualizar Cognito (admin): {e}")

    return {"status": "success", "message": "Admin atualizado com sucesso", "admin": target}


@router.delete("/{admin_id}")
async def delete_admin(
    admin_id: str,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Deletar admin/superadmin. Superadmin pode deletar qualquer admin."""
    checker = PermissionChecker(user)
    if not checker.is_admin():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        target = db.get(admin_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Admin não encontrado")

    if target.get("type") not in ("admin", "superadmin"):
        raise HTTPException(status_code=404, detail="Admin não encontrado")

    if not checker.is_superadmin():
        if target.get("type") == "superadmin":
            raise HTTPException(
                status_code=403, detail="Apenas superadmin pode deletar superadmin"
            )
        if target.get("cnpj_admin") != user.get("cnpj"):
            raise HTTPException(status_code=403, detail="Acesso negado")

    # Evita auto-exclusão acidental
    if target.get("email") == user.get("email"):
        raise HTTPException(status_code=400, detail="Não é permitido deletar o próprio usuário")

    try:
        if target.get("email"):
            cognito_client.admin_delete_user(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=target["email"],
            )
    except Exception as e:
        print(f"⚠️ Aviso ao remover usuário do Cognito (admin): {e}")

    db.delete(target)
    return {"status": "success", "message": "Admin deletado com sucesso"}
