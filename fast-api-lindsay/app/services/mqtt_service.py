#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço MQTT
============

Cliente MQTT para publicar eventos e alertas.
Gerencia conexão com broker MQTT e reconexão automática.
"""

import os
import logging
import json
from typing import Dict, Optional, Any, Callable
from datetime import datetime
from zoneinfo import ZoneInfo

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

logger = logging.getLogger(__name__)
BR_TZ = ZoneInfo("America/Sao_Paulo")


class MQTTService:
    """Serviço MQTT para publicar eventos"""

    def __init__(self, broker: str, port: int, client_id: str):
        """
        Inicializar cliente MQTT

        Args:
            broker: Host do broker MQTT
            port: Porta do broker
            client_id: ID único do cliente
        """
        self.broker = broker
        self.port = port
        self.client_id = client_id
        self.client: Optional[mqtt.Client] = None
        self.is_connected = False

        # Credenciais (opcional)
        self.username = os.getenv("MQTT_USERNAME")
        self.password = os.getenv("MQTT_PASSWORD")

        # QoS padrão
        self.qos = int(os.getenv("MQTT_QOS", "1"))

        self._setup_client()

    # =========================================================================
    # Setup e Conexão
    # =========================================================================

    def _setup_client(self) -> None:
        """Configurar cliente MQTT com callbacks"""
        self.client = mqtt.Client(CallbackAPIVersion.VERSION2, client_id=self.client_id)

        # Callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_publish = self._on_publish
        self.client.on_message = self._on_message

        # Credenciais
        if self.username and self.password:
            self.client.username_pw_set(self.username, self.password)

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        """Callback de conexão"""
        if getattr(reason_code, "value", reason_code) == 0:
            logger.info(f"✅ Conectado ao MQTT: {self.broker}:{self.port}")
            self.is_connected = True
        else:
            logger.error(f"❌ Erro ao conectar MQTT: {reason_code}")

    def _on_disconnect(
        self, client, userdata, disconnect_flags, reason_code, properties=None
    ):
        """Callback de desconexão"""
        logger.warning(f"⚠️ Desconectado do MQTT: {reason_code}")
        self.is_connected = False

    def _on_publish(self, client, userdata, mid, reason_code=None, properties=None):
        """Callback de publicação"""
        logger.debug(f"📤 Mensagem publicada (mid={mid})")

    def _on_message(self, client, userdata, msg):
        """Callback de mensagem (subscriptions)"""
        logger.debug(f"📥 Mensagem recebida: {msg.topic} = {msg.payload[:50]}")

    def connect(self) -> bool:
        """
        Conectar ao broker MQTT

        Returns:
            True se conectado com sucesso
        """
        try:
            self.client.connect(self.broker, self.port, keepalive=60)
            self.client.loop_start()  # Thread separada para conexão
            logger.info(f"🔌 MQTT client iniciado: {self.client_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Erro ao conectar MQTT: {e}")
            return False

    def disconnect(self) -> None:
        """Desconectar do broker"""
        try:
            if self.client:
                self.client.loop_stop()
                self.client.disconnect()
                logger.info("✅ MQTT desconectado")

        except Exception as e:
            logger.error(f"❌ Erro ao desconectar MQTT: {e}")

    # =========================================================================
    # Publicação
    # =========================================================================

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
    )
    def publish(
        self,
        topic: str,
        payload: Any,
        qos: Optional[int] = None,
        retain: bool = False,
    ) -> bool:
        """
        Publicar mensagem no MQTT (com retry)

        Args:
            topic: Tópico MQTT
            payload: Payload (dict, string, ou qualquer serializable)
            qos: QoS (0, 1, ou 2)
            retain: Manter mensagem no broker

        Returns:
            True se publicado com sucesso
        """
        if not self.is_connected:
            raise Exception("MQTT não conectado")

        try:
            qos = qos or self.qos

            # Serializar payload se for dict
            if isinstance(payload, dict):
                payload_str = json.dumps(payload, ensure_ascii=False, default=str)
            else:
                payload_str = str(payload)

            result = self.client.publish(
                topic,
                payload_str,
                qos=qos,
                retain=retain,
            )

            if result.rc != mqtt.MQTT_ERR_SUCCESS:
                raise Exception(f"Erro MQTT rc={result.rc}")

            logger.info(f"📤 Publicado: {topic} ({len(payload_str)} bytes)")
            return True

        except Exception as e:
            logger.error(f"❌ Erro ao publicar {topic}: {e}")
            raise

    # =========================================================================
    # Publicação de Eventos
    # =========================================================================

    def publish_alert(
        self,
        irrigador_id: str,
        alert_data: Dict[str, Any],
    ) -> bool:
        """
        Publicar alerta no MQTT

        Args:
            irrigador_id: ID do irrigador
            alert_data: Dados do alerta

        Returns:
            True se publicado
        """
        try:
            topic = f"lindsay/{irrigador_id}/alerts"
            payload = {
                "type": "alert",
                "irrigadorId": irrigador_id,
                "data": alert_data,
                "timestamp": datetime.now(BR_TZ).isoformat(),
            }

            return self.publish(topic, payload, qos=1)

        except Exception as e:
            logger.error(f"❌ Erro ao publicar alerta: {e}")
            return False

    def publish_command_response(
        self,
        irrigador_id: str,
        command_id: str,
        status: str,
        response_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Publicar resposta de comando

        Args:
            irrigador_id: ID do irrigador
            command_id: ID do comando
            status: Status (success, failed, pending)
            response_data: Dados da resposta

        Returns:
            True se publicado
        """
        try:
            topic = f"lindsay/{irrigador_id}/commands/response"
            payload = {
                "type": "command_response",
                "command_id": command_id,
                "status": status,
                "data": response_data or {},
                "timestamp": datetime.now(BR_TZ).isoformat(),
            }

            return self.publish(topic, payload, qos=1)

        except Exception as e:
            logger.error(f"❌ Erro ao publicar resposta: {e}")
            return False

    def publish_status(
        self,
        irrigador_id: str,
        status: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Publicar status de um irrigador

        Args:
            irrigador_id: ID do irrigador
            status: Status (online, offline, error)
            details: Detalhes adicionais

        Returns:
            True se publicado
        """
        try:
            topic = f"lindsay/{irrigador_id}/status"
            payload = {
                "type": "status",
                "status": status,
                "details": details or {},
                "timestamp": datetime.now(BR_TZ).isoformat(),
            }

            return self.publish(topic, payload, qos=1, retain=True)

        except Exception as e:
            logger.error(f"❌ Erro ao publicar status: {e}")
            return False

    def publish_metrics(
        self,
        irrigador_id: str,
        metrics: Dict[str, Any],
    ) -> bool:
        """
        Publicar métricas de um irrigador

        Args:
            irrigador_id: ID do irrigador
            metrics: Dicionário com métricas (tension, temperature, etc)

        Returns:
            True se publicado
        """
        try:
            topic = f"lindsay/{irrigador_id}/metrics"
            payload = {
                "type": "metrics",
                "metrics": metrics,
                "timestamp": datetime.now(BR_TZ).isoformat(),
            }

            return self.publish(topic, payload, qos=1)

        except Exception as e:
            logger.error(f"❌ Erro ao publicar métricas: {e}")
            return False

    # =========================================================================
    # Subscriptions
    # =========================================================================

    def subscribe(
        self,
        topic: str,
        qos: Optional[int] = None,
        callback: Optional[Callable] = None,
    ) -> bool:
        """
        Subscribe em um tópico

        Args:
            topic: Tópico MQTT
            qos: QoS (0, 1, ou 2)
            callback: Função a chamar quando receber mensagem

        Returns:
            True se subscrito
        """
        if not self.is_connected:
            logger.warning("⚠️ MQTT não conectado, subscribe adiado")
            return False

        try:
            qos = qos or self.qos
            result = self.client.subscribe(topic, qos)

            if result[0] != mqtt.MQTT_ERR_SUCCESS:
                logger.error(f"❌ Erro ao subscribe {topic}: {result}")
                return False

            logger.info(f"✅ Subscrito: {topic}")
            return True

        except Exception as e:
            logger.error(f"❌ Erro ao subscribe {topic}: {e}")
            return False

    # =========================================================================
    # Utilitários
    # =========================================================================

    def is_healthy(self) -> bool:
        """Verificar saúde da conexão"""
        return self.is_connected and self.client is not None

    def get_status(self) -> Dict[str, Any]:
        """Obter status da conexão"""
        return {
            "is_connected": self.is_connected,
            "broker": self.broker,
            "port": self.port,
            "client_id": self.client_id,
            "timestamp": datetime.now(BR_TZ).isoformat(),
        }
