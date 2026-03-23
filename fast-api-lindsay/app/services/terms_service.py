#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Termos de Uso

Gerencia:
- Versão atual dos termos
- Aceitação com registro LGPD (IP, timestamp, versão)
- Verificação de re-aceitação quando versão muda
"""

import logging
from datetime import datetime
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Conteúdo dos termos (pode ser movido para CouchDB no futuro)
TERMS_CONTENT = """
1. Sobre a Aplicação

O objetivo desta aplicação é exclusivamente emitir alertas sobre possíveis situações de risco ou anomalias detectadas. A plataforma funciona como um sistema de monitoramento e notificação para auxiliar na tomada de decisões.

2. Limitação de Responsabilidade

A aplicação NÃO se responsabiliza por furtos, roubos ou qualquer outro tipo de prejuízo material ou pessoal. Os alertas emitidos são baseados em dados e padrões detectados e devem ser interpretados como avisos informativos, não como garantias de segurança.

3. Uso da Plataforma

O usuário reconhece que:
- Os alertas são notificações informativas e não devem ser considerados como diagnósticos definitivos
- A responsabilidade por ações tomadas com base nos alertas é exclusivamente do usuário
- A aplicação não garante a precisão 100% dos alertas
- Deve-se sempre exercer bom senso e julgamento próprio ao interpretar os alertas

4. Consentimento

Ao criar uma conta e usar esta aplicação, você concorda com todos os termos acima descritos.
""".strip()


class TermsService:
    """Serviço de gerenciamento de termos de uso"""

    def __init__(self, db):
        self.db = db

    def get_current_terms(self) -> dict:
        """Retornar termos de uso atuais"""
        return {
            "version": settings.CURRENT_TERMS_VERSION,
            "content": TERMS_CONTENT,
            "effective_date": "2026-01-01",
        }

    def accept_terms(
        self, email: str, version: str, ip_address: str
    ) -> tuple[bool, str]:
        """
        Registrar aceitação de termos de uso (LGPD compliant)

        Returns:
            (success, error_message)
        """
        # Buscar documento do usuário
        user_doc = self._get_user_doc(email)
        if not user_doc:
            return False, "Usuário não encontrado"

        if version != settings.CURRENT_TERMS_VERSION:
            return False, f"Versão dos termos inválida. Versão atual: {settings.CURRENT_TERMS_VERSION}"

        now = datetime.utcnow().isoformat()

        # Registrar aceitação
        user_doc["terms_accepted"] = True
        user_doc["terms_version"] = version
        user_doc["terms_accepted_at"] = now
        user_doc["terms_accepted_ip"] = ip_address

        # Histórico de aceitações (audit trail LGPD)
        acceptance_history = user_doc.get("terms_acceptance_history", [])
        acceptance_history.append({
            "version": version,
            "accepted_at": now,
            "ip_address": ip_address,
        })
        user_doc["terms_acceptance_history"] = acceptance_history

        self.db.save(user_doc)

        logger.info(f"Termos v{version} aceitos por {email} (IP: {ip_address})")
        return True, ""

    def needs_terms_acceptance(self, user_doc: dict) -> bool:
        """
        Verificar se o usuário precisa aceitar termos

        Retorna True se:
        - Nunca aceitou termos
        - Aceitou versão desatualizada
        """
        if not user_doc.get("terms_accepted", False):
            return True

        accepted_version = user_doc.get("terms_version", "")
        return accepted_version != settings.CURRENT_TERMS_VERSION

    def _get_user_doc(self, email: str) -> Optional[dict]:
        """Buscar documento do usuário por email"""
        for prefix in ["user:", "admin:", "revenda:"]:
            doc_id = f"{prefix}{email}"
            try:
                doc = self.db.get(doc_id)
                if doc:
                    return doc
            except Exception:
                continue

        try:
            result = self.db.find({"selector": {"email": email}, "limit": 1})
            docs = list(result)
            if docs:
                return docs[0]
        except Exception:
            pass

        return None
