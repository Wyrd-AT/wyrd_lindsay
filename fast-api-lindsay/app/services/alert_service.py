#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Processamento de Alertas
====================================

Parse, validação e armazenamento de payloads MQTT de irrigadores.

Suporta:
- Vetor de Tensão (MT01-MT14, Painel 1-2)
- Vetor de Switches (Fim de curso)
- Eventos de Alerta
"""

import logging
import re
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from zoneinfo import ZoneInfo
from enum import Enum

import couchdb

logger = logging.getLogger(__name__)
BR_TZ = ZoneInfo("America/Sao_Paulo")


class EventType(str, Enum):
    """Tipos de evento suportados"""

    VETOR_TENSAO = "vetor_tensao"
    VETOR_SW = "vetor_sw"
    EVENT = "event"


class AlertService:
    """Serviço de processamento e armazenamento de alertas"""

    def __init__(self, db: couchdb.Database):
        """
        Inicializar serviço de alertas

        Args:
            db: Instância do banco CouchDB
        """
        self.db = db

        # Mapeamento de monitores
        self.MONITOR_TENSAO = {
            "01": "MT01",
            "02": "MT02",
            "03": "MT03",
            "04": "MT04",
            "05": "MT05",
            "06": "MT06",
            "07": "MT07",
            "08": "MT08",
            "09": "MT09",
            "10": "MT10",
            "11": "MT11",
            "12": "MT12",
            "13": "MT13",
            "14": "MT14",
            "17": "Painel 1",
            "18": "Painel 2",
        }

        # Status mapping
        self.STATUS_MAP = {
            "0": "OK",
            "1": "Alarmado",
            "2": "Reconhecido",
            "3": "Resolvido",
            "9": "Ausente",
        }

    # =========================================================================
    # Parsing
    # =========================================================================

    def identify_and_parse(self, payload: str) -> Dict[str, Any]:
        """
        Identificar tipo de payload e fazer parse

        Args:
            payload: String do payload MQTT

        Returns:
            Dict com dados parseados
        """
        # Remover whitespace
        payload = payload.strip()

        # Tentar identificar tipo
        if "MT" in payload[:10] or "PAN" in payload[:10]:
            return self._parse_vetor_tensao(payload)
        elif "SW" in payload[:10]:
            return self._parse_vetor_sw(payload)
        elif any(marker in payload for marker in ["EVENT", "ALM"]):
            return self._parse_event(payload)
        else:
            logger.warning(f"⚠️ Payload desconhecido: {payload[:50]}")
            return {"type": "unknown", "payload": payload}

    def _parse_vetor_tensao(self, payload: str) -> Dict[str, Any]:
        """Parse de vetor de tensão (MT01-MT14, Painel 1-2)"""
        try:
            parts = payload.split(":")
            if len(parts) < 3:
                raise ValueError("Payload inválido")

            header = parts[0].strip()
            irrigador_id = parts[1].strip()

            # Extrair tipo de monitor (MT ou PAN)
            monitor_match = re.search(r"(MT\d{2}|PAN\d)", header)
            monitor = monitor_match.group(1) if monitor_match else "00"

            # Extrair dados de tensão
            # Formato esperado: "MT01:1234:230.5:50:OK"
            tension_values = []
            status = "0"

            for part in parts[2:]:
                part = part.strip()
                if part in self.STATUS_MAP:
                    status = part
                elif part.replace(".", "").isdigit():
                    try:
                        tension_values.append(float(part))
                    except ValueError:
                        continue

            return {
                "type": EventType.VETOR_TENSAO,
                "subtype": "tensao",
                "irrigadorId": irrigador_id,
                "monitor": self._normalize_monitor(monitor),
                "tension_values": tension_values,
                "status": self.STATUS_MAP.get(status, "Desconhecido"),
                "estado": status,
                "timestamp": datetime.now(BR_TZ),
                "timestamp_formatted": datetime.now(BR_TZ).strftime(
                    "%H:%M:%S %d/%m/%Y"
                ),
            }

        except Exception as e:
            logger.error(f"❌ Erro ao parse vetor tensão: {e}")
            return {
                "type": "error",
                "error": str(e),
                "payload": payload,
            }

    def _parse_vetor_sw(self, payload: str) -> Dict[str, Any]:
        """Parse de vetor de switches (fim de curso)"""
        try:
            parts = payload.split(":")
            if len(parts) < 3:
                raise ValueError("Payload inválido")

            header = parts[0].strip()
            irrigador_id = parts[1].strip()

            # Extrair switches (SW1, SW2, etc)
            sw_values = []
            status = "0"

            for part in parts[2:]:
                part = part.strip()
                if part in self.STATUS_MAP:
                    status = part
                elif part.upper().startswith("SW"):
                    sw_values.append(part)
                elif part in ("0", "1"):
                    sw_values.append(int(part))

            return {
                "type": EventType.VETOR_SW,
                "subtype": "sw",
                "irrigadorId": irrigador_id,
                "switches": sw_values,
                "status": self.STATUS_MAP.get(status, "Desconhecido"),
                "estado": status,
                "timestamp": datetime.now(BR_TZ),
                "timestamp_formatted": datetime.now(BR_TZ).strftime(
                    "%H:%M:%S %d/%m/%Y"
                ),
            }

        except Exception as e:
            logger.error(f"❌ Erro ao parse vetor SW: {e}")
            return {
                "type": "error",
                "error": str(e),
                "payload": payload,
            }

    def _parse_event(self, payload: str) -> Dict[str, Any]:
        """Parse de evento de alerta"""
        try:
            parts = payload.split(":")
            if len(parts) < 4:
                raise ValueError("Payload de evento inválido")

            header = parts[0].strip()
            irrigador_id = parts[1].strip()
            event_type = parts[2].strip()[0:1]  # Letra (A, B, C, D, E)
            monitor = parts[3].strip() if len(parts) > 3 else "00"
            estado = parts[4].strip() if len(parts) > 4 else "0"

            return {
                "type": EventType.EVENT,
                "irrigadorId": irrigador_id,
                "eventType": event_type,
                "monitor": self._normalize_monitor(monitor),
                "estado": estado,
                "status": self.STATUS_MAP.get(estado, "Desconhecido"),
                "description": f"Evento {event_type}{monitor}",
                "responsible": "A definir",
                "timestamp": datetime.now(BR_TZ),
                "timestamp_formatted": datetime.now(BR_TZ).strftime(
                    "%H:%M:%S %d/%m/%Y"
                ),
            }

        except Exception as e:
            logger.error(f"❌ Erro ao parse evento: {e}")
            return {
                "type": "error",
                "error": str(e),
                "payload": payload,
            }

    # =========================================================================
    # Processamento
    # =========================================================================

    def process_vetor_tensao(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Processar e criar documentos para vetor de tensão"""
        irrigador_id = parsed.get("irrigadorId", "unknown")
        monitor = parsed.get("monitor", "00")
        tension_values = parsed.get("tension_values", [])

        doc = {
            "_id": f"tensao:{irrigador_id}:{monitor}:{datetime.now(BR_TZ).timestamp()}",
            "table": "tensao",
            "irrigadorId": irrigador_id,
            "monitor": monitor,
            "values": tension_values,
            "status": parsed.get("estado"),
            "timestamp": parsed["timestamp"].isoformat(),
            "timestamp_formatted": parsed.get("timestamp_formatted"),
        }

        return [doc]

    def process_vetor_sw(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Processar e criar documentos para vetor de switches"""
        irrigador_id = parsed.get("irrigadorId", "unknown")
        switches = parsed.get("switches", [])

        doc = {
            "_id": f"sw:{irrigador_id}:{datetime.now(BR_TZ).timestamp()}",
            "table": "sw",
            "irrigadorId": irrigador_id,
            "switches": switches,
            "status": parsed.get("estado"),
            "timestamp": parsed["timestamp"].isoformat(),
            "timestamp_formatted": parsed.get("timestamp_formatted"),
        }

        return [doc]

    def process_event(self, parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Processar e criar documentos para evento de alerta"""
        irrigador_id = parsed.get("irrigadorId", "unknown")
        event_type = parsed.get("eventType", "A")
        monitor = parsed.get("monitor", "00")

        doc = {
            "_id": f"event:{irrigador_id}:{event_type}{monitor}:{datetime.now(BR_TZ).timestamp()}",
            "table": "event",
            "irrigadorId": irrigador_id,
            "eventType": event_type,
            "monitor": monitor,
            "estado": parsed.get("estado"),
            "status": parsed.get("status"),
            "description": parsed.get("description"),
            "responsible": parsed.get("responsible"),
            "timestamp": parsed["timestamp"].isoformat(),
            "timestamp_formatted": parsed.get("timestamp_formatted"),
        }

        return [doc]

    # =========================================================================
    # Storage
    # =========================================================================

    def insert_alert(self, doc_data: Dict[str, Any]) -> Optional[str]:
        """
        Inserir alerta no CouchDB

        Args:
            doc_data: Documento a inserir

        Returns:
            ID do documento ou None se falhar
        """
        try:
            self.db.save(doc_data)
            logger.info(f"✅ Alerta inserido: {doc_data.get('_id')}")
            return doc_data.get("_id")

        except Exception as e:
            logger.error(f"❌ Erro ao inserir alerta: {e}")
            return None

    def update_monthly_history(
        self,
        irrigador_id: str,
        data_type: str,
        alert_id: str,
    ) -> None:
        """
        Atualizar histórico mensal de alertas

        Args:
            irrigador_id: ID do irrigador
            data_type: Tipo de dado (tensao, sw, event)
            alert_id: ID do alerta a registrar
        """
        try:
            month_key = datetime.now(BR_TZ).strftime("%Y-%m")
            history_id = f"monthly_history:{irrigador_id}:{month_key}"

            try:
                doc = self.db.get(history_id)
            except couchdb.http.ResourceNotFound:
                doc = {
                    "_id": history_id,
                    "table": "monthly_history",
                    "irrigadorId": irrigador_id,
                    "month": month_key,
                    "counts": {},
                    "last_updated": datetime.now(BR_TZ).isoformat(),
                }

            # Incrementar contador
            if data_type not in doc["counts"]:
                doc["counts"][data_type] = []

            doc["counts"][data_type].append(
                {
                    "alert_id": alert_id,
                    "timestamp": datetime.now(BR_TZ).isoformat(),
                }
            )

            doc["last_updated"] = datetime.now(BR_TZ).isoformat()
            self.db.save(doc)

            logger.info(f"✅ Histórico atualizado: {history_id}")

        except Exception as e:
            logger.error(f"❌ Erro ao atualizar histórico: {e}")

    # =========================================================================
    # Utilitários
    # =========================================================================

    def _normalize_monitor(self, monitor: str) -> str:
        """Normalizar código de monitor"""
        monitor = monitor.upper().strip()
        if monitor in self.MONITOR_TENSAO:
            return monitor
        if monitor.startswith("MT"):
            return monitor[:4].upper().zfill(4)
        if monitor.startswith("PAN"):
            return monitor[:4].upper()
        return "00"

    def get_irrigador_info(self, irrigador_id: str) -> Dict[str, Any]:
        """Obter informações de um irrigador (nome, contatos, etc)"""
        try:
            doc_id = f"irrigador:{irrigador_id}"
            doc = self.db.get(doc_id)

            return {
                "id": irrigador_id,
                "nome": doc.get("nome", irrigador_id),
                "phones": doc.get("phones", []),
                "emails": doc.get("emails", []),
                "equipamentos": doc.get("equipamentos", []),
                "whatsapp_enabled": doc.get("whatsapp_enabled", False),
            }

        except Exception as e:
            logger.warning(f"⚠️ Irrigador não encontrado: {irrigador_id}")
            return {
                "id": irrigador_id,
                "nome": irrigador_id,
                "phones": [],
                "emails": [],
                "equipamentos": [],
                "whatsapp_enabled": False,
            }

    def should_notify(self, alert_id: str, hourly_limit: int = 5) -> bool:
        """
        Verificar se deve enviar notificação (com rate limiting)

        Args:
            alert_id: ID do alerta
            hourly_limit: Máximo de notificações por hora

        Returns:
            True se deve notificar, False caso contrário
        """
        try:
            # Buscar notificações desta hora
            now = datetime.now(BR_TZ)
            hour_key = now.strftime("%Y-%m-%d %H:00:00")

            selector = {
                "table": "notification_log",
                "sent_at": {"$gte": hour_key},
            }

            results = self.db.find(selector)
            count = len(results) if results else 0

            return count < hourly_limit

        except Exception as e:
            logger.warning(f"⚠️ Erro ao verificar rate limit: {e}")
            return True  # Notificar por padrão se erro
