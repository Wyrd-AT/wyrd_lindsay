"""Rotas de clientes (Revenda e Admin)"""

import boto3
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.aws import get_cognito_client
from app.core.database import get_db, get_users_db
from app.core.config import settings
from app.models.schemas import (
    ClientesListResponse,
    AdminCreateClienteRequest,
    SuperusuarioCreateUserRequest,
)
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
                revendas = list(
                    db_conn.find(
                        {
                            "selector": {"type": "revenda", "cnpj_admin": admin_cnpj},
                            "limit": 500,
                        }
                    )
                )
            else:
                # Fallback: admin root (sem cnpj) vê todas as revendas
                revendas = list(
                    db_conn.find({"selector": {"type": "revenda"}, "limit": 500})
                )

            revenda_ids = [r.get("_id") for r in revendas]

            # 2. Buscar clientes cujo revenda_id está na lista de revendas
            if revenda_ids:
                clientes_raw = list(
                    db_conn.find(
                        {
                            "selector": {
                                "type": "cliente",
                                "revenda_id": {"$in": revenda_ids},
                            },
                            "limit": 1000,
                        }
                    )
                )
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
                    "cnpj_cliente": c.get("cnpj_cliente"),
                    "cnpj_admin": c.get("cnpj_admin"),
                    "cnpj_revenda": c.get("cnpj_revenda"),
                    "sub_role": c.get("sub_role"),
                    "irrigadores": c.get("irrigadores", []),
                    "created_at": c.get("created_at"),
                }
                for c in clientes_raw
            ]
        else:
            # Revenda: busca clientes cujo revenda_id == doc_id da revenda
            revenda_doc_id = user.get("doc_id")
            if revenda_doc_id:
                clientes_raw = list(
                    db_conn.find(
                        {
                            "selector": {
                                "type": "cliente",
                                "revenda_id": revenda_doc_id,
                            },
                            "limit": 1000,
                        }
                    )
                )
            else:
                clientes_raw = []

            clientes = [
                {
                    "_id": c.get("_id"),
                    "_rev": c.get("_rev"),
                    "email": c.get("email"),
                    "name": c.get("name"),
                    "status": c.get("status"),
                    "revenda_id": c.get("revenda_id"),
                    "cnpj_cliente": c.get("cnpj_cliente"),
                    "cnpj_admin": c.get("cnpj_admin"),
                    "cnpj_revenda": c.get("cnpj_revenda"),
                    "sub_role": c.get("sub_role"),
                    "irrigadores": c.get("irrigadores", []),
                    "created_at": c.get("created_at"),
                }
                for c in clientes_raw
            ]

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
async def create_cliente_admin(
    body: AdminCreateClienteRequest,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Criar cliente (admin ou revenda - criado já com status active)"""
    checker = PermissionChecker(user)
    if not checker.can_approve_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Revenda só pode criar clientes vinculados a si mesma
    # Usar doc_id real da revenda (formato: revenda:{uuid}), não user:{email}
    if user.get("type") == "revenda":
        body.revenda_id = user.get("doc_id")

    # Resolver cnpj_admin e cnpj_revenda da hierarquia
    cnpj_admin = None
    cnpj_revenda = None
    try:
        _db = get_users_db()
        if user.get("type") == "admin":
            cnpj_admin = user.get("cnpj")
            if body.revenda_id:
                revenda_doc = _db.get(body.revenda_id)
                if revenda_doc:
                    cnpj_revenda = revenda_doc.get("cnpj_revenda") or revenda_doc.get(
                        "cnpj"
                    )
        elif user.get("type") == "revenda":
            # Buscar documento da revenda pelo doc_id real (revenda:{uuid})
            revenda_doc_id = user.get("doc_id")
            if revenda_doc_id:
                revenda_doc = _db.get(revenda_doc_id)
                if revenda_doc:
                    cnpj_admin = revenda_doc.get("cnpj_admin")
                    cnpj_revenda = revenda_doc.get("cnpj_revenda") or revenda_doc.get(
                        "cnpj"
                    )
                    print(
                        f"✅ CNPJs resolvidos: admin={cnpj_admin}, revenda={cnpj_revenda}"
                    )
    except Exception as e:
        print(f"⚠️ Erro ao resolver CNPJs da hierarquia: {e}")
        # CNPJs ficam None se não encontrado, não bloqueia a criação

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

    cognito_sub = None
    try:
        create_response = cognito_client.admin_create_user(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=body.email,
            UserAttributes=[
                {"Name": "email", "Value": body.email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": body.name},
                {"Name": "custom:type", "Value": "cliente"},
                {"Name": "custom:status", "Value": "active"},
                {"Name": "custom:cnpj", "Value": body.cnpj_cliente or ""},
                {"Name": "custom:doc_id", "Value": f"user:{body.email}"},
                # sub_role fica apenas no CouchDB; Cognito não tem custom:sub_role no schema
            ],
            MessageAction="SUPPRESS",  # Não envia email/SMS ao cliente
        )
        cognito_sub = create_response["User"]["Username"]
        print(
            f"✅ Usuário cliente criado no Cognito (admin_create_user): {cognito_sub}"
        )

        # Definir senha permanente (sem forçar troca no primeiro login)
        cognito_client.admin_set_user_password(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=body.email,
            Password=body.password,
            Permanent=True,
        )
        print(f"✅ Senha definida para o cliente")

        # 2. Criar documento no CouchDB (banco de usuários)
        try:
            db = get_users_db()
            doc_id = f"user:{body.email}"

            now = datetime.utcnow().isoformat()
            cliente_doc = {
                "_id": doc_id,
                "type": "cliente",
                "email": body.email,
                "name": body.name,
                "status": "active",  # Admin/revenda cria direto como ativo
                "created_at": now,
                "approved_at": now,  # Criado por admin/revenda = aprovado imediatamente
                "cognito_sub": cognito_sub,
                "cognito_synced": True,
                "revenda_id": body.revenda_id or None,
                "cnpj_cliente": body.cnpj_cliente,  # CNPJ do cliente
                "cnpj_admin": cnpj_admin,  # Herdado do admin
                "cnpj_revenda": cnpj_revenda,  # Herdado da revenda associada
                "sub_role": body.sub_role or "superusuario",  # Sub-role do cliente
                "irrigadores": [],  # Inicializa vazio, será preenchido depois
            }

            db.save(cliente_doc)

            # ✅ Atualizar revenda.clientes[] com o cnpj_cliente
            if body.revenda_id and body.cnpj_cliente:
                try:
                    revenda_doc = db.get(body.revenda_id)
                    if revenda_doc:
                        clientes_list = revenda_doc.get("clientes", [])
                        if body.cnpj_cliente not in clientes_list:
                            clientes_list.append(body.cnpj_cliente)
                            revenda_doc["clientes"] = clientes_list
                            db.save(revenda_doc)
                            print(
                                f"✅ Revenda.clientes[] atualizado com {body.cnpj_cliente}"
                            )
                except Exception as e:
                    print(f"⚠️ Aviso ao atualizar revenda.clientes[]: {e}")
        except Exception as e:
            print(f"❌ EXCEÇÃO ao criar cliente no CouchDB: {str(e)}")
            import traceback

            traceback.print_exc()

            # Rollback: deletar do Cognito se falhar no CouchDB
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID, Username=body.email
                )
            except:
                pass
            raise HTTPException(
                status_code=500, detail=f"Erro ao criar cliente no CouchDB: {str(e)}"
            )

        # ✅ Usuário já criado e confirmado via admin_create_user + admin_set_user_password
        return {
            "status": "success",
            "message": "Cliente criado com sucesso!",
            "cliente_id": doc_id,
            "email": body.email,
            "name": body.name,
            "revenda_id": body.revenda_id,
            "status_code": 201,
        }

    except HTTPException:
        raise
    except Exception as e:
        # Rollback se algo der errado
        if cognito_client and cognito_sub:
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID, Username=body.email
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


# ============================================================================
# Endpoints de Company Users (Superusuário gerencia gerentes/comuns)
# ============================================================================


@router.get("/company-users")
async def list_company_users(user: dict = Depends(get_current_user)):
    """Listar usuários da mesma empresa (mesmo cnpj_cliente) - apenas superusuário"""
    checker = PermissionChecker(user)
    if not checker.can_manage_company_users():
        raise HTTPException(
            status_code=403,
            detail="Apenas superusuários podem gerenciar usuários da empresa",
        )

    db = get_users_db()
    su_doc = db.get(user.get("doc_id"))
    if not su_doc:
        raise HTTPException(
            status_code=404, detail="Documento do superusuário não encontrado"
        )

    cnpj = su_doc.get("cnpj_cliente")
    if not cnpj:
        raise HTTPException(
            status_code=400, detail="Superusuário sem cnpj_cliente definido"
        )

    users_raw = list(
        db.find({"selector": {"type": "cliente", "cnpj_cliente": cnpj}, "limit": 500})
    )

    users = [
        {
            "_id": u.get("_id"),
            "email": u.get("email"),
            "name": u.get("name"),
            "status": u.get("status"),
            "sub_role": u.get("sub_role", "superusuario"),
            "created_at": u.get("created_at"),
        }
        for u in users_raw
    ]

    return {"total": len(users), "users": users}


@router.post("/company-users", status_code=201)
async def create_company_user(
    body: SuperusuarioCreateUserRequest,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Superusuário cria gerente ou comum dentro da sua empresa"""
    checker = PermissionChecker(user)
    if not checker.can_manage_company_users():
        raise HTTPException(
            status_code=403, detail="Apenas superusuários podem criar usuários"
        )

    # Buscar dados do superusuário para herdar hierarquia
    db = get_users_db()
    su_doc = db.get(user.get("doc_id"))
    if not su_doc:
        raise HTTPException(
            status_code=404, detail="Documento do superusuário não encontrado"
        )

    cnpj_cliente = su_doc.get("cnpj_cliente")
    revenda_id = su_doc.get("revenda_id")
    cnpj_revenda = su_doc.get("cnpj_revenda")
    cnpj_admin = su_doc.get("cnpj_admin")

    if not cnpj_cliente:
        raise HTTPException(
            status_code=400, detail="Superusuário sem cnpj_cliente definido"
        )

    # Validações
    is_valid_email, email_error = validate_email(body.email)
    if not is_valid_email:
        raise HTTPException(status_code=400, detail=email_error)

    is_valid_name, name_error = validate_name(body.name)
    if not is_valid_name:
        raise HTTPException(status_code=400, detail=name_error)

    is_valid_password, password_error = validate_password(body.password)
    if not is_valid_password:
        raise HTTPException(status_code=400, detail=password_error)

    cognito_sub = None
    try:
        create_response = cognito_client.admin_create_user(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=body.email,
            UserAttributes=[
                {"Name": "email", "Value": body.email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "name", "Value": body.name},
                {"Name": "custom:type", "Value": "cliente"},
                {"Name": "custom:status", "Value": "active"},
                {"Name": "custom:cnpj", "Value": cnpj_cliente},
                {"Name": "custom:doc_id", "Value": f"user:{body.email}"},
                # sub_role fica apenas no CouchDB; Cognito não tem custom:sub_role no schema
            ],
            MessageAction="SUPPRESS",
        )
        cognito_sub = create_response["User"]["Username"]

        # Definir senha permanente
        cognito_client.admin_set_user_password(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=body.email,
            Password=body.password,
            Permanent=True,
        )

        # 2. Criar documento no CouchDB
        doc_id = f"user:{body.email}"
        now = datetime.utcnow().isoformat()

        cliente_doc = {
            "_id": doc_id,
            "type": "cliente",
            "email": body.email,
            "name": body.name,
            "status": "active",
            "sub_role": body.sub_role,
            "created_at": now,
            "approved_at": now,
            "created_by": user.get("email"),
            "cognito_sub": cognito_sub,
            "cognito_synced": True,
            "revenda_id": revenda_id,
            "cnpj_cliente": cnpj_cliente,
            "cnpj_admin": cnpj_admin,
            "cnpj_revenda": cnpj_revenda,
            "irrigadores": [],
        }

        db.save(cliente_doc)

        return {
            "status": "success",
            "message": f"Usuário {body.sub_role} criado com sucesso!",
            "cliente_id": doc_id,
            "email": body.email,
            "name": body.name,
            "sub_role": body.sub_role,
        }

    except HTTPException:
        raise
    except Exception as e:
        if cognito_client and cognito_sub:
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID, Username=body.email
                )
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Erro ao criar usuário: {str(e)}")
