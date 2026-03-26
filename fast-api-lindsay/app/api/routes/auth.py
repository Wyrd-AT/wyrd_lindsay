"""
Rotas de autenticação
"""

from fastapi import APIRouter, HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import base64
from typing import Optional
import couchdb
import boto3
from botocore.exceptions import ClientError

from app.core.aws import get_cognito_client
from app.core.database import get_db, get_users_db
from app.core.config import settings
from app.models.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
    LoginResponse,
    VerifyEmailRequest,
    ResendCodeRequest,
    AcceptTermsRequest,
    TermsResponse,
    InvitationActivateRequest,
)
from app.services.auth import AuthService, UserType
from app.services.verification_service import VerificationService
from app.services.terms_service import TermsService

router = APIRouter(prefix="/auth")
security = HTTPBearer(auto_error=False)


# ============================================================================
# Helpers internos
# ============================================================================


def _resolve_user_doc(credentials):
    """
    Decodifica token e busca user_doc no CouchDB.
    Retorna (user_doc, doc_id, user_type_resolved, cnpj_resolved, sub_role_resolved)
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais não fornecidas",
        )

    try:
        decoded = base64.b64decode(credentials.credentials).decode()
        parts = decoded.split(":", 3)
        email = parts[0]
        user_type = parts[1]
        cnpj_from_token = parts[2] if len(parts) > 2 else None
        sub_role_from_token = parts[3] if len(parts) > 3 else None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {str(e)}",
        )

    db = get_users_db()
    user_doc = None
    doc_id = None

    try:
        if user_type in ("superadmin", "admin"):
            doc_id = f"admin:{email}"
            user_doc = db[doc_id]
        elif user_type == "revenda":
            try:
                result = db.find(
                    {"selector": {"type": "revenda", "email": email}, "limit": 1}
                )
                revendas = list(result)
                if revendas:
                    user_doc = revendas[0]
                    doc_id = user_doc.get("_id")
                else:
                    domain = email.split("@")[1] if "@" in email else ""
                    doc_id = f"revenda:{domain}"
                    user_doc = db[doc_id]
            except Exception:
                doc_id = f"user:{email}"
                user_doc = db[doc_id]
        else:
            doc_id = f"user:{email}"
            user_doc = db[doc_id]
    except couchdb.http.ResourceNotFound:
        try:
            result = db.find({"selector": {"email": email}, "limit": 1})
            users = list(result)
            if users:
                user_doc = users[0]
                doc_id = user_doc.get("_id")
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuário não encontrado",
                )
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Erro ao buscar usuário: {str(e)}",
        )

    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
        )

    # Resolver campos
    user_type_resolved = user_doc.get("type", user_type)
    if user_type_resolved in ("superadmin", "admin"):
        cnpj_resolved = user_doc.get("cnpj_admin") or cnpj_from_token
    elif user_type_resolved == "revenda":
        cnpj_resolved = user_doc.get("cnpj_revenda") or cnpj_from_token
    elif user_type_resolved == "cliente":
        cnpj_resolved = user_doc.get("cnpj_cliente") or cnpj_from_token
    else:
        cnpj_resolved = cnpj_from_token

    sub_role_resolved = None
    if user_type_resolved == "cliente":
        sub_role_resolved = (
            user_doc.get("sub_role") or sub_role_from_token or "superusuario"
        )

    return user_doc, doc_id, user_type_resolved, cnpj_resolved, sub_role_resolved


# ============================================================================
# Dependências de Autenticação
# ============================================================================


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Obter usuário autenticado do token.
    Verifica: email_verified, terms_accepted, status.
    """
    user_doc, doc_id, user_type_resolved, cnpj_resolved, sub_role_resolved = (
        _resolve_user_doc(credentials)
    )

    # --- Verificações de onboarding (403, não 401) ---

    # Checar status rejeitado
    if user_doc.get("status") == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="account_rejected",
        )

    # Checar status pendente
    if user_doc.get("status") == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="account_pending",
        )

    # Checar verificação de email (default True para backward compat)
    if not user_doc.get("email_verified", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="email_not_verified",
        )

    # Checar termos de uso (default: não exigir para usuários antigos sem campo)
    terms_service = TermsService(get_users_db())
    if terms_service.needs_terms_acceptance(user_doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="terms_not_accepted",
        )

    return {
        "email": user_doc.get("email", ""),
        "type": user_type_resolved,
        "status": user_doc.get("status", "active"),
        "name": user_doc.get("name"),
        "doc_id": doc_id or user_doc.get("_id"),
        "cnpj": cnpj_resolved,
        "sub_role": sub_role_resolved,
    }


