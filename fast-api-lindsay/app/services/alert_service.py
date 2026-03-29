#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço de Processamento de Alertas
====================================

Parse, validação e armazenamento de payloads MQTT de irrigadores.
Adaptado para suportar tanto o formato legado (;) quanto o novo (:).
Busca inteligente no CouchDB pelo 'codigo' e leitura aninhada de 'contacts'.
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
        Identificar tipo de payload e fazer parse suportando ambos os formatos
        """
        payload = payload.strip()

        # 1. Tenta parse no formato LEGADO (separado por ponto-e-vírgula)
        if ";" in payload:
            parts = [p.strip() for p in payload.split(";")]
            # Evento legado (ex: EMBTST;2025-02-02T10:30:00;E171)
            if len(parts) >= 3 and re.fullmatch(r"[A-Z]\d+", parts[2]):
                return self._parse_event_legacy(parts, payload)

        # 2. Tenta parse no formato NOVO (separado por dois-pontos)
        if ":" in payload:
            if "MT" in payload[:10] or "PAN" in payload[:10]:
                return self._parse_vetor_tensao(payload)
            elif "SW" in payload[:10]:
                return self._parse_vetor_sw(payload)
            elif any(marker in payload for marker in ["EVENT", "ALM"]):
                return self._parse_event_new(payload)

        logger.warning(f"⚠️ Payload desconhecido/incompatível: {payload[:50]}")
        return {"type": "unknown", "payload": payload}

    def _parse_event_legacy(self, parts: List[str], payload: str) -> Dict[str, Any]:
        """Parse de evento do formato antigo (ex: EMBTST;2025-02-02T10:30:00;E171)"""
        try:
            irrigador_id = parts[0]
            timestamp_str = parts[1]
            evento = parts[2]

            event_type = evento[0]
            monitor = evento[1:3]
            estado = evento[3] if len(evento) > 3 else "1"  # Força alarme se omitido

            try:
                dt = datetime.fromisoformat(timestamp_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=BR_TZ)
            except ValueError:
                dt = datetime.now(BR_TZ)

            return {
                "type": EventType.EVENT,
                "irrigadorId": irrigador_id,
                "eventType": event_type,
                "monitor": self._normalize_monitor(monitor),
                "estado": estado,
                "status": self.STATUS_MAP.get(estado, "Desconhecido"),
                "description": f"Evento {event_type}{monitor}",
                "responsible": "A definir",
                "timestamp": dt,
                "timestamp_formatted": dt.strftime("%H:%M:%S %d/%m/%Y"),
            }
        except Exception as e:
            logger.error(f"❌ Erro ao parse evento legado: {e}")
            return {"type": "error", "error": str(e), "payload": payload}

    def _parse_event_new(self, payload: str) -> Dict[str, Any]:
        """Parse de evento do formato novo (ex: EVENT:TESTV2:A:MT01:1)"""
        try:
            parts = payload.split(":")
            if len(parts) < 4:
                raise ValueError("Payload de evento inválido")

            irrigador_id = parts[1].strip()
            event_type = parts[2].strip()[0:1]
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
            logger.error(f"❌ Erro ao parse evento novo: {e}")
            return {"type": "error", "error": str(e), "payload": payload}

    def _parse_vetor_tensao(self, payload: str) -> Dict[str, Any]:
        """Parse de vetor de tensão (MT01-MT14, Painel 1-2)"""
        try:
            parts = payload.split(":")
            if len(parts) < 3:
                raise ValueError("Payload inválido")

            header = parts[0].strip()
            irrigador_id = parts[1].strip()

            monitor_match = re.search(r"(MT\d{2}|PAN\d)", header)
            monitor = monitor_match.group(1) if monitor_match else "00"

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
            return {"type": "error", "error": str(e), "payload": payload}

    def _parse_vetor_sw(self, payload: str) -> Dict[str, Any]:
        """Parse de vetor de switches (fim de curso)"""
        try:
            parts = payload.split(":")
            if len(parts) < 3:
                raise ValueError("Payload inválido")

            irrigador_id = parts[1].strip()

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
            return {"type": "error", "error": str(e), "payload": payload}

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
        """Inserir alerta no CouchDB"""
        try:
            self.db.save(doc_data)
            logger.info(f"✅ Alerta inserido: {doc_data.get('_id')}")
            return doc_data.get("_id")
        except Exception as e:
            logger.error(f"❌ Erro ao inserir alerta: {e}")
            return None

    def update_monthly_history(
        self, irrigador_id: str, data_type: str, alert_id: str
    ) -> None:
        """Atualizar histórico mensal de alertas"""
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

            if data_type not in doc["counts"]:
                doc["counts"][data_type] = []

            doc["counts"][data_type].append(
                {"alert_id": alert_id, "timestamp": datetime.now(BR_TZ).isoformat()}
            )

            doc["last_updated"] = datetime.now(BR_TZ).isoformat()
            self.db.save(doc)

            logger.info(f"✅ Histórico atualizado: {history_id}")
        except Exception as e:
            logger.error(f"❌ Erro ao atualizar histórico: {e}")

    # =========================================================================
    # Utilitários (Busca inteligente e Rate Limit corrigido)
    # =========================================================================

    def get_irrigador_info(self, codigo_irrigador: str) -> Dict[str, Any]:
        """Obter informações buscando pelo 'codigo' e lendo os contatos internos"""
        try:
            # 1. Busca inteligente usando Selector pelo "codigo" (do hardware)
            query = {
                "selector": {"table": "irrigadores", "codigo": codigo_irrigador},
                "limit": 1,
            }
            results = self.db.find(query)
            doc = next(results, None)

            # Fallback caso receba o ID direto (hash)
            if not doc:
                try:
                    doc = self.db.get(codigo_irrigador) or self.db.get(
                        f"irrigador:{codigo_irrigador}"
                    )
                except couchdb.http.ResourceNotFound:
                    doc = None

            if not doc:
                logger.warning(
                    f"⚠️ Equipamento não encontrado no DB: {codigo_irrigador}"
                )
                return {
                    "id": codigo_irrigador,
                    "nome": codigo_irrigador,
                    "phones": [],
                    "emails": [],
                    "equipamentos": [],
                    "whatsapp_enabled": False,
                    "whatsapp_call_enabled": False,
                }

            # 2. Extração resiliente de contatos (Pega da raiz ou do objeto contacts aninhado)
            phones = set(doc.get("phones", []))
            emails = set(doc.get("emails", []))

            whatsapp_enabled = True
            whatsapp_call_enabled = True

            try:
                config_query = {
                    "selector": {
                        "table": "whatsapp_config",
                        "irrigador_id": codigo_irrigador,
                    },
                    "limit": 1,
                }
                config_results = self.db.find(config_query)
                config_doc = next(config_results, None)

                # Fallback legado
                if not config_doc:
                    try:
                        config_doc = self.db.get(f"whatsapp_config:{codigo_irrigador}")
                    except couchdb.http.ResourceNotFound:
                        config_doc = None

                if config_doc:
                    whatsapp_enabled = bool(config_doc.get("whatsapp_enabled", True))
                    whatsapp_call_enabled = bool(
                        config_doc.get("whatsapp_call_enabled", False)
                    )
                    if whatsapp_call_enabled:
                        whatsapp_enabled = True
            except Exception as e:
                logger.warning(
                    f"⚠️ Erro ao buscar whatsapp_config para {codigo_irrigador}: {e}"
                )

            contacts_obj = doc.get("contacts", {})
            if contacts_obj.get("whatsapp"):
                phones.add(contacts_obj.get("whatsapp"))
            if contacts_obj.get("sms"):
                phones.add(contacts_obj.get("sms"))
            if contacts_obj.get("email"):
                emails.add(contacts_obj.get("email"))

            # Limpa itens vazios
            phones = [p for p in phones if p]
            emails = [e for e in emails if e]

            return {
                "id": codigo_irrigador,
                "nome": doc.get("nome", doc.get("name", codigo_irrigador)),
                "phones": phones,
                "emails": emails,
                "equipamentos": doc.get("equipamentos", []),
                "whatsapp_enabled": whatsapp_enabled,
                "whatsapp_call_enabled": whatsapp_call_enabled,
            }

        except Exception as e:
            logger.warning(
                f"⚠️ Erro ao buscar info do equipamento {codigo_irrigador}: {e}"
            )
            return {
                "id": codigo_irrigador,
                "nome": codigo_irrigador,
                "phones": [],
                "emails": [],
                "equipamentos": [],
                "whatsapp_enabled": False,
            }

    def should_notify(
        self, alert_id: str, irrigador_id: str = None, hourly_limit: int = 5
    ) -> bool:
        """Rate limit aplicado POR EQUIPAMENTO usando query com selector"""
        try:
            now = datetime.now(BR_TZ)
            hour_key = now.strftime("%Y-%m-%d %H:00:00")

            selector_query = {
                "table": "notification_log",
                "sent_at": {"$gte": hour_key},
            }

            # Filtra pelo equipamento específico
            if irrigador_id:
                selector_query["irrigadorId"] = irrigador_id

            query = {"selector": selector_query}

            results = self.db.find(query)
            count = len(list(results))

            return count < hourly_limit

        except Exception as e:
            logger.warning(f"⚠️ Erro ao verificar rate limit: {e}")
            return True

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
