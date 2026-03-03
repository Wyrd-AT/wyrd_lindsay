#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Worker Command Processor
========================

Background worker que processa comandos:
1. Escuta CouchDB (_changes feed) procurando documentos com table="command"
2. Publica comandos no broker MQTT nos tópicos apropriados
3. Gerencia timers para agendamento de comandos (timer_minutes)

Fluxo:
1. App React Native salva comando no CouchDB (table: "command")
2. Este worker detecta via _changes
3. Se timer_minutes > 0: agenda para depois
   Se timer_minutes == 0: publica imediatamente
4. Irrigador/PLC recebe e executa o comando
"""

import os
import sys
import signal
import threading
import logging
from typing import Dict, Optional
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import couchdb
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.mqtt_service import MQTTService

load_dotenv()

# ============================================================================
# Setup
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("command_processor")

BR_TZ = ZoneInfo("America/Sao_Paulo")

# Config
COUCHDB_URL = os.getenv("COUCHDB_URL", "https://admin:wyrd@db.vpn.ind.br")
COUCHDB_DB = os.getenv("COUCHDB_DB", "lindsay-data")

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "lindsay-api")

# Control
stop_event = threading.Event()
timers: Dict[str, threading.Timer] = {}

# Services
db = None
mqtt_publisher = None


# ============================================================================
# Initialization
# ============================================================================


def init_services() -> bool:
    """Inicializar dependências"""
    global db, mqtt_publisher

    try:
        # CouchDB
        server = couchdb.Server(COUCHDB_URL)
        db = server[COUCHDB_DB]
        logger.info(f"✅ CouchDB conectado: {COUCHDB_DB}")

        # MQTT publisher
        mqtt_publisher = MQTTService(
            MQTT_BROKER, MQTT_PORT, f"{MQTT_CLIENT_ID}_commands"
        )
        if not mqtt_publisher.connect():
            raise Exception("Falha ao conectar MQTT publisher")

        logger.info("✅ Serviços inicializados")
        return True

    except Exception as e:
        logger.error(f"❌ Erro ao inicializar: {e}")
        return False


# ============================================================================
# Processing
# ============================================================================


def mark_as_scheduled(doc_id: str, delay_seconds: int) -> None:
    """Marcar documento como agendado no CouchDB"""
    try:
        doc = db.get(doc_id)
        doc["scheduled"] = True
        doc["status"] = "scheduled"
        doc["scheduled_at"] = datetime.now(BR_TZ).isoformat()
        db.save(doc)
        logger.info(f"✅ Marcado como agendado: {doc_id} ({delay_seconds}s)")

    except couchdb.http.ResourceConflict:
        logger.warning(f"⚠️ Conflito ao marcar como agendado: {doc_id}")
    except Exception as e:
        logger.error(f"❌ Erro ao marcar como agendado {doc_id}: {e}")


def mark_as_published(doc_id: str) -> None:
    """Marcar documento como publicado"""
    try:
        doc = db.get(doc_id)
        doc["published"] = True
        doc["status"] = "published"
        doc["published_at"] = datetime.now(BR_TZ).isoformat()
        db.save(doc)
        logger.info(f"✅ Marcado como publicado: {doc_id}")

    except Exception as e:
        logger.error(f"❌ Erro ao marcar como publicado {doc_id}: {e}")


def publish_command(doc_id: str, command_doc: Dict) -> None:
    """Publicar comando no MQTT"""
    try:
        irrigador_id = command_doc.get("irrigadorId")
        pivo_id = command_doc.get("pivoId")
        command_type = command_doc.get("command", "")
        command_params = command_doc.get("params", {})

        if not irrigador_id:
            logger.error(f"❌ Comando sem irrigadorId: {doc_id}")
            return

        # Tópico: lindsay/comandos/{irrigadorId}/{pivoId}/{tipo}
        topic = f"lindsay/comandos/{irrigador_id}"
        if pivo_id:
            topic += f"/{pivo_id}"

        payload = {
            "command_id": doc_id,
            "type": command_type,
            "params": command_params,
            "timestamp": datetime.now(BR_TZ).isoformat(),
        }

        if mqtt_publisher.publish(topic, payload, qos=1):
            logger.info(f"✅ Comando publicado: {topic} -> {command_type}")
            mark_as_published(doc_id)
        else:
            logger.error(f"❌ Erro ao publicar comando: {doc_id}")

    except Exception as e:
        logger.error(f"❌ Erro ao publicar comando {doc_id}: {e}")


def schedule_command(doc_id: str, command_doc: Dict, delay_minutes: int) -> None:
    """Agendar comando para depois"""
    delay_seconds = delay_minutes * 60

    def timer_callback():
        """Executado após o timer expirar"""
        logger.info(f"⏰ Timer expirado para {doc_id}, publicando...")
        publish_command(doc_id, command_doc)

        # Limpar timer
        if doc_id in timers:
            del timers[doc_id]

    try:
        # Cancelar timer anterior se existir
        if doc_id in timers:
            timers[doc_id].cancel()

        # Criar novo timer
        timer = threading.Timer(delay_seconds, timer_callback)
        timer.daemon = True
        timer.start()

        timers[doc_id] = timer
        mark_as_scheduled(doc_id, delay_seconds)

        logger.info(f"⏰ Comando agendado: {doc_id} em {delay_minutes} minuto(s)")

    except Exception as e:
        logger.error(f"❌ Erro ao agendar comando {doc_id}: {e}")


def process_command(doc_id: str, command_doc: Dict) -> None:
    """Processar um documento de comando"""
    try:
        if command_doc.get("published"):
            logger.debug(f"ℹ️ Comando já publicado: {doc_id}")
            return

        timer_minutes = command_doc.get("timer_minutes", 0)

        if timer_minutes > 0:
            # Agendar para depois
            schedule_command(doc_id, command_doc, timer_minutes)
        else:
            # Publicar imediatamente
            publish_command(doc_id, command_doc)

    except Exception as e:
        logger.error(f"❌ Erro ao processar comando {doc_id}: {e}")


# ============================================================================
# CouchDB Changes Listener
# ============================================================================


def listen_changes():
    """Escutar _changes feed do CouchDB"""
    try:
        last_seq = 0

        while not stop_event.is_set():
            try:
                # Buscar mudanças desde a última sequência
                changes = db.changes(since=last_seq, feed="continuous", timeout=30000)

                for change in changes:
                    if stop_event.is_set():
                        break

                    last_seq = change.get("seq", last_seq)
                    doc_id = change.get("id")
                    deleted = change.get("deleted", False)

                    if deleted:
                        logger.debug(f"🗑️ Documento deletado: {doc_id}")
                        continue

                    try:
                        doc = db.get(doc_id)

                        # Verificar se é um comando
                        if doc.get("table") == "command":
                            logger.info(f"📋 Novo comando detectado: {doc_id}")
                            process_command(doc_id, doc)

                    except couchdb.http.ResourceNotFound:
                        pass
                    except Exception as e:
                        logger.error(f"❌ Erro ao processar change {doc_id}: {e}")

            except Exception as e:
                logger.warning(f"⚠️ Erro na stream de changes: {e}")
                # Reconectar após delay
                import time

                time.sleep(5)

    except Exception as e:
        logger.error(f"❌ Erro crítico no listener: {e}")


# ============================================================================
# Startup/Shutdown
# ============================================================================


def shutdown_handler(signum, frame):
    """Handler para sinais de shutdown"""
    logger.info(f"🛑 Recebido sinal {signum}, encerrando...")
    stop_event.set()


# ============================================================================
# Main
# ============================================================================


def main():
    """Iniciar command processor"""
    logger.info("=" * 70)
    logger.info("🎯 Lindsay Command Processor v2.0")
    logger.info("=" * 70)

    # Registrar signal handlers
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    # Inicializar serviços
    if not init_services():
        logger.error("❌ Falha ao inicializar serviços")
        return 1

    # Iniciar thread de listener
    listener_thread = threading.Thread(target=listen_changes, daemon=False)
    listener_thread.start()

    logger.info("=" * 70)
    logger.info("✅ Command Processor pronto")
    logger.info(f"   Database: {COUCHDB_DB}")
    logger.info(f"   MQTT: {MQTT_BROKER}:{MQTT_PORT}")
    logger.info("=" * 70)

    # Aguardar shutdown
    stop_event.wait()

    # Cleanup
    logger.info("🛑 Encerrando...")

    # Cancelar todos os timers pendentes
    for timer in timers.values():
        timer.cancel()

    if mqtt_publisher:
        mqtt_publisher.disconnect()

    listener_thread.join(timeout=10)

    logger.info("✅ Command Processor encerrado")
    return 0


if __name__ == "__main__":
    sys.exit(main())
