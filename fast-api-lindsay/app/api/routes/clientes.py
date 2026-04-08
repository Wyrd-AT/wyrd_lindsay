"""Rotas de clientes (Revenda e Admin)"""

import boto3
from botocore.exceptions import ClientError
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.aws import get_cognito_client
from app.core.database import get_db, get_users_db
from app.core.config import settings
from app.models.schemas import (
    ClientesListResponse,
    AdminCreateClienteRequest,
    SuperusuarioCreateUserRequest,
    ClienteUpdateRequest,
)
from app.services.auth import AuthService
from app.services.permissions import PermissionChecker
from app.utils.validators import validate_password, validate_email, validate_name
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/clientes")


def _can_manage_cliente_target(
    checker: PermissionChecker, user: dict, cliente_doc: dict
) -> bool:
    """Regra de escopo para editar/deletar clientes."""
    if checker.is_superadmin():
        return True
    if checker.is_admin_only():
        return cliente_doc.get("cnpj_admin") == user.get("cnpj")
    if checker.is_revenda():
        return cliente_doc.get("revenda_id") == user.get("doc_id")
    return False


def _raise_cognito_http_error(exc: ClientError) -> None:
    """Converte erros comuns do Cognito para respostas HTTP mais claras."""
    error = (exc.response or {}).get("Error", {})
    code = error.get("Code", "CognitoError")
    message = error.get("Message", str(exc))

    if code in {
        "UnrecognizedClientException",
        "InvalidClientTokenId",
        "ExpiredTokenException",
    }:
        raise HTTPException(
            status_code=502,
            detail="Falha de autenticação com AWS Cognito (credenciais/token inválidos no backend).",
        )

    if code in {"UsernameExistsException", "AliasExistsException"}:
        raise HTTPException(status_code=409, detail="Email já cadastrado no Cognito.")

    raise HTTPException(
        status_code=502,
        detail=f"Erro de integração com Cognito ({code}): {message}",
    )


@router.get("")
async def list_clientes(user: dict = Depends(get_current_user)):
    """Listar clientes - Para admin, busca todos. Para revenda, busca os seus."""
    checker = PermissionChecker(user)
    if not checker.can_view_clientes():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db_conn = get_users_db()
    try:
        if checker.is_superadmin():
            # Superadmin: Busca absolutamente TODOS os clientes do banco
            clientes_raw = list(
                db_conn.find({"selector": {"type": "cliente"}, "limit": 2000})
            )
        elif checker.is_admin_only():
            # Admin regular: Busca clientes vinculados ao seu cnpj_admin
            clientes_raw = list(
                db_conn.find(
                    {
                        "selector": {"type": "cliente", "cnpj_admin": user["cnpj"]},
                        "limit": 2000,
                    }
                )
            )
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

        # Formatar resposta
        clientes = [
            {
                "id": c.get("_id"),
                "doc_id": c.get("_id"),
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

        return {"total": len(clientes), "clientes": clientes}
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
    if not checker.can_create_cliente():
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Revenda só pode criar clientes vinculados a si mesma
    # Usar doc_id real da revenda (formato: revenda:{uuid}), não user:{email}
    if user.get("type") == "revenda":
        body.revenda_id = user.get("doc_id")
    elif user.get("type") == "admin":
        if not body.revenda_id:
            raise HTTPException(
                status_code=400,
                detail="A seleção de uma revenda é obrigatória ao criar um cliente.",
            )

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
                {"Name": "phone_number", "Value": body.phone_number},
                {"Name": "custom:type", "Value": "cliente"},
                {"Name": "custom:status", "Value": "active"},
                {"Name": "custom:cnpj", "Value": body.cnpj_cliente or ""},
                {"Name": "custom:doc_id", "Value": f"user:{body.email}"},
                # sub_role fica apenas no CouchDB; Cognito não tem custom:sub_role no schema
            ],
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
                "phone_number": body.phone_number,
                "status": "active",  # Admin/revenda cria direto como ativo
                "created_at": now,
                "approved_at": now,  # Criado por admin/revenda = aprovado imediatamente
                "created_by": user.get("email"),
                "cognito_sub": cognito_sub,
                "cognito_synced": True,
                "revenda_id": body.revenda_id or None,
                "cnpj_cliente": body.cnpj_cliente,
                "cnpj_admin": cnpj_admin,
                "cnpj_revenda": cnpj_revenda,
                "sub_role": body.sub_role or "superusuario",
                "irrigadores": [],
                # Verificação & Termos — fluxo com convite nativo do Cognito
                "email_verified": True,
                "email_verified_at": now,
                "terms_accepted": False,
                "terms_version": None,
                "terms_accepted_at": None,
                "terms_accepted_ip": None,
                "first_login_at": None,
                "last_login_at": None,
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
            "message": "Cliente criado com sucesso! Convite enviado pelo Cognito.",
            "cliente_id": doc_id,
            "email": body.email,
            "name": body.name,
            "revenda_id": body.revenda_id,
            "status_code": 201,
        }

    except HTTPException:
        raise
    except ClientError as e:
        # Rollback se algo der errado no Cognito após criação parcial
        if cognito_client and cognito_sub:
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID, Username=body.email
                )
            except Exception:
                pass
        _raise_cognito_http_error(e)
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


