"""
Pydantic models para validação de dados
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime
from enum import Enum


class ClienteSubRole(str, Enum):
    """Sub-roles dentro do nível cliente"""

    SUPERUSUARIO = "superusuario"
    GERENTE = "gerente"
    COMUM = "comum"


# ============================================================================
# Auth Models
# ============================================================================


class UserRegisterRequest(BaseModel):
    """Requisição de registro"""

    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    type: str  # "admin", "revenda", "cliente"
    domain: Optional[str] = None
    cnpj_admin: Optional[str] = None  # CNPJ do admin (obrigatório para type=admin)


class UserLoginRequest(BaseModel):
    """Requisição de login"""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Resposta com dados do usuário"""

    email: str
    name: str
    type: str
    status: str
    doc_id: Optional[str] = None
    sub_role: Optional[str] = None


class TokenResponse(BaseModel):
    """Resposta com token de autenticação"""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============================================================================
# Revenda Models
# ============================================================================


class RevendaResponse(BaseModel):
    """Dados de revenda"""

    _id: Optional[str] = None
    _rev: Optional[str] = None
    email: str
    name: str
    cnpj_revenda: Optional[str] = None
    status: str
    created_at: str


class ApprovalRequest(BaseModel):
    """Requisição de aprovação"""

    email: str


class RevendasListResponse(BaseModel):
    """Lista de revendas"""

    total: int
    revendas: list[RevendaResponse]


class AdminCreateAdminRequest(BaseModel):
    """Requisição para admin criar outro admin"""

    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    cnpj_admin: str  # CNPJ do novo admin


class AdminCreateRevendaRequest(BaseModel):
    """Requisição para admin criar revenda"""

    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    cnpj_revenda: str  # CNPJ da revenda a ser criada
    cnpj_admin: Optional[str] = None  # CNPJ do admin que cria (para hierarquia)


# ============================================================================
# Cliente Models
# ============================================================================


class ClienteResponse(BaseModel):
    """Dados de cliente"""

    _id: Optional[str] = None
    _rev: Optional[str] = None
    email: str
    name: str
    status: str
    revenda_id: Optional[str] = None
    cnpj_cliente: Optional[str] = None  # CNPJ do cliente
    cnpj_admin: Optional[str] = None  # CNPJ do admin da hierarquia
    cnpj_revenda: Optional[str] = None  # CNPJ da revenda associada
    sub_role: Optional[str] = None  # superusuario, gerente, comum
    irrigadores: List[str] = []  # IDs dos irrigadores vinculados
    created_at: str


class ClientesListResponse(BaseModel):
    """Lista de clientes"""

    total: int
    clientes: list[ClienteResponse]


class AdminCreateClienteRequest(BaseModel):
    """Requisição para admin/revenda criar cliente"""

    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    cnpj_cliente: str  # CNPJ do cliente
    revenda_id: Optional[str] = None  # Opcional: admin atribui a uma revenda
    sub_role: Optional[str] = None  # Se não informado, default "superusuario"


class SuperusuarioCreateUserRequest(BaseModel):
    """Requisição para superusuário criar gerente ou comum dentro da empresa"""

    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    sub_role: Literal["gerente", "comum"]


# ============================================================================
# Pivô Models (FASE 2)
# ============================================================================


class CreatePivoRequest(BaseModel):
    """Requisição para criar pivô"""

    codigo: str
    nome: str
    cliente_id: Optional[str] = (
        None  # doc_id do cliente (ex: "user:email@x.com") - admin/revenda especifica
    )
    equipamentos: List[str] = []  # ex: ["Painel 1", "Torre 1", "Casa de bombas"]
    location: Optional[Dict[str, float]] = None


class UpdatePivoRequest(BaseModel):
    """Requisição para atualizar pivô"""

    nome: Optional[str] = None
    ativo: Optional[bool] = None
    location: Optional[Dict[str, float]] = None


class PivoResponse(BaseModel):
    """Dados de pivô (created_at/updated_at opcionais para docs antigos do CouchDB)"""

    _id: str
    codigo: str
    nome: str
    owner_id: str
    gerente_id: str
    ativo: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PivosListResponse(BaseModel):
    """Lista de pivôs"""

    total: int
    role: str
    pivos: list[PivoResponse]


class PivosStatsResponse(BaseModel):
    """Estatísticas de pivôs"""

    total: int
    ativos: int
    inativos: int
    total_clientes: Optional[int] = None


# ============================================================================
# Generic Models
# ============================================================================


class StatusResponse(BaseModel):
    """Resposta genérica de status"""

    status: str
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class ErrorResponse(BaseModel):
    """Resposta de erro"""

    detail: str
    status_code: int
    timestamp: datetime = Field(default_factory=datetime.now)


# ============================================================================
# Verificação de Email & Termos de Uso
# ============================================================================


class VerifyEmailRequest(BaseModel):
    """Requisição para verificar email com código de 6 dígitos"""

    email: EmailStr
    code: str = Field(..., pattern=r"^\d{6}$", description="Código de 6 dígitos")


class ResendCodeRequest(BaseModel):
    """Requisição para reenviar código de verificação"""

    email: EmailStr


class AcceptTermsRequest(BaseModel):
    """Requisição para aceitar termos de uso"""

    terms_version: str


class TermsResponse(BaseModel):
    """Resposta com termos de uso atuais"""

    version: str
    content: str
    effective_date: str


class InvitationActivateRequest(BaseModel):
    """Requisição para ativar conta via convite"""

    token: str
    password: str = Field(..., min_length=6)
    terms_accepted: bool = True


class LoginResponse(BaseModel):
    """Resposta de login com status de verificação/termos"""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    email_verified: bool = True
    terms_accepted: bool = False
    terms_version: Optional[str] = None
    requires_action: Optional[str] = None  # "verify_email", "accept_terms", None
