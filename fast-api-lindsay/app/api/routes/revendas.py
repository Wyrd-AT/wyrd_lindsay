"""Rotas de revendas (Admin only)"""

import boto3
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.aws import get_cognito_client
from app.core.database import get_db, get_users_db
from app.core.config import settings
from app.models.schemas import (
    RevendasListResponse,
    AdminCreateRevendaRequest,
    RevendaUpdateRequest,
)
from app.services.permissions import PermissionChecker
from app.services.revenda import RevendaService
from app.utils.validators import validate_password, validate_cnpj_or_cpf, format_cnpj
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/revendas")


@router.get("", response_model=RevendasListResponse)
async def list_revendas(user: dict = Depends(get_current_user)):
    """Listar revendas (admin/superadmin)"""
    checker = PermissionChecker(user)
    if not checker.can_manage_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        # Superadmin vê todas; admin regular vê apenas revendas da própria hierarquia.
        if checker.is_superadmin():
            selector = {"type": "revenda"}
        else:
            selector = {"type": "revenda", "cnpj_admin": user.get("cnpj")}

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


@router.post("", status_code=201)
async def create_revenda_admin(
    body: AdminCreateRevendaRequest,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Criar revenda (admin only - criada já com status active)"""
    checker = PermissionChecker(user)
    if not checker.can_manage_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Resolver cnpj_admin: superadmin pode atribuir a outro admin, admin regular herda o próprio
    if checker.is_superadmin():
        if not body.cnpj_admin:
            body.cnpj_admin = user["cnpj"]
    else:
        body.cnpj_admin = user["cnpj"]

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
            initial_status="active",
            cnpj_admin=body.cnpj_admin,
        )

        if not success:
            print(f"❌ ERRO ao criar revenda no CouchDB: {msg}")
            raise HTTPException(status_code=400, detail=msg)

        print(f"✅ Revenda criada no CouchDB: {doc_id}")

        # ✅ PASSO 2: Criar usuário no Cognito (admin_create_user)
        try:
            create_response = cognito_client.admin_create_user(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=body.email,
                UserAttributes=[
                    {"Name": "email", "Value": body.email},
                    {"Name": "email_verified", "Value": "true"},
                    {"Name": "name", "Value": body.name},
                    {"Name": "custom:type", "Value": "revenda"},
                    {"Name": "custom:status", "Value": "active"},
                    {"Name": "custom:cnpj", "Value": cnpj_revenda_formatted},
                    {"Name": "custom:doc_id", "Value": doc_id},
                ],
                MessageAction="SUPPRESS",
            )
            cognito_sub = create_response["User"]["Username"]
            print(f"✅ Usuário criado no Cognito: {cognito_sub}")
            print(
                f"✅ Custom attributes salvos: type=revenda, status=active, cnpj={cnpj_revenda_formatted}, doc_id={doc_id}"
            )

            # Definir senha permanente
            cognito_client.admin_set_user_password(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=body.email,
                Password=body.password,
                Permanent=True,
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


@router.put("/{revenda_id}")
async def update_revenda(
    revenda_id: str,
    body: RevendaUpdateRequest,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Atualizar revenda. Superadmin pode editar qualquer revenda."""
    checker = PermissionChecker(user)
    if not checker.can_manage_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        revenda = db.get(revenda_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Revenda não encontrada")

    if revenda.get("type") != "revenda":
        raise HTTPException(status_code=404, detail="Revenda não encontrada")

    # Admin regular só pode editar revendas da sua hierarquia
    if not checker.is_superadmin() and revenda.get("cnpj_admin") != user.get("cnpj"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    changed = False
    cognito_attrs = []

    if body.name is not None and body.name != revenda.get("name"):
        revenda["name"] = body.name
        cognito_attrs.append({"Name": "name", "Value": body.name})
        changed = True

    if body.status is not None and body.status != revenda.get("status"):
        revenda["status"] = body.status
        cognito_attrs.append({"Name": "custom:status", "Value": body.status})
        changed = True

    if body.cnpj_revenda is not None and body.cnpj_revenda != revenda.get("cnpj_revenda"):
        revenda["cnpj_revenda"] = body.cnpj_revenda
        cognito_attrs.append({"Name": "custom:cnpj", "Value": body.cnpj_revenda})
        changed = True

    if body.cnpj_admin is not None and body.cnpj_admin != revenda.get("cnpj_admin"):
        if not checker.is_superadmin():
            raise HTTPException(
                status_code=403, detail="Apenas superadmin pode alterar cnpj_admin"
            )
        revenda["cnpj_admin"] = body.cnpj_admin
        changed = True

    if not changed:
        return {
            "status": "success",
            "message": "Nenhuma alteração aplicada",
            "revenda": revenda,
        }

    db.save(revenda)

    try:
        if cognito_attrs and revenda.get("email"):
            cognito_client.admin_update_user_attributes(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=revenda["email"],
                UserAttributes=cognito_attrs,
            )
    except Exception as e:
        print(f"⚠️ Aviso ao atualizar Cognito (revenda): {e}")

    return {"status": "success", "message": "Revenda atualizada com sucesso", "revenda": revenda}


@router.delete("/{revenda_id}")
async def delete_revenda(
    revenda_id: str,
    user: dict = Depends(get_current_user),
    cognito_client=Depends(get_cognito_client),
):
    """Deletar revenda. Superadmin pode deletar qualquer revenda."""
    checker = PermissionChecker(user)
    if not checker.can_manage_revendas():
        raise HTTPException(status_code=403, detail="Acesso negado")

    db = get_users_db()
    try:
        revenda = db.get(revenda_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Revenda não encontrada")

    if revenda.get("type") != "revenda":
        raise HTTPException(status_code=404, detail="Revenda não encontrada")

    if not checker.is_superadmin() and revenda.get("cnpj_admin") != user.get("cnpj"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    try:
        if revenda.get("email"):
            cognito_client.admin_delete_user(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=revenda["email"],
            )
    except Exception as e:
        print(f"⚠️ Aviso ao remover revenda no Cognito: {e}")

    db.delete(revenda)
    return {"status": "success", "message": "Revenda deletada com sucesso"}
