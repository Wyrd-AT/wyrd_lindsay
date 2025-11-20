#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço CouchDB → MQTT Command Publisher
========================================

Monitora o CouchDB (_changes feed) em busca de documentos com table="command"
e publica os comandos no broker MQTT nos tópicos apropriados.

Fluxo:
1. App React Native salva comando no CouchDB (table: "command")
2. Este serviço detecta via _changes
3. Publica no MQTT: lindsay/comandos/{irrigadorId}
4. Irrigador/PLC recebe e executa o comando

Baseado no padrão do código existente do projeto.
"""
import os
import signal
import sys
from datetime import datetime
from typing import Any, Dict
from zoneinfo import ZoneInfo

import couchdb
from couchdb.http import ResourceNotFound
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv()

# =========================
# Configurações
# =========================
BR_TZ = ZoneInfo("America/Sao_Paulo")

COUCHDB_URL = "http://admin:wyrd@3.91.165.0:5984/"
DATABASE_NAME = "mqtt_data"
MQTT_BROKER = os.getenv("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_CLIENT_ID = os.getenv("MQTT_PUBLISHER_CLIENT_ID", "lindsay-command-publisher")
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None
MQTT_KEEPALIVE = 60

# =========================
# Logging
# =========================
def log(level: str, msg: str):
    """Log com timestamp em São Paulo."""
    ts = datetime.now(BR_TZ).strftime("%Y-%m-%d %H:%M:%S")
    print(f"{ts} [{level.upper()}] {msg}", flush=True)


# =========================
# Conexões CouchDB + MQTT
# =========================
server = couchdb.Server(COUCHDB_URL)

try:
    db = server[DATABASE_NAME]
    log("ok", f"Conectado ao CouchDB: {DATABASE_NAME}")
except ResourceNotFound:
    db = server.create(DATABASE_NAME)
    log("ok", f"Database '{DATABASE_NAME}' criado")

mqtt_client = mqtt.Client(client_id=MQTT_CLIENT_ID)

if MQTT_USERNAME and MQTT_PASSWORD:
    mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

mqtt_client.connect(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
mqtt_client.loop_start()
log("ok", f"Conectado ao MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")


# =========================
# Processamento de Comandos
# =========================
def publish_command(doc: Dict[str, Any]) -> None:
    """
    Publica um comando no MQTT e atualiza seu status no CouchDB.

    Args:
        doc: Documento do CouchDB com table="command"
    """
    doc_id = doc.get("_id")
    topic = doc.get("topic")
    payload = doc.get("payload")
    qos = int(doc.get("qos", 0))
    origin = doc.get("origin", "unknown")

    # Validação básica
    if not topic or not payload:
        log("warn", f"Comando inválido (sem topic/payload): {doc_id}")
        return

    # Ignora se já foi processado
    if doc.get("status") == "published":
        return

    try:
        # Publica no MQTT
        result = mqtt_client.publish(topic, payload, qos=qos)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            log("ok", f"Publicado [{origin}]: {topic} -> {payload}")

            # Atualiza status no CouchDB
            try:
                doc["status"] = "published"
                doc["published_at"] = datetime.now(BR_TZ).isoformat()
                db.save(doc)
            except couchdb.http.ResourceConflict:
                # Conflito de revisão - não é crítico
                log("warn", f"Conflito ao atualizar status do doc {doc_id}")
        else:
            log("error", f"Falha ao publicar comando {doc_id}: rc={result.rc}")

            # Marca como failed
            try:
                doc["status"] = "failed"
                doc["error"] = f"MQTT publish failed: rc={result.rc}"
                doc["failed_at"] = datetime.now(BR_TZ).isoformat()
                db.save(doc)
            except couchdb.http.ResourceConflict:
                log("warn", f"Conflito ao marcar erro do doc {doc_id}")

    except Exception as e:
        log("error", f"Exceção ao publicar comando {doc_id}: {e}")


# =========================
# Monitor de Mudanças
# =========================
def listen_changes() -> None:
    """
    Escuta o feed contínuo de mudanças do CouchDB.

    Processa apenas documentos com:
    - table = "command"
    - status != "published" (evita reprocessar)
    - origin != "esp32" (evita loop)
    """
    log("info", "Iniciando monitoramento de comandos...")

    try:
        # feed='continuous' retorna um gerador de mudanças
        # include_docs=True inclui o documento completo
        # heartbeat=1000 evita timeouts
        changes = db.changes(feed="continuous", include_docs=True, heartbeat=1000)

        for change in changes:
            try:
                doc = change.get("doc")
                if not doc:
                    continue

                # Filtra apenas comandos pendentes
                if doc.get("table") != "command":
                    continue

                # Ignora se já processado ou se veio do ESP32
                if doc.get("status") == "published":
                    continue

                if doc.get("origin") in ("esp32", "scheduler"):
                    continue

                # Processa o comando
                publish_command(doc)

            except Exception as e:
                log("error", f"Erro ao processar mudança: {e}")

    except KeyboardInterrupt:
        log("info", "Interrompido pelo usuário")
    except Exception as e:
        log("error", f"Erro no loop de mudanças: {e}")
        raise


# =========================
# Shutdown Gracioso
# =========================
def shutdown(*args) -> None:
    """Encerra MQTT e sai graciosamente."""
    log("info", "Encerrando serviço...")

    try:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        log("ok", "MQTT desconectado")
    except Exception as e:
        log("error", f"Erro ao desconectar MQTT: {e}")

    sys.exit(0)


# =========================
# Main
# =========================
if __name__ == "__main__":
    print("=" * 60)
    print("Sistema CouchDB → MQTT Command Publisher")
    print("Publica comandos do app no broker MQTT")
    print("=" * 60)
    print()

    # Captura sinais para shutdown gracioso
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Inicia monitoramento
    listen_changes()

