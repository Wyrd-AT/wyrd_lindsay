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


class CognitoSignUpRequest(BaseModel):
    """Requisição de cadastro direto no Cognito"""

    email: EmailStr
    password: str = Field(..., min_length=6)
    name: Optional[str] = None
    phone_number: Optional[str] = None
    # Campos opcionais (mantidos por compatibilidade; ignorados no envio ao Cognito)
    type: Optional[str] = None
    status: Optional[str] = None
    domain: Optional[str] = None
    cnpj: Optional[str] = None
    hierarquia: Optional[str] = None


class UserResponse(BaseModel):
    """Resposta com dados do usuário"""

    email: str
    name: str
    type: str
    phone_number: Optional[str] = None
    status: str
    doc_id: Optional[str] = None
    sub_role: Optional[str] = None
    cnpj: Optional[str] = None


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
    phone_number: Optional[str] = None
    name: str
    cnpj_revenda: Optional[str] = None
    cnpj_admin: Optional[str] = None
    status: str
    created_at: str


class RevendasListResponse(BaseModel):
    """Lista de revendas"""

    total: int
    revendas: list[RevendaResponse]


class AdminCreateAdminRequest(BaseModel):
    """Requisição para admin criar outro admin"""

    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    phone_number: str = Field(
        ..., description="Telefone formatado (ex: +5511999999999)"
    )
    new_type: Optional[str] = None  # "superadmin" ou "admin" (superadmin escolhe)
    cnpj_admin: Optional[str] = (
        None  # CNPJ do novo admin (quando superadmin cria admin externo)
    )


class AdminUpdateRequest(BaseModel):
    """Requisição para atualizar admin/superadmin"""

    name: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[Literal["active", "pending", "rejected"]] = None
    cnpj_admin: Optional[str] = None


class AdminCreateRevendaRequest(BaseModel):
    """Requisição para admin criar revenda"""

    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str
    phone_number: str = Field(
        ..., description="Telefone formatado (ex: +5511999999999)"
    )
    cnpj_revenda: str  # CNPJ da revenda a ser criada
    cnpj_admin: Optional[str] = None  # CNPJ do admin que cria (para hierarquia)


class RevendaUpdateRequest(BaseModel):
    """Requisição para atualizar revenda"""

    name: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[Literal["active", "pending", "rejected"]] = None
    cnpj_revenda: Optional[str] = None
    cnpj_admin: Optional[str] = None


# ============================================================================
# Cliente Models
# ============================================================================


class ClienteResponse(BaseModel):
    """Dados de cliente"""

    _id: Optional[str] = None
    _rev: Optional[str] = None
    email: str
    phone_number: Optional[str] = None
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
    phone_number: str = Field(
        ..., description="Telefone formatado (ex: +5511999999999)"
    )
    password: str = Field(..., min_length=6)
    name: str
    cnpj_cliente: str  # CNPJ do cliente
    revenda_id: Optional[str] = None  # Opcional: admin atribui a uma revenda
    sub_role: Optional[str] = None  # Se não informado, default "superusuario"


class ClienteUpdateRequest(BaseModel):
    """Requisição para atualizar cliente"""

    name: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[Literal["active", "pending", "rejected"]] = None
    sub_role: Optional[Literal["superusuario", "gerente", "comum"]] = None
    revenda_id: Optional[str] = None
    cnpj_cliente: Optional[str] = None
    cnpj_admin: Optional[str] = None
    cnpj_revenda: Optional[str] = None


class SuperusuarioCreateUserRequest(BaseModel):
    """Requisição para superusuário criar gerente ou comum dentro da empresa"""

    email: EmailStr
    phone_number: str = Field(
        ..., description="Telefone formatado (ex: +5511999999999)"
    )
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
        None  # Se informado: CNPJ do cliente; se vazio: pivô próprio do admin/superadmin
    )
    equipamentos: List[str] = []  # ex: ["Painel 1", "Torre 1", "Casa de bombas"]
    location: Optional[Dict[str, float]] = None

    whatsapp: Optional[str] = None
    sms: Optional[str] = None
    email: Optional[str] = None


class UpdatePivoRequest(BaseModel):
    """Requisição para atualizar pivô"""

    nome: Optional[str] = None
    codigo: Optional[str] = None
    irrigador: Optional[str] = None
    ativo: Optional[bool] = None
    location: Optional[Dict[str, float]] = None
    equipamentos: Optional[List[str]] = None
    contacts: Optional[Dict[str, Optional[str]]] = None
    whatsapp: Optional[str] = None
    sms: Optional[str] = None
    email: Optional[str] = None


class PivoResponse(BaseModel):
    """Dados de pivô (created_at/updated_at opcionais para docs antigos do CouchDB)"""

    id: str = Field(..., alias="_id")
    codigo: str
    nome: str
    display_name: Optional[str] = None
    owner_id: str
    gerente_id: str
    ativo: bool
    nome_cliente: Optional[str] = None
    nome_revenda: Optional[str] = None
    nome_admin: Optional[str] = None
    cnpj_cliente: Optional[str] = None
    cnpj_revenda: Optional[str] = None
    cnpj_admin: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # Campos de status recente (populados quando with_recent=true)
    alarm_count: Optional[int] = None
    last_alert_date: Optional[str] = None
    last_sw_at: Optional[str] = None
    last_tensao_at: Optional[str] = None
    last_data_at: Optional[str] = None
    last_data_source: Optional[str] = None
    has_alarm: Optional[bool] = None

    model_config = {"populate_by_name": True, "by_alias": True}


