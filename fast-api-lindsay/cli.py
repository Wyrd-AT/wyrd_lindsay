#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lindsay API - CLI Commands
===========================

Use:
    python cli.py setup-db          - Criar schema e índices
    python cli.py create-test-data  - Criar dados de teste
    python cli.py mqtt-listener     - Iniciar MQTT listener
    python cli.py command-processor - Iniciar command processor
    python cli.py simulate          - Iniciar simulador de dados
"""

import os
import sys
import argparse
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import couchdb

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CLI")

BR_TZ = ZoneInfo("America/Sao_Paulo")

# Importar setup scripts
sys.path.insert(0, os.path.dirname(__file__))


# ============================================================================
# Setup Database
# ============================================================================

def setup_db():
    """Criar schema e índices no CouchDB"""
    from dotenv import load_dotenv
    load_dotenv()

    COUCHDB_URL = os.getenv("COUCHDB_URL", "https://admin:wyrd@db.vpn.ind.br")
    COUCHDB_DB = os.getenv("COUCHDB_DB", "lindsay-data")

    logger.info("=" * 70)
    logger.info("📦 Criando schema e índices...")
    logger.info("=" * 70)

    try:
        server = couchdb.Server(COUCHDB_URL)

        # Criar database se não existir
        try:
            db = server[COUCHDB_DB]
            logger.info(f"✅ Database já existe: {COUCHDB_DB}")
        except couchdb.http.ResourceNotFound:
            db = server.create(COUCHDB_DB)
            logger.info(f"✅ Database criado: {COUCHDB_DB}")

        # Criar design docs e índices
        logger.info("📝 Criando design docs...")

        # Design doc para revendas
        revendas_design = {
            "_id": "_design/revendas",
            "views": {
                "by_status": {
                    "map": "function(doc) { if(doc.table === 'revenda') emit(doc.status, null); }"
                },
                "by_domain": {
                    "map": "function(doc) { if(doc.table === 'revenda') emit(doc.domain, null); }"
                },
            }
        }

        try:
            db.save(revendas_design)
            logger.info("✅ Design doc 'revendas' criado")
        except couchdb.http.ResourceConflict:
            logger.info("ℹ️ Design doc 'revendas' já existe")

        # Design doc para pivôs
        pivos_design = {
            "_id": "_design/pivos",
            "views": {
                "by_owner": {
                    "map": "function(doc) { if(doc.table === 'pivo') emit(doc.owner_id, null); }"
                },
                "by_gerente": {
                    "map": "function(doc) { if(doc.table === 'pivo') emit(doc.gerente_id, null); }"
                },
                "all": {
                    "map": "function(doc) { if(doc.table === 'pivo') emit(null, null); }"
                },
            }
        }

        try:
            db.save(pivos_design)
            logger.info("✅ Design doc 'pivos' criado")
        except couchdb.http.ResourceConflict:
            logger.info("ℹ️ Design doc 'pivos' já existe")

        # Criar índices Mango
        logger.info("📇 Criando índices Mango...")

        indexes = [
            {
                "index": {"fields": ["table", "status"]},
                "name": "idx_table_status",
                "type": "json",
            },
            {
                "index": {"fields": ["table", "irrigadorId"]},
                "name": "idx_table_irrigador",
                "type": "json",
            },
            {
                "index": {"fields": ["table", "owner_id"]},
                "name": "idx_table_owner",
                "type": "json",
            },
            {
                "index": {"fields": ["table", "gerente_id"]},
                "name": "idx_table_gerente",
                "type": "json",
            },
            {
                "index": {"fields": ["table", "timestamp"]},
                "name": "idx_table_timestamp",
                "type": "json",
            },
        ]

        import requests
        for idx in indexes:
            try:
                response = requests.post(
                    f"{COUCHDB_URL}/{COUCHDB_DB}/_index",
                    json=idx,
                    timeout=10,
                )
                if response.status_code in (200, 201):
                    logger.info(f"✅ Índice '{idx['name']}' criado")
                else:
                    logger.warning(f"⚠️ Erro ao criar índice '{idx['name']}': {response.status_code}")
            except Exception as e:
                logger.warning(f"⚠️ Erro ao criar índice '{idx['name']}': {e}")

        logger.info("=" * 70)
        logger.info("✅ Setup concluído com sucesso!")
        logger.info("=" * 70)
        return 0

    except Exception as e:
        logger.error(f"❌ Erro ao fazer setup: {e}")
        return 1


# ============================================================================
# Create Test Data
# ============================================================================

def create_test_data():
    """Criar dados de teste"""
    from dotenv import load_dotenv
    load_dotenv()

    COUCHDB_URL = os.getenv("COUCHDB_URL", "https://admin:wyrd@db.vpn.ind.br")
    COUCHDB_DB = os.getenv("COUCHDB_DB", "lindsay-data")

    logger.info("=" * 70)
    logger.info("🧪 Criando dados de teste...")
    logger.info("=" * 70)

    try:
        server = couchdb.Server(COUCHDB_URL)
        db = server[COUCHDB_DB]

        # Criar admin
        admin_doc = {
            "_id": "admin:admin@example.com",
            "table": "admin",
            "email": "admin@example.com",
            "name": "Admin Lindsay",
            "type": "admin",
            "status": "active",
            "created_at": datetime.now(BR_TZ).isoformat(),
        }

        try:
            db.save(admin_doc)
            logger.info("✅ Admin criado: admin@example.com")
        except couchdb.http.ResourceConflict:
            logger.info("ℹ️ Admin já existe")

        # Criar revenda
        revenda_doc = {
            "_id": "revenda:example.com",
            "table": "revenda",
            "email": "revenda@example.com",
            "name": "Revenda Exemplo",
            "domain": "example.com",
            "type": "revenda",
            "status": "active",
            "created_at": datetime.now(BR_TZ).isoformat(),
        }

        try:
            db.save(revenda_doc)
            logger.info("✅ Revenda criada: example.com")
        except couchdb.http.ResourceConflict:
            logger.info("ℹ️ Revenda já existe")

        # Criar cliente
        cliente_doc = {
            "_id": "cliente:cliente@example.com",
            "table": "cliente",
            "email": "cliente@example.com",
            "name": "Cliente Exemplo",
            "type": "cliente",
            "status": "active",
            "gerente_id": "revenda:example.com",
            "created_at": datetime.now(BR_TZ).isoformat(),
        }

        try:
            db.save(cliente_doc)
            logger.info("✅ Cliente criado: cliente@example.com")
        except couchdb.http.ResourceConflict:
            logger.info("ℹ️ Cliente já existe")

        # Criar pivôs de teste
        for i in range(1, 4):
            pivo_doc = {
                "_id": f"pivo:test_pivo_{i}",
                "table": "pivo",
                "codigo": f"P{i:03d}",
                "nome": f"Pivô de Teste {i}",
                "owner_id": "cliente@example.com",
                "gerente_id": "revenda:example.com",
                "ativo": True,
                "created_at": datetime.now(BR_TZ).isoformat(),
            }

            try:
                db.save(pivo_doc)
                logger.info(f"✅ Pivô criado: {pivo_doc['nome']}")
            except couchdb.http.ResourceConflict:
                logger.info(f"ℹ️ Pivô já existe: {pivo_doc['nome']}")

        logger.info("=" * 70)
        logger.info("✅ Dados de teste criados!")
        logger.info("=" * 70)
        return 0

    except Exception as e:
        logger.error(f"❌ Erro ao criar dados de teste: {e}")
        return 1


# ============================================================================
# MQTT Listener
# ============================================================================

def mqtt_listener():
    """Iniciar MQTT listener"""
    from app.workers.mqtt_listener import main as mqtt_main

    return mqtt_main()


# ============================================================================
# Command Processor
# ============================================================================

def command_processor():
    """Iniciar command processor"""
    from app.workers.command_processor import main as cmd_main

    return cmd_main()


# ============================================================================
# Simulator
# ============================================================================

def simulate():
    """Iniciar simulador de dados"""
    logger.info("=" * 70)
    logger.info("🎮 Simulador de dados MQTT")
    logger.info("=" * 70)
    logger.info("❌ Simulador ainda não implementado")
    logger.info("=" * 70)
    return 1


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Lindsay API - CLI Commands")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    subparsers.add_parser("setup-db", help="Criar schema e índices no CouchDB")
    subparsers.add_parser("create-test-data", help="Criar dados de teste")
    subparsers.add_parser("mqtt-listener", help="Iniciar MQTT listener worker")
    subparsers.add_parser("command-processor", help="Iniciar command processor worker")
    subparsers.add_parser("simulate", help="Iniciar simulador de dados")

    args = parser.parse_args()

    if args.command == "setup-db":
        return setup_db()
    elif args.command == "create-test-data":
        return create_test_data()
    elif args.command == "mqtt-listener":
        return mqtt_listener()
    elif args.command == "command-processor":
        return command_processor()
    elif args.command == "simulate":
        return simulate()
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
