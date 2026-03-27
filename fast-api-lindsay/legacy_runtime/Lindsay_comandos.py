#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serviço CouchDB → MQTT Command Publisher com Timer
==================================================

Monitora o CouchDB (_changes feed) em busca de documentos com table="command"
e publica os comandos no broker MQTT nos tópicos apropriados.

Suporta agendamento de comandos via timer_minutes.

Fluxo:
1. App React Native salva comando no CouchDB (table: "command")
2. Este serviço detecta via _changes
3. Se timer_minutes > 0: agenda para depois
   Se timer_minutes == 0: publica imediatamente
4. Irrigador/PLC recebe e executa o comando

Baseado no padrão do código existente do projeto.
"""
import os
import signal
import sys
import threading
from datetime import datetime
from typing import Any, Dict
from zoneinfo import ZoneInfo

import couchdb
from couchdb.http import ResourceNotFound
import paho.mqtt.client as mqtt
import requests
from dotenv import load_dotenv

load_dotenv()

# =========================
# Configurações
# =========================
BR_TZ = ZoneInfo("America/Sao_Paulo")

COUCHDB_URL = os.getenv("COUCHDB_URL")
DATABASE_NAME = os.getenv("COUCHDB_DB")

MQTT_BROKER = os.getenv("MQTT_BROKER")
MQTT_PORT = int(os.getenv("MQTT_PORT"))
MQTT_CLIENT_ID = os.getenv("MQTT_PUBLISHER_CLIENT_ID")
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None
MQTT_KEEPALIVE = 60
CHANGES_TIMEOUT_MS = int(os.getenv("COUCHDB_CHANGES_TIMEOUT_MS", "30000"))
CHANGES_HTTP_TIMEOUT = int(os.getenv("COUCHDB_CHANGES_HTTP_TIMEOUT", "65"))

# Dicionário para gerenciar timers ativos: {doc_id: threading.Timer}
timers: Dict[str, threading.Timer] = {}
HTTP = requests.Session()

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
# Funções de Marcação de Status
# =========================
def mark_as_scheduled(doc_id: str, delay_seconds: int) -> None:
    """Marca documento como agendado no CouchDB."""
    try:
        doc = db[doc_id]
        doc["scheduled"] = True
        doc["status"] = "scheduled"
        doc["scheduled_at"] = datetime.now(BR_TZ).isoformat()
        db.save(doc)
        log("ok", f"Marcado como agendado: {doc_id} ({delay_seconds}s)")
    except couchdb.http.ResourceConflict:
        log("warn", f"Conflito ao marcar como agendado: {doc_id}")
    except Exception as e:
        log("error", f"Erro ao marcar como agendado {doc_id}: {e}")


def mark_as_executed(doc_id: str) -> None:
    """Marca documento como executado no CouchDB."""
    try:
        doc = db[doc_id]
        doc["executed"] = True
        doc["status"] = "executed"
        doc["executed_at"] = datetime.now(BR_TZ).isoformat()
        db.save(doc)
        log("ok", f"Marcado como executado: {doc_id}")
    except couchdb.http.ResourceConflict:
        log("warn", f"Conflito ao marcar como executado: {doc_id}")
    except Exception as e:
        log("error", f"Erro ao marcar como executado {doc_id}: {e}")


def mark_as_published(doc_id: str) -> None:
    """Marca documento como publicado (imediato)."""
    try:
        doc = db[doc_id]
        doc["status"] = "published"
        doc["published_at"] = datetime.now(BR_TZ).isoformat()
        db.save(doc)
    except couchdb.http.ResourceConflict:
        log("warn", f"Conflito ao marcar como publicado: {doc_id}")
    except Exception as e:
        log("error", f"Erro ao marcar como publicado {doc_id}: {e}")


def mark_as_failed(doc_id: str, error_msg: str) -> None:
    """Marca documento como falho."""
    try:
        doc = db[doc_id]
        doc["status"] = "failed"
        doc["error"] = error_msg
        doc["failed_at"] = datetime.now(BR_TZ).isoformat()
        db.save(doc)
    except couchdb.http.ResourceConflict:
        log("warn", f"Conflito ao marcar como falho: {doc_id}")
    except Exception as e:
        log("error", f"Erro ao marcar como falho {doc_id}: {e}")


# =========================
# Processamento de Comandos
# =========================
def publish_now(doc: Dict[str, Any]) -> None:
    """
    Publica comando imediatamente no MQTT.

    Args:
        doc: Documento do CouchDB com table="command"
    """
    doc_id = doc.get("_id")
    topic = doc.get("topic")
    payload = doc.get("payload")
    qos = int(doc.get("qos", 0))
    origin = doc.get("origin", "unknown")

    try:
        # Publica no MQTT
        result = mqtt_client.publish(topic, payload, qos=qos)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            log("ok", f"Publicado [{origin}]: {topic} -> {payload}")
            mark_as_published(doc_id)
        else:
            log("error", f"Falha ao publicar comando {doc_id}: rc={result.rc}")
            mark_as_failed(doc_id, f"MQTT publish failed: rc={result.rc}")

    except Exception as e:
        log("error", f"Exceção ao publicar comando {doc_id}: {e}")
        mark_as_failed(doc_id, str(e))


def schedule_command(doc: Dict[str, Any]) -> None:
    """
    Agenda comando para execução futura.

    Args:
        doc: Documento do CouchDB com timer_minutes
    """
    doc_id = doc.get("_id")
    timer_minutes = doc.get("timer_minutes", 0)

    try:
        timer_minutes_int = int(timer_minutes)
    except (ValueError, TypeError):
        log("warn", f"Timer inválido para {doc_id}: {timer_minutes}")
        return

    if timer_minutes_int <= 0:
        log("warn", f"Timer <= 0 para {doc_id}, publicando imediatamente")
        publish_now(doc)
        return

    delay_seconds = timer_minutes_int * 60

    # Cancela timer anterior se existir (atualização de agendamento)
    if doc_id in timers:
        timers[doc_id].cancel()
        log("info", f"Timer anterior cancelado para {doc_id}")

    def _execute_delayed():
        """Callback executado após o delay."""
        try:
            log("info", f"Executando comando agendado: {doc_id}")
            publish_now(doc)
            mark_as_executed(doc_id)
            # Remove do dicionário de timers ativos
            timers.pop(doc_id, None)
        except Exception as e:
            log("error", f"Erro ao executar comando agendado {doc_id}: {e}")

    # Cria e inicia novo timer
    timer = threading.Timer(delay_seconds, _execute_delayed)
    timer.daemon = True  # Thread daemon: fecha com o programa
    timer.start()
    timers[doc_id] = timer

    # Marca como agendado no CouchDB
    mark_as_scheduled(doc_id, delay_seconds)

    log("ok", f"Comando agendado: {doc_id} para {timer_minutes_int} min ({delay_seconds}s)")


def publish_command(doc: Dict[str, Any]) -> None:
    """
    Processa comando: decide se publica imediatamente ou agenda.

    Args:
        doc: Documento do CouchDB com table="command"
    """
    doc_id = doc.get("_id")
    topic = doc.get("topic")
    payload = doc.get("payload")
    timer_minutes = doc.get("timer_minutes", 0)

    # Validação básica
    if not topic or not payload:
        log("warn", f"Comando inválido (sem topic/payload): {doc_id}")
        return

    # Ignora se já foi processado/agendado
    status = doc.get("status", "")
    if status in ("published", "scheduled", "executed"):
        return

    # Ignora se origem é esp32/scheduler (evita loop)
    if doc.get("origin") in ("esp32", "scheduler"):
        return

    # Decide: agendar ou publicar imediatamente
    try:
        timer_minutes_int = int(timer_minutes) if timer_minutes else 0
    except (ValueError, TypeError):
        timer_minutes_int = 0

    if timer_minutes_int > 0:
        schedule_command(doc)
    else:
        publish_now(doc)


# =========================
# Monitor de Mudanças
# =========================
def process_pending_backlog() -> None:
    """Processa comandos pendentes existentes antes de entrar no _changes."""
    log("info", "Verificando backlog de comandos pendentes...")

    query = {
        "selector": {
            "table": "command",
            "status": {"$nin": ["published", "scheduled", "executed", "cancelled"]},
        },
        "limit": 500,
    }

    try:
        for doc in db.find(query):
            try:
                publish_command(doc)
            except Exception as e:
                log("error", f"Erro ao processar backlog {doc.get('_id')}: {e}")
    except Exception as e:
        log("error", f"Erro ao consultar backlog de comandos: {e}")


def poll_changes_forever() -> None:
    """
    Faz long-poll no _changes usando requests.

    Evita os problemas de parsing do cliente couchdb em feeds contínuos com
    heartbeat no ambiente atual.
    """
    since: Any = "now"
    changes_url = f"{COUCHDB_URL}/{DATABASE_NAME}/_changes"

    while True:
        params = {
            "feed": "longpoll",
            "include_docs": "true",
            "since": since,
            "timeout": CHANGES_TIMEOUT_MS,
        }

        response = HTTP.get(changes_url, params=params, timeout=CHANGES_HTTP_TIMEOUT)
        response.raise_for_status()
        data = response.json()

        for change in data.get("results", []):
            doc = change.get("doc")
            if not doc:
                continue

            if doc.get("table") != "command":
                continue

            publish_command(doc)

        if "last_seq" in data:
            since = data["last_seq"]


def listen_changes() -> None:
    """
    Escuta o feed contínuo de mudanças do CouchDB.

    Processa apenas documentos com:
    - table = "command"
    - status NOT IN ("published", "scheduled", "executed")
    - origin != "esp32" (evita loop)
    """
    log("info", "Iniciando monitoramento de comandos com suporte a timer...")
    log("info", f"Timers ativos serão gerenciados em memória")

    try:
        process_pending_backlog()
        poll_changes_forever()

    except KeyboardInterrupt:
        log("info", "Interrompido pelo usuário")
    except Exception as e:
        log("error", f"Erro no loop de mudanças: {e}")
        raise


# =========================
# Shutdown Gracioso
# =========================
def shutdown(*args) -> None:
    """Encerra timers, MQTT e sai graciosamente."""
    log("info", "Encerrando serviço...")

    # Cancela todos os timers ativos
    if timers:
        log("info", f"Cancelando {len(timers)} timer(s) ativo(s)...")
        for doc_id, timer in list(timers.items()):
            try:
                timer.cancel()
                log("info", f"Timer cancelado: {doc_id}")
            except Exception as e:
                log("error", f"Erro ao cancelar timer {doc_id}: {e}")
        timers.clear()

    # Desconecta MQTT
    try:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
        log("ok", "MQTT desconectado")
    except Exception as e:
        log("error", f"Erro ao desconectar MQTT: {e}")

    log("ok", "Serviço encerrado com sucesso")
    sys.exit(0)


# =========================
# Main
# =========================
if __name__ == "__main__":
    print("=" * 70)
    print("Sistema CouchDB → MQTT Command Publisher com Timer")
    print("Publica comandos do app no broker MQTT")
    print("Suporta agendamento via timer_minutes")
    print("=" * 70)
    print()
    print(f"📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"💾 CouchDB: {DATABASE_NAME}")
    print(f"⏰ Timers: Gerenciados em memória (threading.Timer)")
    print()
    print("Comandos com timer_minutes > 0 serão agendados")
    print("Comandos com timer_minutes = 0 serão publicados imediatamente")
    print()
    print("=" * 70)
    print()

    # Captura sinais para shutdown gracioso
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Inicia monitoramento
    listen_changes()
