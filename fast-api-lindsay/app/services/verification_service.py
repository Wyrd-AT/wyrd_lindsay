#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Verificação de Email

Gerencia:
- Geração de códigos de verificação (6 dígitos, hashed)
- Validação de códigos com rate limiting
- Tokens de convite para clientes criados por admin/revenda
"""

import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


class VerificationService:
    """Serviço de verificação de email e convites"""

    def __init__(self, db):
        self.db = db

    @staticmethod
    def _hash_code(code: str) -> str:
        """Hash rápido para códigos de verificação (SHA-256)"""
        return hashlib.sha256(code.encode()).hexdigest()

    def _get_user_doc(self, email: str) -> Optional[dict]:
        """Buscar documento do usuário por email"""
        # Tentar formatos conhecidos
        for prefix in ["user:", "admin:", "revenda:"]:
            doc_id = f"{prefix}{email}"
            try:
                doc = self.db.get(doc_id)
                if doc:
                    return doc
            except Exception:
                continue

        # Fallback: buscar por email via Mango
        try:
            result = self.db.find({"selector": {"email": email}, "limit": 1})
            docs = list(result)
            if docs:
                return docs[0]
        except Exception:
            pass

        return None

    def generate_code(self, email: str) -> Tuple[bool, str, str]:
        """
        Gerar código de verificação de 6 dígitos

        Returns:
            (success, plain_code_or_error, message)
        """
        user_doc = self._get_user_doc(email)
        if not user_doc:
            return False, "", "Usuário não encontrado"

        if user_doc.get("email_verified"):
            return False, "", "Email já verificado"

        # Gerar código de 6 dígitos
        code = f"{secrets.randbelow(1000000):06d}"
        code_hash = self._hash_code(code)

        now = datetime.utcnow()
        expires_at = now + timedelta(minutes=settings.VERIFICATION_CODE_EXPIRY_MINUTES)

        # Atualizar documento
        user_doc["verification_code"] = code_hash
        user_doc["verification_expires_at"] = expires_at.isoformat()
        user_doc["verification_attempts"] = 0

        # Rate limiting: registrar envio
        resend_history = user_doc.get("resend_history", [])
        resend_history.append(now.isoformat())
        # Manter apenas últimas 10 entradas
        user_doc["resend_history"] = resend_history[-10:]

        self.db.save(user_doc)

        logger.info(f"Código de verificação gerado para {email}")
        return True, code, "Código gerado com sucesso"

    def verify_code(self, email: str, code: str) -> Tuple[bool, str]:
        """
        Verificar código de email

        Returns:
            (success, error_message)
        """
        user_doc = self._get_user_doc(email)
        if not user_doc:
            return False, "Usuário não encontrado"

        if user_doc.get("email_verified"):
            return True, ""

        # Checar tentativas
        attempts = user_doc.get("verification_attempts", 0)
        if attempts >= settings.MAX_VERIFICATION_ATTEMPTS:
            return False, "Número máximo de tentativas excedido. Solicite um novo código."

        # Checar expiração
        expires_at = user_doc.get("verification_expires_at")
        if not expires_at:
            return False, "Nenhum código de verificação pendente. Solicite um novo código."

        if datetime.utcnow() > datetime.fromisoformat(expires_at):
            return False, "Código expirado. Solicite um novo código."

        # Verificar hash
        stored_hash = user_doc.get("verification_code", "")
        if self._hash_code(code) != stored_hash:
            user_doc["verification_attempts"] = attempts + 1
            self.db.save(user_doc)
            remaining = settings.MAX_VERIFICATION_ATTEMPTS - (attempts + 1)
            return False, f"Código inválido. {remaining} tentativa(s) restante(s)."

        # Sucesso: marcar email como verificado
        now = datetime.utcnow().isoformat()
        user_doc["email_verified"] = True
        user_doc["email_verified_at"] = now
        user_doc["verification_code"] = None
        user_doc["verification_expires_at"] = None
        user_doc["verification_attempts"] = 0

        self.db.save(user_doc)

        logger.info(f"Email verificado com sucesso: {email}")
        return True, ""

    def can_resend(self, email: str) -> Tuple[bool, str]:
        """
        Verificar se pode reenviar código (rate limit: MAX_RESEND_PER_HOUR/hora)

        Returns:
            (can_resend, error_message)
        """
        user_doc = self._get_user_doc(email)
        if not user_doc:
            return False, "Usuário não encontrado"

        if user_doc.get("email_verified"):
            return False, "Email já verificado"

        resend_history = user_doc.get("resend_history", [])
        one_hour_ago = (datetime.utcnow() - timedelta(hours=1)).isoformat()

        recent_sends = [ts for ts in resend_history if ts > one_hour_ago]

        if len(recent_sends) >= settings.MAX_RESEND_PER_HOUR:
            return False, f"Limite de {settings.MAX_RESEND_PER_HOUR} reenvios por hora atingido. Tente novamente mais tarde."

        return True, ""

    def generate_invitation_token(self, email: str) -> Tuple[bool, str, str]:
        """
        Gerar token de convite para clientes criados por admin/revenda

        Returns:
            (success, plain_token_or_error, message)
        """
        user_doc = self._get_user_doc(email)
        if not user_doc:
            return False, "", "Usuário não encontrado"

        token = secrets.token_urlsafe(32)
        token_hash = self._hash_code(token)

        expires_at = datetime.utcnow() + timedelta(
            hours=settings.INVITATION_TOKEN_EXPIRY_HOURS
        )

        user_doc["invitation_token"] = token_hash
        user_doc["invitation_expires_at"] = expires_at.isoformat()

        self.db.save(user_doc)

        logger.info(f"Token de convite gerado para {email}")
        return True, token, "Token de convite gerado"

    def verify_invitation_token(self, token: str) -> Optional[dict]:
        """
        Verificar token de convite e retornar documento do usuário

        Returns:
            user_doc ou None
        """
        token_hash = self._hash_code(token)

        try:
            result = self.db.find({
                "selector": {"invitation_token": token_hash},
                "limit": 1,
            })
            docs = list(result)

            if not docs:
                return None

            user_doc = docs[0]

            # Checar expiração
            expires_at = user_doc.get("invitation_expires_at")
            if expires_at and datetime.utcnow() > datetime.fromisoformat(expires_at):
                return None

            return user_doc

        except Exception as e:
            logger.error(f"Erro ao verificar token de convite: {e}")
            return None
