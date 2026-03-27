#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compat wrapper para o pipeline MQTT legado.

Em vez de manter um parser divergente do contrato real do sistema, este worker
passa a gerenciar o `lindsay_parsed.py`, que continua sendo a implementação de
referência para ingestão MQTT -> CouchDB -> notificações.
"""

import logging

from app.workers.legacy_process import start_process, stop_process, wait_process

logger = logging.getLogger("mqtt_listener")

ROLE = "parsed"
SCRIPT = "lindsay_parsed.py"


def start_mqtt_background() -> bool:
    logger.info("Iniciando worker MQTT legado compatível...")
    return start_process(ROLE, SCRIPT)


def stop_mqtt_background() -> None:
    stop_process(ROLE)


def main() -> int:
    logger.info("=" * 70)
    logger.info("🎯 Lindsay MQTT Listener (legacy compatible)")
    logger.info("=" * 70)

    if not start_process(ROLE, SCRIPT):
        return 1

    return wait_process(ROLE)


if __name__ == "__main__":
    raise SystemExit(main())
