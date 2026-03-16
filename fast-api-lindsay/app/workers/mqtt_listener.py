#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Worker MQTT Listener
====================

Background worker que:
1. Escuta MQTT em tempo real
2. Processa payloads (parse)
3. Armazena no CouchDB
4. Envia notificações (SMS, WhatsApp, Email, Push)
5. Publica alertas no MQTT para apps

Pode ser executado como:
- Background task do FastAPI
- Processo separado (systemd, supervisor)
- Container Docker
"""

import os
import sys
import signal
import threading
import logging
from queue import Queue, Full, Empty
from typing import Optional

import couchdb
import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion  # <<< ADICIONE ESTA LINHA
from dotenv import load_dotenv

# Importar serviços
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.alert_service import AlertService
from app.services.notification_service import notification_service
from app.services.push_service import PushService
from app.services.mqtt_service import MQTTService

load_dotenv()

# ============================================================================
# Setup
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("mqtt_listener")

# Config
COUCHDB_URL = os.getenv("COUCHDB_URL", "https://admin:wyrd@db.vpn.ind.br")
COUCHDB_DB = os.getenv("COUCHDB_DB", "lindsay-data")

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "pivo/+/dados")
MQTT_QOS = int(os.getenv("MQTT_QOS", "1"))
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "lindsay-api")

# Workers
WORKER_COUNT = int(os.getenv("WORKER_COUNT", "8"))
QUEUE_MAXSIZE = int(os.getenv("QUEUE_MAXSIZE", "5000"))
QUEUE_PUT_TIMEOUT = float(os.getenv("QUEUE_PUT_TIMEOUT", "0.01"))
ON_QUEUE_FULL = os.getenv("ON_QUEUE_FULL", "drop")

# Control
stop_event = threading.Event()
work_q = Queue(maxsize=QUEUE_MAXSIZE)

# Services
db = None
alert_service = None
push_service = None
mqtt_publisher = None
mqtt_listener_client = None


# ============================================================================
# Inicialização
# ============================================================================


def init_services() -> bool:
    """Inicializar todas as dependências"""
    global db, alert_service, push_service, mqtt_publisher, mqtt_listener_client

    try:
        # CouchDB
        server = couchdb.Server(COUCHDB_URL)
        db = server[COUCHDB_DB]
        logger.info(f"✅ CouchDB conectado: {COUCHDB_DB}")

        # Serviços
        alert_service = AlertService(db)
        push_service = PushService(db)
        mqtt_publisher = MQTTService(
            MQTT_BROKER, MQTT_PORT, f"{MQTT_CLIENT_ID}_publisher"
        )

        # Conectar MQTT publisher
        if not mqtt_publisher.connect():
            raise Exception("Falha ao conectar MQTT publisher")

        logger.info("✅ Todos os serviços inicializados")
        return True

    except Exception as e:
        logger.error(f"❌ Erro ao inicializar: {e}")
        return False


# ============================================================================
# Processing
# ============================================================================


def process_payload(topic: str, payload_str: str) -> None:
    """
    Processar payload MQTT

    Fluxo:
    1. Parse do payload
    2. Inserir no CouchDB
    3. Se for alerta:
       - Enviar push notifications
       - Enviar SMS/WhatsApp/Email
       - Publicar no MQTT para apps
    """
    try:
        logger.info(f"⚙️ Processando: {topic[:30]}...")

        # 1. Parse
        parsed = alert_service.identify_and_parse(payload_str)

        if parsed.get("type") == "unknown" or parsed.get("type") == "error":
            logger.warning(f"⚠️ Payload inválido: {parsed}")
            return

        # 2. Processar dados
        if parsed["type"] == "vetor_tensao":
            docs = alert_service.process_vetor_tensao(parsed)
            data_type = f"tensao_{parsed['subtype']}"
        elif parsed["type"] == "vetor_sw":
            docs = alert_service.process_vetor_sw(parsed)
            data_type = "sw"
        elif parsed["type"] == "event":
            docs = alert_service.process_event(parsed)
            data_type = "event"
        else:
            logger.warning(f"⚠️ Tipo desconhecido: {parsed['type']}")
            return

        # 3. Armazenar no CouchDB
        irrigador_id = parsed.get("irrigadorId", "unknown")
        for doc in docs:
            doc_id = alert_service.insert_alert(doc)
            if doc_id:
                alert_service.update_monthly_history(irrigador_id, data_type, doc_id)

        # 4. Se for alerta crítico, enviar notificações
        if (
            parsed["type"] == "event"
            and parsed.get("estado") == "1"
            # and alert_service.should_notify(doc_id or "")
            and alert_service.should_notify(
                alert_id=(doc_id or ""), irrigador_id=irrigador_id
            )
        ):
            logger.info(f"🚨 ALERTA CRÍTICO: {irrigador_id}")

            alert_data = {
                "alertId": doc_id,
                "irrigadorId": irrigador_id,
                "eventType": parsed.get("eventType", "A"),
                "monitor": parsed.get("monitor", "00"),
                "timestamp": parsed.get("timestamp_formatted", ""),
            }

            # 4a. Push notifications
            if mqtt_publisher:
                success = mqtt_publisher.publish_alert(irrigador_id, alert_data)
                if success:
                    logger.info(f"✅ Alerta publicado no MQTT")

            # 4b. Push notifications (Expo)
            push_result = push_service.send_alert_push(irrigador_id, alert_data)
            if push_result.get("success"):
                logger.info(
                    f"✅ Push enviado para {push_result.get('device_count', 0)} devices"
                )
            else:
                logger.info(f"ℹ️ Sem devices registrados para push")

            # 4c. SMS/WhatsApp/Email
            irrigador_info = alert_service.get_irrigador_info(irrigador_id)
            if irrigador_info.get("whatsapp_enabled"):
                phones = irrigador_info.get("phones", [])
                emails = irrigador_info.get("emails", [])

                if phones or emails:
                    message = f"🚨 Alerta: {irrigador_id}\nMonitor: {parsed.get('monitor')}\n{parsed.get('timestamp_formatted')}"

                    result = notification_service.send_multi(
                        message=message,
                        subject=f"Alerta - {irrigador_id}",
                        phones=phones,
                        emails=emails,
                        # channels=["whatsapp", "sms", "email"],
                        # channels=["whatsapp_zapi"],
                        channels=["whatsapp_zapi", "voice_zapi"],
                    )

                    total_sent = sum(
                        r.get("success", 0)
                        for r in result.get("channels", {}).values()
                        if isinstance(r, dict)
                    )
                    logger.info(f"✅ Notificações enviadas: {total_sent} total")

        logger.info(f"✅ Payload processado com sucesso")

    except Exception as e:
        logger.error(f"❌ Erro ao processar payload: {e}", exc_info=True)


# ============================================================================
# Workers
# ============================================================================


def worker_loop(worker_id: int) -> None:
    """Thread worker que processa fila"""
    logger.info(f"👷 Worker-{worker_id} iniciado")

    while not stop_event.is_set():
        try:
            topic, payload = work_q.get(timeout=0.25)
            try:
                process_payload(topic, payload)
            finally:
                work_q.task_done()

        except Empty:
            continue
        except Exception as e:
            logger.error(f"❌ Erro em worker-{worker_id}: {e}")

    logger.info(f"👷 Worker-{worker_id} finalizado")


# ============================================================================
# MQTT Callbacks
# ============================================================================


def on_connect(client, userdata, flags, reason_code, properties=None):
    """MQTT connect callback"""
    if getattr(reason_code, "value", reason_code) == 0:
        logger.info("✅ Conectado ao MQTT broker")
        res = client.subscribe(MQTT_TOPIC, qos=MQTT_QOS)
        logger.info(f"📡 Subscrito: {MQTT_TOPIC} -> {res}")
    else:
        logger.error(f"❌ Falha ao conectar: {reason_code}")


def on_disconnect(client, userdata, reason_code, properties=None):
    """MQTT disconnect callback"""
    logger.warning(f"⚠️ Desconectado do MQTT: {reason_code}")


def on_subscribe(client, userdata, mid, granted_qos, properties=None):
    """MQTT subscribe callback"""
    logger.info(f"📡 Subscription ok: mid={mid}")


def on_message(client, userdata, msg: mqtt.MQTTMessage):
    """MQTT message callback - coloca mensagem na fila"""
    if msg.topic.startswith("$SYS/") or msg.topic.startswith("lindsay/comandos"):
        return

    payload_str = msg.payload.decode("utf-8", errors="ignore")

    try:
        if ON_QUEUE_FULL == "block":
            work_q.put((msg.topic, payload_str), timeout=QUEUE_PUT_TIMEOUT)
        else:
            work_q.put_nowait((msg.topic, payload_str))

        logger.debug(f"📥 Mensagem enfileirada: {msg.topic[:30]}...")

    except Full:
        logger.warning("⚠️ Fila cheia - descartando mensagem (ON_QUEUE_FULL=drop)")


# ============================================================================
# Startup/Shutdown
# ============================================================================


def setup_mqtt_listener() -> bool:
    """Configurar cliente MQTT listener"""
    global mqtt_listener_client

    try:
        mqtt_listener_client = mqtt.Client(
            CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID
        )
        mqtt_listener_client.on_connect = on_connect
        mqtt_listener_client.on_disconnect = on_disconnect
        mqtt_listener_client.on_subscribe = on_subscribe
        mqtt_listener_client.on_message = on_message

        # Credenciais (opcional)
        username = os.getenv("MQTT_USERNAME")
        password = os.getenv("MQTT_PASSWORD")
        if username and password:
            mqtt_listener_client.username_pw_set(username, password)

        mqtt_listener_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        mqtt_listener_client.loop_start()

        logger.info(f"🔌 MQTT listener conectado: {MQTT_BROKER}:{MQTT_PORT}")
        return True

    except Exception as e:
        logger.error(f"❌ Erro ao setup MQTT: {e}")
        return False


def start_workers() -> list:
    """Iniciar thread workers"""
    workers = []
    for i in range(WORKER_COUNT):
        thread = threading.Thread(target=worker_loop, args=(i + 1,), daemon=False)
        thread.start()
        workers.append(thread)

    logger.info(f"🚀 {WORKER_COUNT} workers iniciados")
    return workers


def shutdown_handler(signum, frame):
    """Handler para sinais de shutdown"""
    logger.info(f"🛑 Recebido sinal {signum}, encerrando...")
    stop_event.set()


# ============================================================================
# Main
# ============================================================================


def main():
    """Iniciar listener MQTT"""
    logger.info("=" * 70)
    logger.info("🎯 Lindsay MQTT Listener v2.0")
    logger.info("=" * 70)

    # Registrar signal handlers
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    # Inicializar serviços
    if not init_services():
        logger.error("❌ Falha ao inicializar serviços")
        return 1

    # Setup MQTT listener
    if not setup_mqtt_listener():
        logger.error("❌ Falha ao setup MQTT")
        return 1

    # Iniciar workers
    workers = start_workers()

    logger.info("=" * 70)
    logger.info("✅ MQTT Listener pronto")
    logger.info(f"   Broker: {MQTT_BROKER}:{MQTT_PORT}")
    logger.info(f"   Topic: {MQTT_TOPIC}")
    logger.info(f"   Workers: {WORKER_COUNT}")
    logger.info(f"   Queue: {QUEUE_MAXSIZE}")
    logger.info("=" * 70)

    # Aguardar shutdown
    stop_event.wait()

    # Cleanup
    logger.info("🛑 Encerrando...")
    if mqtt_listener_client:
        mqtt_listener_client.loop_stop()
        mqtt_listener_client.disconnect()

    if mqtt_publisher:
        mqtt_publisher.disconnect()

    # Aguardar workers terminarem
    for worker in workers:
        worker.join(timeout=5)

    logger.info("✅ MQTT Listener encerrado")
    return 0


if __name__ == "__main__":
    sys.exit(main())
