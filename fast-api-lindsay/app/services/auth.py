#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Autenticação Multi-Nível para Sistema Lindsay
(Admin > Revendas > Clientes)

Funcionalidades:
- Registrar usuários por tipo (Admin, Revenda, Cliente)
- Autenticar usuários
- Aprovar/Rejeitar registros
- Gerenciar status de usuários

Uso:
    from auth_service import AuthService
    auth = AuthService(couchdb_url, database_name)
    result = auth.register_revenda('domain@example.com', ...)
"""

import hashlib
import secrets
from typing import Dict, Optional, Literal, List
from datetime import datetime
from enum import Enum
import couchdb
from pydantic import BaseModel, EmailStr, validator

# =============================================================================
# Models
# =============================================================================


class UserType(str, Enum):
    ADMIN = "admin"
    REVENDA = "revenda"
    CLIENTE = "cliente"


class UserStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    REJECTED = "rejected"


class AdminUser(BaseModel):
    email: EmailStr
    name: str
    type: Literal["admin"] = "admin"
    status: Literal["active"] = "active"


class RevendaUser(BaseModel):
    email: EmailStr
    domain: str
    name: str
    type: Literal["revenda"] = "revenda"
    status: UserStatus = UserStatus.PENDING


class ClienteUser(BaseModel):
    email: EmailStr
    name: str
    revenda_id: str
    type: Literal["cliente"] = "cliente"
    status: UserStatus = UserStatus.PENDING


class ApprovalResult(BaseModel):
    status: Literal["success", "error"]
    message: str
    document_id: Optional[str] = None


# =============================================================================
# AuthService
# =============================================================================


class AuthService:
    """Serviço de autenticação e autorização multi-nível"""

    def __init__(self, couchdb_url: str, database: str):
        """
        Inicializar AuthService

        Args:
            couchdb_url: URL do CouchDB (ex: https://admin:wyrd@db.vpn.ind.br)
            database: Nome do database (ex: lindsay-data)
        """
        self.couchdb_url = couchdb_url
        self.database = database
        try:
            self.server = couchdb.Server(couchdb_url)
            self.db = self.server[database]
        except Exception as e:
            raise Exception(f"Falha ao conectar ao CouchDB: {e}")

    # =====================================================================
    # Password Management
    # =====================================================================

    @staticmethod
    def hash_password(password: str) -> str:
        """
        Hash de senha com salt PBKDF2

        Formato: {salt}${hash}
        Exemplo: abc123def456$789xyz...
        """
        salt = secrets.token_hex(16)  # 32 caracteres
        pwd_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt.encode(),
            100000,  # 100k iterations
        )
        return f"{salt}${pwd_hash.hex()}"

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        """Verifica se a senha corresponde ao hash"""
        try:
            salt, stored_hash = password_hash.split("$")
            computed = hashlib.pbkdf2_hmac(
                "sha256", password.encode(), salt.encode(), 100000
            )
            return computed.hex() == stored_hash
        except Exception:
            return False

    # =====================================================================
    # ADMIN Operations
    # =====================================================================

    def register_admin(
        self,
        email: str,
        name: str,
        password: str,
        cnpj_admin: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> ApprovalResult:
        """
        Registrar novo ADMIN

        ⚠️ Apenas outro admin pode criar novo admin
        """
        doc_id = f"admin:{email}"

        try:
            # Verificar se já existe
            existing = self.db.get(doc_id)
            if existing is not None:
                return ApprovalResult(
                    status="error", message=f"Admin '{email}' já existe"
                )

            now = datetime.utcnow().isoformat()
            admin_doc = {
                "_id": doc_id,
                "type": "admin",
                "email": email,
                "name": name,
                "password_hash": self.hash_password(password),
                "cnpj_admin": cnpj_admin,
                "revendas": [],
                "status": "active",
                "created_by": created_by or "system",
                "created_at": now,
                # Verificação & Termos
                "email_verified": True,  # Admin criado pelo sistema = verificado
                "email_verified_at": now,
                "terms_accepted": False,
                "terms_version": None,
                "terms_accepted_at": None,
                "terms_accepted_ip": None,
                "first_login_at": None,
                "last_login_at": None,
            }

            self.db.save(admin_doc)
            return ApprovalResult(
                status="success",
                message=f"Admin '{email}' registrado com sucesso",
                document_id=doc_id,
            )

        except Exception as e:
            return ApprovalResult(status="error", message=str(e))

    # =====================================================================
    # REVENDA Operations
    # =====================================================================

    def register_revenda(
        self, email: str, domain: str, name: str, password: str
    ) -> ApprovalResult:
        """
        Registrar nova REVENDA

        Status inicial: PENDING (aguarda aprovação do admin)
        """
        doc_id = f"revenda:{domain}"

        try:
            # Verificar se domain já existe
            existing = self.db.get(doc_id)
            if existing is not None:
                return ApprovalResult(
                    status="error", message=f"Revenda com domínio '{domain}' já existe"
                )

            now = datetime.utcnow().isoformat()
            revenda_doc = {
                "_id": doc_id,
                "type": "revenda",
                "domain": domain,
                "email": email,
                "name": name,
                "password_hash": self.hash_password(password),
                "status": "pending",  # Admin deve aprovar
                "clientes": [],
                "created_at": now,
                # Verificação & Termos
                "email_verified": False,
                "email_verified_at": None,
                "terms_accepted": False,
                "terms_version": None,
                "terms_accepted_at": None,
                "terms_accepted_ip": None,
                "first_login_at": None,
                "last_login_at": None,
            }

            self.db.save(revenda_doc)
            return ApprovalResult(
                status="success",
                message=f"Revenda '{domain}' registrada. Aguardando aprovação do admin.",
                document_id=doc_id,
            )

        except Exception as e:
            return ApprovalResult(status="error", message=str(e))

    def approve_revenda(
        self,
        revenda_id: str,
        approved_by: str,
        approved: bool = True,
        reason: Optional[str] = None,
    ) -> ApprovalResult:
        """
        ADMIN aprova ou rejeita REVENDA

        Args:
            revenda_id: ID do documento revenda (ex: revenda:domain.com)
            approved_by: Email do admin que aprova
            approved: True para aprovar, False para rejeitar
            reason: Motivo da rejeição (opcional)
        """
        try:
            revenda_doc = self.db.get(revenda_id)

            if revenda_doc.get("status") != "pending":
                return ApprovalResult(
                    status="error",
                    message=f"Revenda não está em status 'pending' (status atual: {revenda_doc.get('status')})",
                )

            revenda_doc["status"] = "active" if approved else "rejected"
            revenda_doc["approved_by"] = approved_by
            revenda_doc["approved_at"] = datetime.utcnow().isoformat()

            if reason:
                revenda_doc["approval_reason"] = reason

            self.db.save(revenda_doc)

            action = "aprovada" if approved else "rejeitada"
            return ApprovalResult(
                status="success",
                message=f"Revenda {action} com sucesso",
                document_id=revenda_id,
            )

        except couchdb.http.ResourceNotFound:
            return ApprovalResult(
                status="error", message=f"Revenda '{revenda_id}' não encontrada"
            )
        except Exception as e:
            return ApprovalResult(status="error", message=str(e))

    # =====================================================================
    # CLIENTE Operations
    # =====================================================================

    def register_cliente(
        self, email: str, name: str, revenda_id: str, password: str
    ) -> ApprovalResult:
        """
        Registrar novo CLIENTE

        Status inicial: PENDING (revenda deve aprovar)
        Cliente é salvo como item no array 'clientes' da revenda
        """
        try:
            # Buscar revenda
            revenda_doc = self.db.get(revenda_id)

            if revenda_doc.get("type") != "revenda":
                return ApprovalResult(
                    status="error", message="ID fornecido não é uma revenda válida"
                )

            if revenda_doc.get("status") != "active":
                return ApprovalResult(
                    status="error",
                    message="Revenda não está ativa para aceitar clientes",
                )

            # Verificar se cliente já existe
            for cliente in revenda_doc.get("clientes", []):
                if cliente.get("email") == email:
                    return ApprovalResult(
                        status="error",
                        message=f"Cliente '{email}' já registrado nesta revenda",
                    )

            # Criar cliente
            now = datetime.utcnow().isoformat()
            cliente = {
                "_id": f"cliente:{email}",
                "email": email,
                "name": name,
                "password_hash": self.hash_password(password),
                "status": "pending",  # Revenda deve aprovar
                "pivoIds": [],
                "created_at": now,
                # Verificação & Termos
                "email_verified": False,
                "email_verified_at": None,
                "terms_accepted": False,
                "terms_version": None,
                "terms_accepted_at": None,
                "terms_accepted_ip": None,
                "first_login_at": None,
                "last_login_at": None,
            }

            # Adicionar ao array de clientes
            revenda_doc.setdefault("clientes", []).append(cliente)
            self.db.save(revenda_doc)

            return ApprovalResult(
                status="success",
                message=f"Cliente '{email}' registrado. Aguardando aprovação da revenda.",
                document_id=f"cliente:{email}",
            )

        except couchdb.http.ResourceNotFound:
            return ApprovalResult(
                status="error", message=f"Revenda '{revenda_id}' não encontrada"
            )
        except Exception as e:
            return ApprovalResult(status="error", message=str(e))

    def approve_cliente(
        self,
        revenda_id: str,
        cliente_email: str,
        approved: bool = True,
        reason: Optional[str] = None,
    ) -> ApprovalResult:
        """
        REVENDA aprova ou rejeita CLIENTE

        Args:
            revenda_id: ID do documento revenda
            cliente_email: Email do cliente a aprovar
            approved: True para aprovar, False para rejeitar
            reason: Motivo da rejeição (opcional)
        """
        try:
            revenda_doc = self.db.get(revenda_id)

            # Buscar cliente no array
            cliente_encontrado = False
            for cliente in revenda_doc.get("clientes", []):
                if cliente.get("email") == cliente_email:
                    cliente_encontrado = True

                    if cliente.get("status") != "pending":
                        return ApprovalResult(
                            status="error",
                            message=f"Cliente não está em status 'pending' (status: {cliente.get('status')})",
                        )

                    cliente["status"] = "active" if approved else "rejected"
                    cliente["approved_at"] = datetime.utcnow().isoformat()

                    if reason:
                        cliente["approval_reason"] = reason

                    break

            if not cliente_encontrado:
                return ApprovalResult(
                    status="error",
                    message=f"Cliente '{cliente_email}' não encontrado nesta revenda",
                )

            # Salvar revenda com cliente atualizado
            self.db.save(revenda_doc)

            action = "aprovado" if approved else "rejeitado"
            return ApprovalResult(
                status="success",
                message=f"Cliente {action} com sucesso",
                document_id=f"cliente:{cliente_email}",
            )

        except couchdb.http.ResourceNotFound:
            return ApprovalResult(
                status="error", message=f"Revenda '{revenda_id}' não encontrada"
            )
        except Exception as e:
            return ApprovalResult(status="error", message=str(e))

    # =====================================================================
    # Authentication
    # =====================================================================

    def authenticate(
        self, email: str, password: str, user_type: UserType
    ) -> Optional[Dict]:
        """
        Autenticar usuário

        Args:
            email: Email do usuário
            password: Senha em plain text
            user_type: Tipo de usuário (admin/revenda)

        Returns:
            Dicionário com dados do usuário ou None se falhar
        """
        try:
            if user_type == UserType.ADMIN:
                doc_id = f"admin:{email}"
                doc = self.db.get(doc_id)

                if not doc or doc.get("status") != "active":
                    return None

                if self.verify_password(password, doc.get("password_hash", "")):
                    return {
                        "email": doc["email"],
                        "name": doc["name"],
                        "type": "admin",
                        "status": doc["status"],
                        "doc_id": doc_id,
                    }

            elif user_type == UserType.REVENDA:
                # Buscar por domain (query)
                results = self.db.view("app/revenda_by_domain", key=email.split("@")[1])

                for row in results:
                    doc = self.db.get(row.value)
                    if doc.get("email") == email and self.verify_password(
                        password, doc.get("password_hash", "")
                    ):
                        return {
                            "email": doc["email"],
                            "name": doc["name"],
                            "type": "revenda",
                            "status": doc["status"],
                            "domain": doc["domain"],
                            "doc_id": doc["_id"],
                        }

        except Exception as e:
            print(f"Erro durante autenticação: {e}")
            return None

        return None

    # =====================================================================
    # Query Methods
    # =====================================================================

    def get_pending_revendas(self) -> List[Dict]:
        """Obter todas as revendas pendentes de aprovação"""
        try:
            results = self.db.view("app/revendas_by_status", key="pending")
            return [row.value for row in results]
        except Exception as e:
            print(f"Erro ao buscar revendas pendentes: {e}")
            return []

    def get_pending_clientes(self, revenda_id: str) -> List[Dict]:
        """Obter clientes pendentes de uma revenda"""
        try:
            results = self.db.view("app/clientes_pending_approval", key=revenda_id)
            return [row.value for row in results]
        except Exception as e:
            print(f"Erro ao buscar clientes pendentes: {e}")
            return []

    def get_revenda_clientes(
        self, revenda_id: str, status: Optional[str] = None
    ) -> List[Dict]:
        """Obter clientes de uma revenda (opcionalmente filtrados por status)"""
        try:
            revenda_doc = self.db.get(revenda_id)
            clientes = revenda_doc.get("clientes", [])

            if status:
                clientes = [c for c in clientes if c.get("status") == status]

            return clientes
        except Exception as e:
            print(f"Erro ao buscar clientes da revenda: {e}")
            return []
