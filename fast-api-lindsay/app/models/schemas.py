"""
Pydantic models para validação de dados
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from datetime import datetime


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


class AdminCreateRevendaRequest(BaseModel):
    """Requisição para admin criar revenda"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    cnpj_revenda: str              # CNPJ da revenda a ser criada
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
    created_at: str


class ClientesListResponse(BaseModel):
    """Lista de clientes"""
    total: int
    clientes: list[ClienteResponse]


class AdminCreateClienteRequest(BaseModel):
    """Requisição para admin criar cliente"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    revenda_id: Optional[str] = None  # Opcional: admin pode atribuir a uma revenda


# ============================================================================
# Pivô Models (FASE 2)
# ============================================================================

class CreatePivoRequest(BaseModel):
    """Requisição para criar pivô"""
    codigo: str
    nome: str
    location: Optional[Dict[str, float]] = None


class UpdatePivoRequest(BaseModel):
    """Requisição para atualizar pivô"""
    nome: Optional[str] = None
    ativo: Optional[bool] = None
    location: Optional[Dict[str, float]] = None


class PivoResponse(BaseModel):
    """Dados de pivô"""
    _id: str
    codigo: str
    nome: str
    owner_id: str
    gerente_id: str
    ativo: bool
    created_at: str
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