def get_current_user_minimal(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Obter usuário autenticado SEM verificar email/termos.
    Usado apenas para endpoints de onboarding (accept-terms).
    """
    user_doc, doc_id, user_type_resolved, cnpj_resolved, sub_role_resolved = (
        _resolve_user_doc(credentials)
    )

    return {
        "email": user_doc.get("email", ""),
        "type": user_type_resolved,
        "status": user_doc.get("status", "active"),
        "name": user_doc.get("name"),
        "doc_id": doc_id or user_doc.get("_id"),
        "cnpj": cnpj_resolved,
        "sub_role": sub_role_resolved,
    }


# ============================================================================
# Rotas de Registro e Login
# ============================================================================


@router.post("/register", response_model=UserResponse)
async def register(request: UserRegisterRequest):
    """Registrar novo usuário"""
    auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)

    try:
        if request.type == "admin":
            user = auth_service.register_admin(
                email=request.email,
                password=request.password,
                name=request.name,
                cnpj_admin=request.cnpj_admin,
            )
        elif request.type == "revenda":
            user = auth_service.register_revenda(
                email=request.email,
                password=request.password,
                name=request.name,
                domain=request.domain or request.email.split("@")[1],
            )
        elif request.type == "cliente":
            user = auth_service.register_cliente(
                email=request.email,
                password=request.password,
                name=request.name,
                revenda_id=request.domain,
            )
        else:
            raise ValueError(f"Tipo inválido: {request.type}")

        return UserResponse(
            email=user["email"],
            name=user["name"],
            type=user["type"],
            status=user["status"],
            doc_id=user.get("_id"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=LoginResponse)
async def login(request: UserLoginRequest):
    """Fazer login - retorna status de verificação e termos"""
    auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)

    try:
        # Tentar autenticar em todos os tipos de usuário
        user = None
        for utype in [UserType.SUPERADMIN, UserType.ADMIN, UserType.REVENDA, UserType.CLIENTE]:
            user = auth_service.authenticate(request.email, request.password, utype)
            if user:
                break

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou senha inválidos",
            )

        # Gerar token (base64(email:type:cnpj:sub_role))
        user_cnpj = ""
        if user.get("type") in ("superadmin", "admin"):
            user_cnpj = user.get("cnpj_admin", "") or ""
        elif user.get("type") == "revenda":
            user_cnpj = user.get("cnpj_revenda", "") or ""
        elif user.get("type") == "cliente":
            user_cnpj = user.get("cnpj_cliente", "") or ""

        user_sub_role = ""
        if user.get("type") == "cliente":
            user_sub_role = user.get("sub_role", "") or "superusuario"

        token = base64.b64encode(
            f"{user['email']}:{user['type']}:{user_cnpj}:{user_sub_role}".encode()
        ).decode()

        # Determinar status de verificação e termos
        email_verified = user.get("email_verified", True)
        terms_accepted = user.get("terms_accepted", False)
        terms_version = user.get("terms_version")

        # Determinar ação necessária
        requires_action = None
        if not email_verified:
            requires_action = "verify_email"
        elif not terms_accepted or terms_version != settings.CURRENT_TERMS_VERSION:
            requires_action = "accept_terms"

        # Registrar login
        db = get_users_db()
        try:
            doc_id = user.get("_id")
            if doc_id:
                user_doc = db.get(doc_id)
                if user_doc:
                    from datetime import datetime

                    now = datetime.utcnow().isoformat()
                    if not user_doc.get("first_login_at"):
                        user_doc["first_login_at"] = now
                    user_doc["last_login_at"] = now
                    db.save(user_doc)
        except Exception:
            pass  # Não bloquear login se falhar ao registrar timestamp

        return LoginResponse(
            access_token=token,
            user=UserResponse(
                email=user["email"],
                name=user["name"],
                type=user["type"],
                status=user["status"],
                doc_id=user.get("_id"),
                sub_role=user_sub_role if user_sub_role else None,
            ),
            email_verified=email_verified,
            terms_accepted=terms_accepted,
            terms_version=terms_version,
            requires_action=requires_action,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Verificação de Email
# ============================================================================


@router.post("/verify-email")
async def verify_email(
    request: VerifyEmailRequest, cognito_client=Depends(get_cognito_client)
):
    """Verificar email com código de 6 dígitos.

    Prioriza confirmação nativa do Cognito e mantém fallback legado (código interno).
    """
    db = get_users_db()

    try:
        cognito_client.confirm_sign_up(
            ClientId=settings.COGNITO_CLIENT_ID,
            Username=request.email,
            ConfirmationCode=request.code,
        )

        # Sincronizar flag local
        try:
            user_doc = db.get(f"user:{request.email}")
            if user_doc:
                from datetime import datetime

                user_doc["email_verified"] = True
                user_doc["email_verified_at"] = datetime.utcnow().isoformat()
                db.save(user_doc)
        except Exception:
            pass

        return {"status": "success", "message": "Email verificado com sucesso"}
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")

        # Usuário já confirmado no Cognito -> tratar como sucesso e sincronizar local.
        if error_code == "NotAuthorizedException":
            try:
                user_doc = db.get(f"user:{request.email}")
                if user_doc:
                    from datetime import datetime

                    user_doc["email_verified"] = True
                    user_doc["email_verified_at"] = datetime.utcnow().isoformat()
                    db.save(user_doc)
            except Exception:
                pass
            return {"status": "success", "message": "Email já estava verificado"}

        # Erros de código Cognito
        if error_code in ("CodeMismatchException", "ExpiredCodeException"):
            raise HTTPException(status_code=400, detail="Código inválido ou expirado")

        # Fallback legado: código interno salvo no CouchDB
        verification_service = VerificationService(db)
        success, error = verification_service.verify_code(request.email, request.code)
        if not success:
            raise HTTPException(status_code=400, detail=error)
        return {"status": "success", "message": "Email verificado com sucesso"}


@router.post("/resend-code")
async def resend_verification_code(
    request: ResendCodeRequest, cognito_client=Depends(get_cognito_client)
):
    """Reenviar código de verificação usando Cognito nativo (sem SendGrid)."""
    try:
        cognito_client.resend_confirmation_code(
            ClientId=settings.COGNITO_CLIENT_ID,
            Username=request.email,
        )
        return {"status": "success", "message": "Código reenviado com sucesso"}
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        # Usuário já confirmado no Cognito: não bloquear UX
        if error_code == "NotAuthorizedException":
            try:
                db = get_users_db()
                user_doc = db.get(f"user:{request.email}")
                if user_doc:
                    from datetime import datetime

                    user_doc["email_verified"] = True
                    user_doc["email_verified_at"] = datetime.utcnow().isoformat()
                    db.save(user_doc)
            except Exception:
                pass
            return {
                "status": "success",
                "message": "Email já verificado. Não é necessário reenviar código.",
                "already_verified": True,
            }
        if error_code == "UserNotFoundException":
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        raise HTTPException(
            status_code=400,
            detail="Não foi possível reenviar código pelo Cognito",
        )


# ============================================================================
# Termos de Uso
# ============================================================================


@router.get("/terms/current", response_model=TermsResponse)
async def get_current_terms():
    """Retornar termos de uso atuais (não requer autenticação)"""
    db = get_users_db()
    terms_service = TermsService(db)
    terms = terms_service.get_current_terms()
    return TermsResponse(**terms)


@router.post("/accept-terms")
async def accept_terms(
    request: AcceptTermsRequest,
    http_request: Request,
    user: dict = Depends(get_current_user_minimal),
):
    """Aceitar termos de uso (requer autenticação, registra IP para LGPD)"""
    db = get_users_db()
    terms_service = TermsService(db)

    # Obter IP real (considerar proxy)
    ip_address = http_request.headers.get(
        "X-Forwarded-For", http_request.client.host if http_request.client else "unknown"
    )
    # X-Forwarded-For pode ter múltiplos IPs, pegar o primeiro
    if "," in ip_address:
        ip_address = ip_address.split(",")[0].strip()

    success, error = terms_service.accept_terms(
        email=user["email"],
        version=request.terms_version,
        ip_address=ip_address,
    )

    if not success:
        raise HTTPException(status_code=400, detail=error)

    return {"status": "success", "message": "Termos aceitos com sucesso"}


# ============================================================================
# Ativação por Convite (clientes criados por admin/revenda)
# ============================================================================


@router.post("/activate-invitation")
async def activate_invitation(
    request: InvitationActivateRequest,
    http_request: Request,
    cognito_client=Depends(get_cognito_client),
):
    """Ativar conta via convite (definir senha + aceitar termos)"""
    db = get_users_db()
    verification_service = VerificationService(db)

    # Verificar token
    user_doc = verification_service.verify_invitation_token(request.token)
    if not user_doc:
        raise HTTPException(
            status_code=400,
            detail="Token de convite inválido ou expirado. Contate seu administrador.",
        )

    email = user_doc.get("email")

    # Definir senha no Cognito
    try:
        cognito_client.admin_set_user_password(
            UserPoolId=settings.COGNITO_USER_POOL_ID,
            Username=email,
            Password=request.password,
            Permanent=True,
        )
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "InvalidPasswordException":
            raise HTTPException(
                status_code=400,
                detail="Senha não atende aos requisitos de segurança",
            )
        raise HTTPException(
            status_code=400, detail=f"Erro ao definir senha: {str(e)}"
        )

    # Marcar email como verificado (clicou no link = email válido)
    from datetime import datetime

    now = datetime.utcnow().isoformat()
    user_doc["email_verified"] = True
    user_doc["email_verified_at"] = now
    user_doc["invitation_token"] = None
    user_doc["invitation_expires_at"] = None

    # Aceitar termos se solicitado
    if request.terms_accepted:
        ip_address = http_request.headers.get(
            "X-Forwarded-For",
            http_request.client.host if http_request.client else "unknown",
        )
        if "," in ip_address:
            ip_address = ip_address.split(",")[0].strip()

        user_doc["terms_accepted"] = True
        user_doc["terms_version"] = settings.CURRENT_TERMS_VERSION
        user_doc["terms_accepted_at"] = now
        user_doc["terms_accepted_ip"] = ip_address

        acceptance_history = user_doc.get("terms_acceptance_history", [])
        acceptance_history.append({
            "version": settings.CURRENT_TERMS_VERSION,
            "accepted_at": now,
            "ip_address": ip_address,
        })
        user_doc["terms_acceptance_history"] = acceptance_history

    db.save(user_doc)

    # Gerar token para auto-login
    user_type = user_doc.get("type", "cliente")
    user_cnpj = user_doc.get("cnpj_cliente", "") or ""
    user_sub_role = user_doc.get("sub_role", "superusuario") or "superusuario"

    token = base64.b64encode(
        f"{email}:{user_type}:{user_cnpj}:{user_sub_role}".encode()
    ).decode()

    return {
        "status": "success",
        "message": "Conta ativada com sucesso",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "email": email,
            "name": user_doc.get("name"),
            "type": user_type,
            "status": user_doc.get("status"),
            "sub_role": user_sub_role,
        },
    }


# ============================================================================
# Registro de Revendas (Cognito)
# ============================================================================


@router.post("/register-revenda")
async def register_revenda(request: dict, cognito_client=Depends(get_cognito_client)):
    """
    Registrar uma nova revenda

    Fluxo:
    1. Validar dados
    2. Criar usuário no Cognito
    3. Criar documento no CouchDB
    4. Enviar código de verificação
    5. Retornar resposta com status
    """
    try:
        from app.services.revenda import RevendaService
        from app.utils.validators import validate_password

        email = request.get("email", "").lower().strip()
        password = request.get("password", "")
        name = request.get("name", "").strip()
        user_type = request.get("user_type", "").lower()
        cnpj = request.get("cnpj", "").strip()

        if user_type != "revenda":
            raise HTTPException(
                status_code=400,
                detail="Este endpoint é apenas para revendas (user_type='revenda')",
            )

        is_valid, msg = validate_password(password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=msg)

        # PASSO 1: Criar usuário no Cognito
        try:
            sign_up_params = {
                "ClientId": settings.COGNITO_CLIENT_ID,
                "Username": email,
                "Password": password,
                "UserAttributes": [
                    {"Name": "email", "Value": email},
                    {"Name": "name", "Value": name},
                    {"Name": "custom:type", "Value": "revenda"},
                    {"Name": "custom:status", "Value": "pending"},
                    {"Name": "custom:cnpj", "Value": cnpj},
                ],
            }

            cognito_response = cognito_client.sign_up(**sign_up_params)
            cognito_sub = cognito_response["UserSub"]

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "UsernameExistsException":
                raise HTTPException(
                    status_code=409, detail="Email já está registrado no sistema"
                )
            elif error_code == "InvalidPasswordException":
                raise HTTPException(
                    status_code=400,
                    detail="Senha não atende aos requisitos de segurança",
                )
            else:
                raise HTTPException(
                    status_code=400, detail=f"Erro ao criar usuário no Cognito: {e}"
                )

        # PASSO 2: Criar revenda no CouchDB
        revenda_service = RevendaService(
            couchdb_url=settings.COUCHDB_URL,
            database=settings.COUCHDB_USERS_DB,
            cognito_region=settings.AWS_REGION,
            cognito_pool_id=settings.COGNITO_USER_POOL_ID,
        )

        success, message, revenda_data = revenda_service.register_revenda_complete(
            email=email, name=name, cnpj=cnpj, cognito_sub=cognito_sub
        )

        if not success:
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID, Username=email
                )
            except Exception:
                pass
            raise HTTPException(status_code=400, detail=message)

        # PASSO 3: Confirmar usuário no Cognito
        try:
            cognito_client.admin_confirm_sign_up(
                UserPoolId=settings.COGNITO_USER_POOL_ID, Username=email
            )
        except Exception as e:
            print(f"⚠️ Aviso ao confirmar usuário no Cognito: {e}")

        return {
            "status": "success",
            "message": revenda_data.get("message", "Revenda registrada com sucesso"),
            "revenda_id": revenda_data.get("revenda_id"),
            "email": email,
            "name": name,
            "cnpj": revenda_data.get("cnpj"),
            "next_steps": "Aguarde aprovação do administrador",
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Erro ao registrar revenda: {str(e)}"
        )


# ============================================================================
# Info do Usuário
# ============================================================================


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Obter dados do usuário atual"""
    return UserResponse(
        email=user["email"],
        name=user["name"],
        type=user["type"],
        status=user["status"],
        doc_id=user.get("doc_id"),
        sub_role=user.get("sub_role"),
    )
