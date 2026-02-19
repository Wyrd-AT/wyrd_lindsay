"""Rotas de clientes (Revenda e Admin)"""

import boto3
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import get_db, get_users_db
from app.core.config import settings
from app.models.schemas import ClientesListResponse, AdminCreateClienteRequest
from app.services.auth import AuthService
from app.services.permissions import PermissionChecker
from app.utils.validators import validate_password, validate_email, validate_name
from app.utils.cognito_utils import get_secret_hash
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/clientes")


@router.get("", response_model=ClientesListResponse)
async def list_clientes(user: dict = Depends(get_current_user)):
    """Listar clientes - Para admin, busca clientes de todas as suas revendas"""
    checker = PermissionChecker(user)
    if not checker.can_view_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db_conn = get_users_db()
    try:
        if user.get("type") == "admin":
            # Admin: busca clientes de todas as suas revendas
            admin_cnpj = user.get("cnpj")

            if admin_cnpj:
                # 1. Buscar revendas do admin (cnpj_admin == admin.cnpj)
                revendas = list(db_conn.find({
                    "selector": {"type": "revenda", "cnpj_admin": admin_cnpj},
                    "limit": 500
                }))
            else:
                # Fallback: admin root (sem cnpj) vê todas as revendas
                revendas = list(db_conn.find({
                    "selector": {"type": "revenda"},
                    "limit": 500
                }))

            revenda_ids = [r.get("_id") for r in revendas]

            # 2. Buscar clientes cujo revenda_id está na lista de revendas
            if revenda_ids:
                clientes_raw = list(db_conn.find({
                    "selector": {"type": "cliente", "revenda_id": {"$in": revenda_ids}},
                    "limit": 1000
                }))
            else:
                clientes_raw = []

            # 3. Formatar resposta
            clientes = [
                {
                    "_id": c.get("_id"),
                    "_rev": c.get("_rev"),
                    "email": c.get("email"),
                    "name": c.get("name"),
                    "status": c.get("status"),
                    "revenda_id": c.get("revenda_id"),
                    "created_at": c.get("created_at"),
                }
                for c in clientes_raw
            ]
        else:
            # Revenda: usa fluxo existente (busca clientes desta revenda)
            auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)
            clientes = auth_service.get_revenda_clientes(user["email"])

        return ClientesListResponse(total=len(clientes), clientes=clientes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending")
async def get_pending_clientes(user: dict = Depends(get_current_user)):
    """Listar clientes pendentes (revenda only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)
    try:
        pending = auth_service.get_pending_clientes(user["email"])
        return {"total": len(pending), "clientes": pending}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", status_code=201)
async def create_cliente_admin(body: AdminCreateClienteRequest, user: dict = Depends(get_current_user)):
    """Criar cliente (admin only - criado já com status active)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Validar email e nome
    is_valid_email, email_error = validate_email(body.email)
    if not is_valid_email:
        raise HTTPException(status_code=400, detail=email_error)

    is_valid_name, name_error = validate_name(body.name)
    if not is_valid_name:
        raise HTTPException(status_code=400, detail=name_error)

    # Validar senha
    is_valid_password, password_error = validate_password(body.password)
    if not is_valid_password:
        raise HTTPException(status_code=400, detail=password_error)

    cognito_client = None
    cognito_sub = None
    try:
        # 1. Criar usuário no Cognito
        cognito_client = boto3.client('cognito-idp', region_name=settings.AWS_REGION)

        # Preparar parâmetros do sign_up
        sign_up_params = {
            "ClientId": settings.COGNITO_CLIENT_ID,
            "Username": body.email,
            "Password": body.password,
            "UserAttributes": [
                {"Name": "email", "Value": body.email},
                {"Name": "name", "Value": body.name}
            ]
        }

        # Adicionar SecretHash se o cliente tem um secret configurado
        secret_hash = get_secret_hash(body.email)
        if secret_hash:
            sign_up_params["SecretHash"] = secret_hash

        response = cognito_client.sign_up(**sign_up_params)
        cognito_sub = response.get("UserSub")

        # 2. Criar documento no CouchDB (banco de usuários)
        try:
            db = get_users_db()
            doc_id = f"user:{body.email}"

            cliente_doc = {
                "_id": doc_id,
                "type": "cliente",
                "email": body.email,
                "name": body.name,
                "status": "active",  # Admin cria direto como ativo
                "created_at": datetime.utcnow().isoformat(),
                "cognito_sub": cognito_sub,
                "revenda_id": body.revenda_id or None,  # Pode ser None se admin não atribuir
            }

            db.save(cliente_doc)
        except Exception as e:
            print(f"❌ EXCEÇÃO ao criar cliente no CouchDB: {str(e)}")
            import traceback
            traceback.print_exc()

            # Rollback: deletar do Cognito se falhar no CouchDB
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID,
                    Username=body.email
                )
            except:
                pass
            raise HTTPException(status_code=500, detail=f"Erro ao criar cliente no CouchDB: {str(e)}")

        # 3. Confirmar usuário automaticamente
        try:
            cognito_client.admin_confirm_sign_up(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=body.email
            )
        except Exception as e:
            print(f"Aviso ao confirmar usuário: {e}")

        # 4. Atualizar custom attributes (apenas o mínimo necessário)
        custom_attributes = {
            "custom:type": "cliente",
            "custom:status": "active",
        }

        try:
            # Converter valores para string e validar
            user_attributes = [
                {"Name": key, "Value": str(value)}
                for key, value in custom_attributes.items()
                if value is not None
            ]

            print(f"📝 Atualizando custom attributes para {body.email}...")
            print(f"   Atributos: {user_attributes}")

            cognito_client.admin_update_user_attributes(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=body.email,
                UserAttributes=user_attributes
            )
            print(f"✅ Custom attributes atualizados com sucesso!")

        except Exception as e:
            print(f"❌ ERRO ao atualizar custom attributes: {e}")
            print(f"   User Pool ID: {settings.COGNITO_USER_POOL_ID}")
            print(f"   Username: {body.email}")
            print(f"   Erro detalhado: {str(e)}")
            # Não fazer rollback aqui, pois o usuário já foi criado
            # Apenas avisar o desenvolvedor

        return {
            "status": "success",
            "message": "Cliente criado com sucesso!",
            "cliente_id": doc_id,
            "email": body.email,
            "name": body.name,
            "revenda_id": body.revenda_id,
            "status_code": 201
        }

    except HTTPException:
        raise
    except Exception as e:
        # Rollback se algo der errado
        if cognito_client and cognito_sub:
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID,
                    Username=body.email
                )
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Erro ao criar cliente: {str(e)}")


@router.post("/{email}/approve")
async def approve_cliente(email: str, user: dict = Depends(get_current_user)):
    """Aprovar cliente (revenda only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)
    try:
        cliente = auth_service.approve_cliente(email, user["email"])
        return {"status": "approved", "cliente": cliente}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{email}/reject")
async def reject_cliente(email: str, user: dict = Depends(get_current_user)):
    """Rejeitar cliente (revenda only)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)
    try:
        cliente = auth_service.reject_cliente(email, user["email"])
        return {"status": "rejected", "cliente": cliente}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
