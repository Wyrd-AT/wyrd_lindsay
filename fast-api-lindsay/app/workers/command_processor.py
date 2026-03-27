#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compat wrapper para o publisher de comandos legado.

Gerencia o `Lindsay_comandos.py`, preservando o contrato atual de CouchDB ->
MQTT com topic/payload crus e timers.
"""

import logging

from app.workers.legacy_process import start_process, stop_process, wait_process

logger = logging.getLogger("command_processor")

ROLE = "commands"
SCRIPT = "Lindsay_comandos.py"


def start_command_background() -> bool:
    logger.info("Iniciando command processor legado compatível...")
    return start_process(ROLE, SCRIPT)


def stop_command_background() -> None:
    stop_process(ROLE)


def main() -> int:
    logger.info("=" * 70)
    logger.info("🎯 Lindsay Command Processor (legacy compatible)")
    logger.info("=" * 70)

    if not start_process(ROLE, SCRIPT):
        return 1

    return wait_process(ROLE)


if __name__ == "__main__":
    raise SystemExit(main())
