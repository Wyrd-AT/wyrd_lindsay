#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Verificador de Permissões para Sistema Multi-Nível

Implementa controle de acesso baseado em hierarquia:
Admin > Revendas > Clientes

Uso:
    from permissions import PermissionChecker, Role

    user = {"type": "admin", "email": "admin@company.com"}
    checker = PermissionChecker(user)

    if checker.can_approve_revenda():
        # Aprovar revenda...
        pass
"""

from typing import Dict, Optional, Literal
from enum import Enum

# =============================================================================
# Enums
# =============================================================================


class Role(str, Enum):
    """Papéis de usuário no sistema"""

    ADMIN = "admin"
    REVENDA = "revenda"
    CLIENTE = "cliente"


class ClienteSubRole(str, Enum):
    """Sub-roles dentro do nível cliente"""

    SUPERUSUARIO = "superusuario"
    GERENTE = "gerente"
    COMUM = "comum"


class Permission(str, Enum):
    """Permissões do sistema"""

    # Admin
    MANAGE_REVENDAS = "manage_revendas"
    APPROVE_REVENDAS = "approve_revendas"
    VIEW_ALL_DATA = "view_all_data"
    VIEW_ALL_PIVOS = "view_all_pivos"
    MANAGE_SISTEMA = "manage_sistema"

    # Revenda (Gerente)
    MANAGE_CLIENTES = "manage_clientes"
    APPROVE_CLIENTES = "approve_clientes"
    VIEW_CLIENTES = "view_clientes"
    VIEW_CLIENTE_PIVOS = "view_cliente_pivos"
    CREATE_CLIENTE = "create_cliente"

    # Cliente
    VIEW_OWN_PIVOS = "view_own_pivos"
    CREATE_OWN_PIVOS = "create_own_pivos"
    REQUEST_REGISTER = "request_register"

    # Cliente Sub-Role permissions
    RESOLVE_ALERTS = "resolve_alerts"
    EXPORT_REPORTS = "export_reports"
    MANAGE_COMPANY_USERS = "manage_company_users"


# =============================================================================
# PermissionChecker
# =============================================================================


class PermissionChecker:
    """
    Verificador de permissões baseado em hierarquia

    Hierarquia:
    - ADMIN: Acesso total, aprova revendas
    - REVENDA: Gerencia seus clientes, aprova clientes
    - CLIENTE: Vê apenas seus pivôs
    """

    # Mapeamento de permissões por papel
    ROLE_PERMISSIONS = {
        Role.ADMIN: {
            Permission.MANAGE_REVENDAS,
            Permission.APPROVE_REVENDAS,
            Permission.VIEW_ALL_DATA,
            Permission.VIEW_ALL_PIVOS,
            Permission.MANAGE_SISTEMA,
            Permission.MANAGE_CLIENTES,
            Permission.VIEW_CLIENTES,
            Permission.VIEW_OWN_PIVOS,
            Permission.RESOLVE_ALERTS,
            Permission.EXPORT_REPORTS,
        },
        Role.REVENDA: {
            Permission.MANAGE_CLIENTES,
            Permission.APPROVE_CLIENTES,
            Permission.VIEW_CLIENTES,
            Permission.VIEW_CLIENTE_PIVOS,
            Permission.CREATE_CLIENTE,
            Permission.VIEW_OWN_PIVOS,
            Permission.RESOLVE_ALERTS,
            Permission.EXPORT_REPORTS,
        },
        Role.CLIENTE: {
            Permission.VIEW_OWN_PIVOS,
            Permission.CREATE_OWN_PIVOS,
            Permission.REQUEST_REGISTER,
        },
    }

    # Permissões por sub-role de cliente
    SUBROLE_PERMISSIONS = {
        ClienteSubRole.SUPERUSUARIO: {
            Permission.VIEW_OWN_PIVOS,
            Permission.CREATE_OWN_PIVOS,
            Permission.REQUEST_REGISTER,
            Permission.RESOLVE_ALERTS,
            Permission.EXPORT_REPORTS,
            Permission.MANAGE_COMPANY_USERS,
        },
        ClienteSubRole.GERENTE: {
            Permission.VIEW_OWN_PIVOS,
            Permission.CREATE_OWN_PIVOS,
            Permission.REQUEST_REGISTER,
            Permission.RESOLVE_ALERTS,
            Permission.EXPORT_REPORTS,
        },
        ClienteSubRole.COMUM: {
            Permission.VIEW_OWN_PIVOS,
            Permission.REQUEST_REGISTER,
        },
    }

    def __init__(self, user: Dict):
        """
        Inicializar verificador de permissões

        Args:
            user: Dicionário com dados do usuário
                {
                    "type": "admin|revenda|cliente",
                    "email": "user@example.com",
                    "status": "active|pending|rejected",
                    "doc_id": "admin:user@example.com",  # opcional
                    "domain": "revenda.com"  # para revendas
                }
        """
        self.user = user
        self.role = Role(user.get("type", "cliente"))
        self.status = user.get("status", "pending")
        self.email = user.get("email")
        self.doc_id = user.get("doc_id")
        # Sub-role para clientes (backward compat: sem sub_role = superusuario)
        sr = user.get("sub_role")
        if self.role == Role.CLIENTE:
            self.sub_role = ClienteSubRole(sr) if sr else ClienteSubRole.SUPERUSUARIO
        else:
            self.sub_role = None

    # =====================================================================
    # Status Checks
    # =====================================================================

    def is_active(self) -> bool:
        """Verificar se usuário está ativo"""
        return self.status == "active"

    def is_pending(self) -> bool:
        """Verificar se usuário está pendente de aprovação"""
        return self.status == "pending"

    def is_rejected(self) -> bool:
        """Verificar se usuário foi rejeitado"""
        return self.status == "rejected"

    # =====================================================================
    # Basic Permission Checks
    # =====================================================================

    def has_permission(self, permission: Permission) -> bool:
        """Verificar se usuário tem uma permissão específica"""
        # Para clientes, usar sub-role permissions
        if self.role == Role.CLIENTE and self.sub_role:
            permissions = self.SUBROLE_PERMISSIONS.get(self.sub_role, set())
            return permission in permissions
        permissions = self.ROLE_PERMISSIONS.get(self.role, set())
        return permission in permissions

    def has_any_permission(self, *permissions: Permission) -> bool:
        """Verificar se usuário tem qualquer uma das permissões"""
        return any(self.has_permission(p) for p in permissions)

    def has_all_permissions(self, *permissions: Permission) -> bool:
        """Verificar se usuário tem todas as permissões"""
        return all(self.has_permission(p) for p in permissions)

    # =====================================================================
    # Admin Checks
    # =====================================================================

    def is_admin(self) -> bool:
        """Verificar se usuário é admin"""
        return self.role == Role.ADMIN

    def is_active_admin(self) -> bool:
        """Verificar se usuário é admin ativo"""
        return self.is_admin() and self.is_active()

    def can_manage_revendas(self) -> bool:
        """Admin pode gerenciar revendas"""
        return self.has_permission(Permission.MANAGE_REVENDAS) and self.is_active()

    def can_approve_revendas(self) -> bool:
        """Admin pode aprovar revendas"""
        return self.has_permission(Permission.APPROVE_REVENDAS) and self.is_active()

    def can_manage_sistema(self) -> bool:
        """Admin pode gerenciar sistema"""
        return self.has_permission(Permission.MANAGE_SISTEMA) and self.is_active()

    def can_view_all_data(self) -> bool:
        """Admin pode visualizar todos os dados"""
        return self.has_permission(Permission.VIEW_ALL_DATA) and self.is_active()

    # =====================================================================
    # Revenda Checks
    # =====================================================================

    def is_revenda(self) -> bool:
        """Verificar se usuário é revenda"""
        return self.role == Role.REVENDA

    def is_active_revenda(self) -> bool:
        """Verificar se usuário é revenda ativa"""
        return self.is_revenda() and self.is_active()

    def can_manage_clientes(self) -> bool:
        """Revenda pode gerenciar seus clientes"""
        return self.has_permission(Permission.MANAGE_CLIENTES) and self.is_active()

    def can_approve_clientes(self) -> bool:
        """Revenda pode aprovar seus clientes"""
        return self.has_permission(Permission.APPROVE_CLIENTES) and self.is_active()

    def can_view_clientes(self) -> bool:
        """Revenda pode visualizar seus clientes"""
        return self.has_permission(Permission.VIEW_CLIENTES) and self.is_active()

    # =====================================================================
    # Cliente Checks
    # =====================================================================

    def is_cliente(self) -> bool:
        """Verificar se usuário é cliente"""
        return self.role == Role.CLIENTE

    def is_active_cliente(self) -> bool:
        """Verificar se usuário é cliente ativo"""
        return self.is_cliente() and self.is_active()

    def can_view_pivos(self) -> bool:
        """Cliente pode visualizar seus pivôs"""
        return self.has_permission(Permission.VIEW_OWN_PIVOS) and self.is_active()

    def can_request_register(self) -> bool:
        """Cliente pode solicitar registro"""
        return self.has_permission(Permission.REQUEST_REGISTER)

    # =====================================================================
    # Resource-based Access Control (RBAC)
    # =====================================================================

    def can_view_revenda(self, revenda_id: str) -> bool:
        """
        Verificar se usuário pode visualizar uma revenda

        Regras:
        - Admin: pode ver qualquer revenda
        - Revenda: pode ver a si mesma
        - Cliente: não pode ver revendas
        """
        if not self.is_active():
            return False

        if self.is_admin():
            return True

        if self.is_revenda():
            # Revenda pode ver a si mesma
            return self.doc_id == revenda_id

        return False

    def can_view_cliente(
        self, cliente_email: str, revenda_id: str, is_owner: bool = False
    ) -> bool:
        """
        Verificar se usuário pode visualizar um cliente

        Regras:
        - Admin: pode ver qualquer cliente
        - Revenda: pode ver clientes de sua revenda
        - Cliente: pode ver apenas a si mesmo
        """
        if not self.is_active():
            return False

        if self.is_admin():
            return True

        if self.is_revenda():
            # Revenda pode ver clientes de sua revenda
            return self.doc_id == revenda_id

        if self.is_cliente():
            # Cliente pode ver apenas a si mesmo
            return is_owner and self.email == cliente_email

        return False

    def can_view_pivo(
        self, pivo_id: str, cliente_email: str, revenda_id: str, is_owner: bool = False
    ) -> bool:
        """
        Verificar se usuário pode visualizar um pivô

        Regras:
        - Admin: pode ver qualquer pivô
        - Revenda: pode ver pivôs de seus clientes
        - Cliente: pode ver apenas seus pivôs
        """
        if not self.is_active():
            return False

        if self.is_admin():
            return True

        if self.is_revenda():
            # Revenda vê pivôs de seus clientes
            return self.doc_id == revenda_id

        if self.is_cliente():
            # Cliente vê apenas seus pivôs
            return is_owner and self.email == cliente_email

        return False

    # FASE 2: Novos métodos para visualização de pivôs =====================
    def can_view_all_pivos(self) -> bool:
        """Admin pode visualizar todos os pivôs"""
        return self.has_permission(Permission.VIEW_ALL_PIVOS) and self.is_active()

    def can_view_cliente_pivos(self) -> bool:
        """Revenda (gerente) pode visualizar pivôs dos seus clientes"""
        return self.has_permission(Permission.VIEW_CLIENTE_PIVOS) and self.is_active()

    def can_create_pivo(self) -> bool:
        """Apenas admin pode criar novos pivôs (hierarquia associada ao cliente)"""
        return self.is_admin() and self.is_active()

    def can_create_cliente(self) -> bool:
        """Revenda (gerente) pode criar novos clientes"""
        return self.has_permission(Permission.CREATE_CLIENTE) and self.is_active()

    # =====================================================================
    # Approval Checks
    # =====================================================================

    def can_approve_revenda(self) -> bool:
        """Apenas admin pode aprovar revendas"""
        return self.is_active_admin() and self.can_approve_revendas()

    def can_approve_cliente(self) -> bool:
        """Apenas revenda ativa pode aprovar clientes"""
        return self.is_active_revenda() and self.can_approve_clientes()

    def can_reject_revenda(self) -> bool:
        """Apenas admin pode rejeitar revendas"""
        return self.is_active_admin()

    def can_reject_cliente(self) -> bool:
        """Apenas revenda ativa pode rejeitar clientes"""
        return self.is_active_revenda()

    # =====================================================================
    # Cliente Sub-Role Checks
    # =====================================================================

    def is_superusuario(self) -> bool:
        """Verificar se é cliente superusuário"""
        return self.is_cliente() and self.sub_role == ClienteSubRole.SUPERUSUARIO

    def is_gerente_cliente(self) -> bool:
        """Verificar se é cliente gerente"""
        return self.is_cliente() and self.sub_role == ClienteSubRole.GERENTE

    def is_comum(self) -> bool:
        """Verificar se é cliente comum"""
        return self.is_cliente() and self.sub_role == ClienteSubRole.COMUM

    def can_resolve_alerts(self) -> bool:
        """Pode resolver alertas (superusuario, gerente, admin, revenda)"""
        return self.has_permission(Permission.RESOLVE_ALERTS) and self.is_active()

    def can_export_reports(self) -> bool:
        """Pode exportar relatórios (superusuario, gerente, admin, revenda)"""
        return self.has_permission(Permission.EXPORT_REPORTS) and self.is_active()

    def can_manage_company_users(self) -> bool:
        """Pode gerenciar usuários da empresa (apenas superusuário)"""
        return self.has_permission(Permission.MANAGE_COMPANY_USERS) and self.is_active()

    # =====================================================================
    # Summary
    # =====================================================================

    def get_permissions(self) -> set:
        """Obter todas as permissões do usuário"""
        return self.ROLE_PERMISSIONS.get(self.role, set())

    def get_access_level(self) -> str:
        """Obter nível de acesso"""
        if not self.is_active():
            return f"{self.status}_{self.role}"
        return str(self.role)

    def to_dict(self) -> Dict:
        """Converter checker para dicionário para logging/debugging"""
        return {
            "role": str(self.role),
            "sub_role": str(self.sub_role) if self.sub_role else None,
            "status": self.status,
            "is_active": self.is_active(),
            "permissions": [str(p) for p in self.get_permissions()],
            "access_level": self.get_access_level(),
        }
