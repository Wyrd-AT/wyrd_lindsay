"""
Rotas de autenticação
"""

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import base64
from typing import Optional
import couchdb
import boto3
from botocore.exceptions import ClientError

from app.core.database import get_db, get_users_db
from app.core.config import settings
from app.models.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse
)
from app.services.auth import AuthService
from app.utils.cognito_utils import get_secret_hash

router = APIRouter(prefix="/auth")
security = HTTPBearer(auto_error=False)


# ============================================================================
# Dependências
# ============================================================================

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """Obter usuário autenticado do token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais não fornecidas"
        )

    try:
        # Decodificar token (formato: base64(email:type:cnpj))
        decoded = base64.b64decode(credentials.credentials).decode()
        parts = decoded.split(":", 2)  # max 3 partes
        email = parts[0]
        user_type = parts[1]
        cnpj_from_token = parts[2] if len(parts) > 2 else None

        # Buscar usuário no CouchDB (banco de usuários)
        db = get_users_db()

        # Tentar buscar em diferentes formatos baseado no tipo
        user_doc = None
        doc_id = None

        try:
            if user_type == "admin":
                # Admin: admin:{email}
                doc_id = f"admin:{email}"
                user_doc = db[doc_id]
            elif user_type == "revenda":
                # Revenda: revenda:{domain} - precisa buscar pelo email primeiro
                try:
                    # Tentar buscar por email
                    result = db.find({"selector": {"type": "revenda", "email": email}, "limit": 1})
                    revendas = list(result)
                    if revendas:
                        user_doc = revendas[0]
                        doc_id = user_doc.get("_id")
                    else:
                        # Fallback: tentar formato revenda:{domain}
                        # Extrair domain do email
                        domain = email.split("@")[1] if "@" in email else ""
                        doc_id = f"revenda:{domain}"
                        user_doc = db[doc_id]
                except:
                    # Último fallback: tentar formato antigo
                    doc_id = f"user:{email}"
                    user_doc = db[doc_id]
            else:
                # Cliente: user:{email}
                doc_id = f"user:{email}"
                user_doc = db[doc_id]
        except couchdb.http.ResourceNotFound:
            # Se não encontrou no formato esperado, tentar buscar por email em qualquer tipo
            try:
                result = db.find({"selector": {"email": email}, "limit": 1})
                users = list(result)
                if users:
                    user_doc = users[0]
                    doc_id = user_doc.get("_id")
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Usuário não encontrado"
                    )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuário não encontrado"
                )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Erro ao buscar usuário: {str(e)}"
            )
        
        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado"
            )
        
        return {
            "email": user_doc.get("email", email),
            "type": user_doc.get("type", user_type),
            "status": user_doc.get("status", "active"),
            "name": user_doc.get("name"),
            "doc_id": doc_id or user_doc.get("_id"),
            "cnpj": user_doc.get("cnpj") or cnpj_from_token,  # ✅ CRÍTICO - filtragem por admin
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {str(e)}"
        )


# ============================================================================
# Rotas
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
                name=request.name
            )
        elif request.type == "revenda":
            user = auth_service.register_revenda(
                email=request.email,
                password=request.password,
                name=request.name,
                domain=request.domain or request.email.split("@")[1]
            )
        elif request.type == "cliente":
            user = auth_service.register_cliente(
                email=request.email,
                password=request.password,
                name=request.name,
                revenda_id=request.domain
            )
        else:
            raise ValueError(f"Tipo inválido: {request.type}")

        return UserResponse(
            email=user["email"],
            name=user["name"],
            type=user["type"],
            status=user["status"],
            doc_id=user.get("_id")
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(request: UserLoginRequest):
    """Fazer login"""
    auth_service = AuthService(settings.COUCHDB_URL, settings.COUCHDB_USERS_DB)

    try:
        user = auth_service.authenticate(request.email, request.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou senha inválidos"
            )

        # Gerar token (base64(email:type))
        token = base64.b64encode(f"{user['email']}:{user['type']}".encode()).decode()

        return TokenResponse(
            access_token=token,
            user=UserResponse(
                email=user["email"],
                name=user["name"],
                type=user["type"],
                status=user["status"],
                doc_id=user.get("_id")
            )
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Registro de Revendas
# ============================================================================

@router.post("/register")
async def register_revenda(request: dict):
    """
    Registrar uma nova revenda

    Fluxo:
    1. Validar dados
    2. Criar usuário no Cognito
    3. Criar documento no CouchDB
    4. Atualizar custom attributes no Cognito
    5. Retornar resposta com status

    Request:
    {
        "email": "gerente@wyrd.com.br",
        "password": "SecurePass123!",
        "name": "Revenda WYRD",
        "user_type": "revenda",
        "cnpj": "12.345.678/0001-99"
    }
    """
    try:
        from app.services.revenda import RevendaService
        import boto3
        from app.utils.validators import validate_password
        from botocore.exceptions import ClientError

        # Extrair dados
        email = request.get("email", "").lower().strip()
        password = request.get("password", "")
        name = request.get("name", "").strip()
        user_type = request.get("user_type", "").lower()
        cnpj = request.get("cnpj", "").strip()

        # Validar tipo de usuário
        if user_type != "revenda":
            raise HTTPException(
                status_code=400,
                detail="Este endpoint é apenas para revendas (user_type='revenda')"
            )

        # Validar senha
        is_valid, msg = validate_password(password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=msg)

        # Inicializar Cognito (requer credenciais AWS)
        try:
            cognito_client = boto3.client(
                'cognito-idp',
                region_name=settings.AWS_REGION
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail="Cognito não disponível"
            )

        # PASSO 1: Criar usuário no Cognito
        try:
            # Preparar parâmetros do sign_up
            sign_up_params = {
                "ClientId": settings.COGNITO_CLIENT_ID,
                "Username": email,
                "Password": password,
                "UserAttributes": [
                    {"Name": "email", "Value": email},
                    {"Name": "name", "Value": name},
                ]
            }

            # Adicionar SecretHash se o cliente tem um secret configurado
            secret_hash = get_secret_hash(email)
            if secret_hash:
                sign_up_params["SecretHash"] = secret_hash

            cognito_response = cognito_client.sign_up(**sign_up_params)
            cognito_sub = cognito_response['UserSub']

        except ClientError as e:
            error_code = e.response['Error']['Code']

            if error_code == 'UsernameExistsException':
                raise HTTPException(
                    status_code=409,
                    detail="Email já está registrado no sistema"
                )
            elif error_code == 'InvalidPasswordException':
                raise HTTPException(
                    status_code=400,
                    detail="Senha não atende aos requisitos de segurança"
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Erro ao criar usuário no Cognito: {e}"
                )

        # PASSO 2: Criar revenda no CouchDB + sincronizar Cognito
        revenda_service = RevendaService(
            couchdb_url=settings.COUCHDB_URL,
            database=settings.COUCHDB_USERS_DB,  # ✅ Usar banco de USUÁRIOS (lindsay-users), não de dados!
            cognito_region=settings.AWS_REGION,
            cognito_pool_id=settings.COGNITO_USER_POOL_ID
        )

        success, message, revenda_data = revenda_service.register_revenda_complete(
            email=email,
            name=name,
            cnpj=cnpj,
            cognito_sub=cognito_sub
        )

        if not success:
            # Se falhou no CouchDB, deletar o usuário do Cognito
            try:
                cognito_client.admin_delete_user(
                    UserPoolId=settings.COGNITO_USER_POOL_ID,
                    Username=email
                )
            except:
                pass  # Ignorar erro ao limpar

            raise HTTPException(status_code=400, detail=message)

        # PASSO 3: Confirmar usuário no Cognito (admin action)
        try:
            cognito_client.admin_confirm_sign_up(
                UserPoolId=settings.COGNITO_USER_POOL_ID,
                Username=email
            )
        except Exception as e:
            print(f"⚠️ Aviso ao confirmar usuário no Cognito: {e}")

        # Retornar sucesso
        return {
            "status": "success",
            "message": revenda_data.get("message", "Revenda registrada com sucesso"),
            "revenda_id": revenda_data.get("revenda_id"),
            "email": email,
            "name": name,
            "cnpj": revenda_data.get("cnpj"),
            "next_steps": "Faça login para acompanhar sua solicitação de aprovação"
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"Erro ao registrar revenda: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(user: dict = Depends(get_current_user)):
    """Obter dados do usuário atual"""
    return UserResponse(
        email=user["email"],
        name=user["name"],
        type=user["type"],
        status=user["status"],
        doc_id=user.get("doc_id")
    )