class PivosListResponse(BaseModel):
    """Lista de pivôs"""

    total: int
    role: str
    pivos: list[PivoResponse]


class PivoRecentResponse(BaseModel):
    id: str = Field(..., alias="_id")
    alarm_count: Optional[int] = None
    last_alert_date: Optional[str] = None
    last_sw_at: Optional[str] = None
    last_tensao_at: Optional[str] = None
    last_data_at: Optional[str] = None
    last_data_source: Optional[str] = None
    has_alarm: Optional[bool] = None

    model_config = {"populate_by_name": True, "by_alias": True}


class PivosRecentResponse(BaseModel):
    """Status recente de pivôs (batch leve)"""

    total: int
    recents: list[PivoRecentResponse]
    debug: Optional[Dict[str, Any]] = None


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


class ForgotPasswordRequest(BaseModel):
    """Requisição para iniciar recuperação de senha"""

    email: EmailStr


class ConfirmForgotPasswordRequest(BaseModel):
    """Requisição para confirmar nova senha via código"""

    email: EmailStr
    code: str
    new_password: str = Field(..., min_length=6)


class ChangePasswordRequest(BaseModel):
    """Requisição para trocar senha (usuário autenticado)"""

    previous_password: str
    proposed_password: str = Field(..., min_length=6)
    access_token: Optional[str] = None


class LoginResponse(BaseModel):
    """Resposta de login com status de verificação/termos"""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    email_verified: bool = True
    terms_accepted: bool = False
    terms_version: Optional[str] = None
    requires_action: Optional[str] = None  # "verify_email", "accept_terms", None


# ============================================================================
# History Models
# ============================================================================


class MonitorVoltage(BaseModel):
    voltage: float
    status: int


class TensionDataField(BaseModel):
    monitores: Dict[str, MonitorVoltage]


class TensionPoint(BaseModel):
    timestamp: str
    tipo: str
    monitor_range: Optional[str] = None
    data: TensionDataField


class TensionHistoryResponse(BaseModel):
    irrigador_id: str
    points: List[TensionPoint]
    total_raw: int
    aggregated: bool
    series: Optional[List[Dict[str, Any]]] = None


class SWMonitorField(BaseModel):
    fim_de_curso_1: int
    fim_de_curso_2: int
    armadilha: int
    status: int


class SWDataField(BaseModel):
    painel_1: Optional[int] = None
    painel_2: Optional[int] = None
    lampada: Optional[int] = None
    sirene: Optional[int] = None
    manutencao: Optional[int] = None
    monitores: Optional[Dict[str, SWMonitorField]] = None


class SWPoint(BaseModel):
    id: str = Field(..., alias="_id")
    timestamp: str
    data: SWDataField

    model_config = {"populate_by_name": True}


class SWHistoryResponse(BaseModel):
    irrigador_id: str
    skip: int
    limit: int
    items: List[SWPoint]


class EventItem(BaseModel):
    id: str = Field(..., alias="_id")
    timestamp: str
    eventType: Optional[str] = None
    monitor: Optional[Any] = None
    estado: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    responsible: Optional[str] = None
    armadilha: Optional[str] = None

    model_config = {"populate_by_name": True}


class EventsHistoryResponse(BaseModel):
    irrigador_id: str
    total: int
    skip: int
    limit: int
    items: List[EventItem]


class AlertsHistoryResponse(BaseModel):
    irrigador_id: str
    total: int
    skip: int
    limit: int
    items: List[EventItem]
    alerts: Optional[List[Dict[str, Any]]] = None


class ChangeResult(BaseModel):
    seq: Any
    id: str
    changes: List[Dict[str, str]]
    deleted: Optional[bool] = None


class ChangesResponse(BaseModel):
    last_seq: Any
    pending: Optional[int] = None
    results: List[ChangeResult]


# ============================================================================
# Recent Models
# ============================================================================


class RecentTensionResponse(BaseModel):
    id: str = Field(..., alias="_id")
    irrigador_id: str
    tipo: str
    updated_at: Optional[str] = None
    data: TensionDataField

    model_config = {"populate_by_name": True}


class RecentSWResponse(BaseModel):
    id: str = Field(..., alias="_id")
    irrigador_id: str
    updated_at: Optional[str] = None
    data: SWDataField

    model_config = {"populate_by_name": True}


class RecentAllResponse(BaseModel):
    tensao: Optional[Dict[str, Any]] = None  # {A?, B?, C?, D?}
    sw: Optional[Any] = None
    overview: Optional[Dict[str, Any]] = None


# ============================================================================
# Notifications Config Models
# ============================================================================


class NotifAssinante(BaseModel):
    email: str
    msg_enabled: bool = False
    call_enabled: bool = False


class NotificationsConfigResponse(BaseModel):
    irrigador_id: str
    assinantes: List[NotifAssinante] = []


class NotificationsConfigUpdateRequest(BaseModel):
    email: str
    msg_enabled: bool
    call_enabled: bool