@router.put("/{cliente_id}")
async def update_cliente(
    cliente_id: str,
    body: ClienteUpdateRequest,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Atualizar cliente. Superadmin pode editar qualquer cliente."""
    checker = PermissionChecker(user)
    if not (checker.can_manage_clientes() or checker.is_superadmin()):
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        cliente = db.get(cliente_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    if cliente.get("type") != "cliente":
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    if not _can_manage_cliente_target(checker, user, cliente):
        raise HTTPException(status_code=403, detail="Acesso negado")

    changed = False
    cognito_attrs = []

    if body.name is not None and body.name != cliente.get("name"):
        cliente["name"] = body.name
        cognito_attrs.append({"Name": "name", "Value": body.name})
        changed = True

    if body.status is not None and body.status != cliente.get("status"):
        cliente["status"] = body.status
        cognito_attrs.append({"Name": "custom:status", "Value": body.status})
        changed = True

    if body.sub_role is not None and body.sub_role != cliente.get("sub_role"):
        cliente["sub_role"] = body.sub_role
        changed = True

    if body.revenda_id is not None and body.revenda_id != cliente.get("revenda_id"):
        # Revenda não pode reassociar cliente para outra revenda
        if checker.is_revenda():
            raise HTTPException(
                status_code=403, detail="Revenda não pode alterar revenda_id do cliente"
            )
        cliente["revenda_id"] = body.revenda_id
        changed = True

    if body.cnpj_cliente is not None and body.cnpj_cliente != cliente.get(
        "cnpj_cliente"
    ):
        cliente["cnpj_cliente"] = body.cnpj_cliente
        cognito_attrs.append({"Name": "custom:cnpj", "Value": body.cnpj_cliente})
        changed = True

    if body.cnpj_admin is not None and body.cnpj_admin != cliente.get("cnpj_admin"):
        if not checker.is_superadmin():
            raise HTTPException(
                status_code=403, detail="Apenas superadmin pode alterar cnpj_admin"
            )
        cliente["cnpj_admin"] = body.cnpj_admin
        changed = True

    if body.cnpj_revenda is not None and body.cnpj_revenda != cliente.get(
        "cnpj_revenda"
    ):
        if checker.is_revenda():
            raise HTTPException(
                status_code=403, detail="Revenda não pode alterar cnpj_revenda"
            )
        cliente["cnpj_revenda"] = body.cnpj_revenda
        changed = True

    if body.phone_number is not None and body.phone_number != cliente.get(
        "phone_number"
    ):
        cliente["phone_number"] = body.phone_number
        cognito_attrs.append({"Name": "phone_number", "Value": body.phone_number})
        changed = True

    if not changed:
        return {
            "status": "success",
            "message": "Nenhuma alteração aplicada",
            "cliente": cliente,
        }

    db.save(cliente)

    try:
        if cognito_attrs and cliente.get("email"):
            cognito_client.admin_update_user_attributes(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=cliente["email"],
                UserAttributes=cognito_attrs,
            )
    except Exception as e:
        print(f"⚠️ Aviso ao atualizar Cognito (cliente): {e}")

    return {
        "status": "success",
        "message": "Cliente atualizado com sucesso",
        "cliente": cliente,
    }


@router.delete("/{cliente_id}")
async def delete_cliente(
    cliente_id: str,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Deletar cliente. Superadmin pode deletar qualquer cliente."""
    checker = PermissionChecker(user)
    if not (checker.can_manage_clientes() or checker.is_superadmin()):
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        cliente = db.get(cliente_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    if cliente.get("type") != "cliente":
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    if not _can_manage_cliente_target(checker, user, cliente):
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        if cliente.get("email"):
            cognito_client.admin_delete_user(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=cliente["email"],
            )
    except Exception as e:
        print(f"⚠️ Aviso ao remover cliente no Cognito: {e}")

    db.delete(cliente)
    return {"status": "success", "message": "Cliente deletado com sucesso"}


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
                {"Name": "phone_number", "Value": body.phone_number},
                {"Name": "custom:type", "Value": "cliente"},
                {"Name": "custom:status", "Value": "active"},
                {"Name": "custom:cnpj", "Value": cnpj_cliente},
                {"Name": "custom:doc_id", "Value": f"user:{body.email}"},
                # sub_role fica apenas no CouchDB; Cognito não tem custom:sub_role no schema
            ],
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
            "phone_number": body.phone_number,
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
            # Verificação & Termos — fluxo com convite nativo do Cognito
            "email_verified": True,
            "email_verified_at": now,
            "terms_accepted": False,
            "terms_version": None,
            "terms_accepted_at": None,
            "terms_accepted_ip": None,
            "first_login_at": None,
            "last_login_at": None,
        }

        db.save(cliente_doc)

        return {
            "status": "success",
            "message": f"Usuário {body.sub_role} criado com sucesso! Convite enviado pelo Cognito.",
            "cliente_id": doc_id,
            "email": body.email,
            "name": body.name,
            "sub_role": body.sub_role,
        }

    except HTTPException:
        raise
    except ClientError as e:
        if cognito_client and cognito_sub:
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID, Username=body.email
                )
            except Exception:
                pass
        _raise_cognito_http_error(e)
    except Exception as e:
        if cognito_client and cognito_sub:
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID, Username=body.email
                )
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Erro ao criar usuário: {str(e)}")
