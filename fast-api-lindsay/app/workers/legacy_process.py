#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Legacy worker process manager.

Gerencia subprocessos dos scripts legados que hoje representam o contrato real
de MQTT/CouchDB do sistema Lindsay.
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger("legacy_process")

FASTAPI_ROOT = Path(__file__).resolve().parents[2]
LEGACY_DIR = FASTAPI_ROOT / "legacy_runtime"

_LOCK = threading.Lock()
_PROCESSES: Dict[str, subprocess.Popen] = {}


def _legacy_script_path(script_name: str) -> Path:
    return LEGACY_DIR / script_name


def _default_env(role: str) -> Dict[str, str]:
    env = os.environ.copy()

    mqtt_client_id = env.get("MQTT_CLIENT_ID", "lindsay-api")
    mqtt_publisher_client_id = env.get(
        "MQTT_PUBLISHER_CLIENT_ID",
        f"{mqtt_client_id}-publisher",
    )

    defaults = {
        "COUCHDB_URL": "https://admin:wyrd@db.vpn.ind.br",
        "COUCHDB_DB": "lindsay-data",
        "MQTT_BROKER": "localhost",
        "MQTT_PORT": "1883",
        "MQTT_QOS": "1",
        "MQTT_TOPIC": "lindsay/#",
        "MQTT_CLIENT_ID": mqtt_client_id,
        "MQTT_PUBLISHER_CLIENT_ID": mqtt_publisher_client_id,
        "WORKER_COUNT": "8",
        "QUEUE_MAXSIZE": "5000",
        "QUEUE_PUT_TIMEOUT": "0.01",
        "ON_QUEUE_FULL": "block",
        "COUCHDB_CHANGES_TIMEOUT_MS": "30000",
        "COUCHDB_CHANGES_HTTP_TIMEOUT": "65",
        "RATE_LIMIT_DELAY": "0.5",
        "NOTIFICATION_MODE": "whatsapp_zapi",
        "VOICE_ZAPI_MAX_ATTEMPTS": "5",
        "WS_HOST": "127.0.0.1",
        "WS_PORT": "8765",
        "WS_PATH": "/ws",
        "WS_PING_INTERVAL": "30",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONUTF8": "1",
        "TZ": "America/Sao_Paulo",
    }

    for key, value in defaults.items():
        env.setdefault(key, value)

    if env.get("MQTT_TOPIC") == "pivo/+/dados":
        env["MQTT_TOPIC"] = "lindsay/#"

    if role == "parsed":
        env.setdefault("MQTT_CLIENT_ID", f"{mqtt_client_id}-parsed")
    elif role == "commands":
        env.setdefault("MQTT_PUBLISHER_CLIENT_ID", f"{mqtt_client_id}-commands")

    return env


def is_running(role: str) -> bool:
    with _LOCK:
        proc = _PROCESSES.get(role)
        return proc is not None and proc.poll() is None


def start_process(role: str, script_name: str) -> bool:
    with _LOCK:
        existing = _PROCESSES.get(role)
        if existing and existing.poll() is None:
            logger.info("ℹ️ Processo legado '%s' já está rodando (pid=%s)", role, existing.pid)
            return True

        script_path = _legacy_script_path(script_name)
        if not script_path.exists():
            logger.error("❌ Script legado não encontrado: %s", script_path)
            return False

        env = _default_env(role)

        logger.info("🚀 Iniciando processo legado '%s': %s", role, script_path)
        proc = subprocess.Popen(
            [sys.executable, "-u", str(script_path)],
            cwd=str(LEGACY_DIR),
            env=env,
        )
        _PROCESSES[role] = proc

    time.sleep(1.5)

    if proc.poll() is not None:
        logger.error("❌ Processo legado '%s' encerrou logo após iniciar (exit=%s)", role, proc.returncode)
        with _LOCK:
            _PROCESSES.pop(role, None)
        return False

    logger.info("✅ Processo legado '%s' iniciado (pid=%s)", role, proc.pid)
    return True


def stop_process(role: str, timeout: float = 10.0) -> None:
    with _LOCK:
        proc = _PROCESSES.get(role)

    if not proc:
        return

    if proc.poll() is not None:
        with _LOCK:
            _PROCESSES.pop(role, None)
        return

    logger.info("🛑 Encerrando processo legado '%s' (pid=%s)", role, proc.pid)
    proc.terminate()

    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        logger.warning("⚠️ Processo legado '%s' não encerrou no tempo esperado; forçando kill", role)
        proc.kill()
        proc.wait(timeout=5)

    with _LOCK:
        _PROCESSES.pop(role, None)


def wait_process(role: str) -> int:
    with _LOCK:
        proc = _PROCESSES.get(role)

    if not proc:
        logger.error("❌ Nenhum processo legado '%s' está em execução", role)
        return 1

    try:
        return proc.wait()
    finally:
        with _LOCK:
            _PROCESSES.pop(role, None)
