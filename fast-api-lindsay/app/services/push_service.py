#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Push Notifications via Expo
========================================

Gerencia device tokens e envia notificações push para apps mobile.
"""

import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
import couchdb
from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)

logger = logging.getLogger(__name__)
BR_TZ = ZoneInfo("America/Sao_Paulo")


class PushService:
    """Serviço de notificações push via Expo"""

    def __init__(self, db: couchdb.Database):
        """
        Inicializar serviço de push

        Args:
            db: Instância do banco CouchDB
        """
        self.db = db
        self.expo_client = PushClient()

        # Mapeamento de tipos de alarme
        self.ALARM_PRIORITY_MAP = {
            "A": "critical",   # Tensão < 50V
            "B": "high",       # Fim de curso 1
            "C": "high",       # Fim de curso 2
            "D": "medium",     # Memória tensão baixa
            "E": "critical",   # Torre ausente
        }

        self.ALARM_TYPE_DESCRIPTIONS = {
            "A": "Tensão abaixo de 50V",
            "B": "Fim-de-curso 1 (SW1)",
            "C": "Fim-de-curso 2 (SW2)",
            "D": "Memória de Tensão baixa",
            "E": "Torre ausente",
        }

        # Criar índice de device tokens
        self.ensure_device_tokens_index()

    # =========================================================================
    # Índices
    # =========================================================================

    def ensure_device_tokens_index(self) -> None:
        """Criar índice no CouchDB para otimizar queries de device_tokens"""
        try:
            index_def = {
                "index": {
                    "fields": ["table", "irrigadorIds", "enabled"]
                },
                "name": "idx_device_tokens_irrigadores",
                "type": "json"
            }

            # Usar HTTP diretamente para criar índice Mango
            couchdb_url = os.getenv("COUCHDB_URL", "https://admin:wyrd@db.vpn.ind.br")
            db_name = os.getenv("COUCHDB_DB", "lindsay-data")
            response = requests.post(
                f"{couchdb_url}/{db_name}/_index",
                json=index_def
            )

            if response.status_code in (200, 201):
                logger.info("✅ Índice de device_tokens verificado")
            else:
                logger.warning(f"⚠️ Aviso ao criar índice: {response.status_code}")

        except Exception as e:
            logger.warning(f"⚠️ Erro ao criar índice (não crítico): {e}")

    # =========================================================================
    # Device Token Management
    # =========================================================================

    def get_device_tokens(self, irrigador_id: str) -> List[Dict[str, Any]]:
        """
        Obter device tokens para um irrigador

        Args:
            irrigador_id: ID do irrigador

        Returns:
            Lista de documentos com device tokens
        """
        try:
            # Query: buscar documentos com table=device_token e irrigador_id específico
            selector = {
                "table": "device_token",
                "enabled": True,
                "irrigadorIds": {"$elemMatch": {"$eq": irrigador_id}},
            }

            response = self.db.find(selector, limit=100)
            return response if response else []

        except Exception as e:
            logger.error(f"❌ Erro ao buscar device tokens: {e}")
            return []

    def register_device_token(
        self,
        device_token: str,
        irrigador_ids: List[str],
        device_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Registrar novo device token

        Args:
            device_token: Token Expo push
            irrigador_ids: IDs dos irrigadores que este device pode acessar
            device_info: Info do device (model, OS, etc)

        Returns:
            Dict com resultado da operação
        """
        try:
            doc_id = f"device_token:{device_token}"

            doc = {
                "_id": doc_id,
                "table": "device_token",
                "device_token": device_token,
                "irrigadorIds": irrigador_ids,
                "enabled": True,
                "device_info": device_info or {},
                "created_at": datetime.now(BR_TZ).isoformat(),
                "last_used": datetime.now(BR_TZ).isoformat(),
            }

            self.db.save(doc)
            logger.info(f"✅ Device token registrado: {device_token}")

            return {
                "success": True,
                "doc_id": doc_id,
                "message": "Device token registrado com sucesso",
            }

        except Exception as e:
            logger.error(f"❌ Erro ao registrar device token: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    def unregister_device_token(self, device_token: str) -> Dict[str, Any]:
        """
        Desregistrar device token

        Args:
            device_token: Token a desregistrar

        Returns:
            Dict com resultado
        """
        try:
            doc_id = f"device_token:{device_token}"
            doc = self.db.get(doc_id)
            doc["enabled"] = False
            self.db.save(doc)

            logger.info(f"✅ Device token desregistrado: {device_token}")
            return {
                "success": True,
                "message": "Device token desregistrado",
            }

        except Exception as e:
            logger.error(f"❌ Erro ao desregistrar device token: {e}")
            return {
                "success": False,
                "error": str(e),
            }

    # =========================================================================
    # Envio de Push
    # =========================================================================

    def send_push(
        self,
        device_tokens: List[str],
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        badge: Optional[int] = None,
        sound: str = "default",
    ) -> Dict[str, Any]:
        """
        Enviar notificação push para múltiplos dispositivos

        Args:
            device_tokens: Lista de Expo push tokens
            title: Título da notificação
            body: Corpo da notificação
            data: Dados adicionais (JSON)
            badge: Badge count (iOS)
            sound: Som da notificação

        Returns:
            Dict com status do envio
        """
        if not device_tokens:
            return {
                "success": False,
                "error": "Nenhum device token fornecido",
            }

        messages = []

        for token in device_tokens:
            try:
                message = PushMessage(
                    to=token,
                    title=title,
                    body=body,
                    data=data or {},
                    badge=badge,
                    sound=sound,
                    ttl=3600,  # 1 hora
                )
                messages.append(message)

            except Exception as e:
                logger.warning(f"⚠️ Token inválido '{token}': {e}")
                continue

        if not messages:
            return {
                "success": False,
                "error": "Nenhum token válido",
            }

        try:
            # Enviar em batch (Expo permite até 100 mensagens por request)
            response = self.expo_client.publish_multiple(messages)

            results = {
                "success": True,
                "total_sent": len(messages),
                "tickets": [],
                "errors": [],
            }

            # Processar resposta
            for ticket in response:
                if ticket["status"] == "ok":
                    results["tickets"].append({
                        "status": "ok",
                        "id": ticket.get("id"),
                    })
                elif ticket["status"] == "error":
                    error_msg = ticket.get("message", "Unknown error")
                    results["errors"].append({
                        "status": "error",
                        "message": error_msg,
                    })

            logger.info(f"✅ Push enviado: {len(results['tickets'])} sucesso, {len(results['errors'])} erro")
            return results

        except PushServerError as e:
            logger.error(f"❌ Erro Expo (servidor): {e}")
            return {
                "success": False,
                "error": f"Erro do servidor Expo: {str(e)}",
            }
        except PushTicketError as e:
            logger.error(f"❌ Erro Expo (ticket): {e}")
            return {
                "success": False,
                "error": f"Erro ao enviar ticket: {str(e)}",
            }
        except Exception as e:
            logger.error(f"❌ Erro inesperado: {e}")
            return {
                "success": False,
                "error": f"Erro ao enviar push: {str(e)}",
            }

    # =========================================================================
    # Push para Alertas
    # =========================================================================

    def send_alert_push(
        self,
        irrigador_id: str,
        alert_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Enviar notificação push especializada para alertas

        Args:
            irrigador_id: ID do irrigador
            alert_data: Dict com dados do alerta (alertId, eventType, monitor, timestamp, etc)

        Returns:
            Dict com resultado do envio
        """
        # Buscar device tokens do irrigador
        tokens_docs = self.get_device_tokens(irrigador_id)

        if not tokens_docs:
            logger.info(f"ℹ️ Nenhum device registrado para {irrigador_id}")
            return {
                "success": False,
                "error": "Nenhum device registrado",
                "device_count": 0,
            }

        device_tokens = [doc.get("device_token") for doc in tokens_docs]
        device_tokens = [t for t in device_tokens if t]  # Filter None

        # Preparar mensagem de alerta
        event_type = alert_data.get("eventType", "A")
        monitor = alert_data.get("monitor", "00")
        timestamp = alert_data.get("timestamp", "")

        priority = self.ALARM_PRIORITY_MAP.get(event_type, "high")
        description = self.ALARM_TYPE_DESCRIPTIONS.get(event_type, "Alerta")

        title = f"🚨 Alerta - {description}"
        body = f"Irrigador {irrigador_id}\nMonitor {monitor}\n{timestamp}"

        # Enviar push
        result = self.send_push(
            device_tokens=device_tokens,
            title=title,
            body=body,
            data=alert_data,
            sound="default",
        )

        # Log da notificação
        try:
            log_doc = {
                "_id": f"notification_log:{alert_data.get('alertId', 'unknown')}:{datetime.now(BR_TZ).timestamp()}",
                "table": "notification_log",
                "alert_id": alert_data.get("alertId"),
                "irrigador_id": irrigador_id,
                "device_count": len(device_tokens),
                "result": result,
                "sent_at": datetime.now(BR_TZ).isoformat(),
            }
            self.db.save(log_doc)
        except Exception as e:
            logger.warning(f"⚠️ Erro ao logar notificação: {e}")

        return result

    # =========================================================================
    # Utilitários
    # =========================================================================

    def get_notification_logs(
        self,
        irrigador_id: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Obter histórico de notificações de um irrigador

        Args:
            irrigador_id: ID do irrigador
            limit: Limite de registros

        Returns:
            Lista de logs de notificação
        """
        try:
            selector = {
                "table": "notification_log",
                "irrigador_id": irrigador_id,
            }
            response = self.db.find(selector, sort=[{"sent_at": "desc"}], limit=limit)
            return response if response else []

        except Exception as e:
            logger.error(f"❌ Erro ao buscar logs: {e}")
            return []
