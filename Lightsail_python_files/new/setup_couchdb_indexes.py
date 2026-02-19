#!/usr/bin/env python3
"""
Script para criar índices CouchDB para otimização de queries
Executar uma vez após deploy ou quando schema mudar

Uso:
    python setup_couchdb_indexes.py
"""
import os
import sys
import json
import requests
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

COUCHDB_URL = os.getenv("COUCHDB_URL")
DATABASE = os.getenv("COUCHDB_DB", "lindsay-data")

def log(msg: str, level: str = "INFO"):
    """Imprimir log com formatação"""
    print(f"[{level}] {msg}")

def create_indexes():
    """Cria todos os índices necessários no CouchDB"""

    if not COUCHDB_URL or not DATABASE:
        log("COUCHDB_URL ou COUCHDB_DB não configurados!", "ERROR")
        return False

    log(f"Conectando a {COUCHDB_URL}/{DATABASE}...")

    # Verificar se banco existe
    try:
        response = requests.head(f"{COUCHDB_URL}/{DATABASE}")
        if response.status_code != 200:
            log(f"Database '{DATABASE}' não encontrado!", "ERROR")
            return False
    except Exception as e:
        log(f"Erro ao conectar ao CouchDB: {e}", "ERROR")
        return False

    # Índices a criar
    indexes = [
        {
            "index": {
                "fields": ["table", "irrigadorId", "estado", "timestamp"]
            },
            "name": "idx_events_estado_ts",
            "type": "json",
            "ddoc": "queries"
        },
        {
            "index": {
                "fields": ["table", "irrigadorId", "timestamp"]
            },
            "name": "idx_command_irrigador_ts",
            "type": "json",
            "ddoc": "queries"
        },
        {
            "index": {
                "fields": ["table", "codigo"]
            },
            "name": "idx_irrigadores_codigo",
            "type": "json",
            "ddoc": "queries"
        },
        {
            "index": {
                "fields": ["table"]
            },
            "name": "idx_table_only",
            "type": "json",
            "ddoc": "queries"
        }
    ]

    log(f"🔄 Criando {len(indexes)} índices no database '{DATABASE}'...")

    success_count = 0
    for idx in indexes:
        try:
            # CouchDB API para criar índice
            response = requests.post(
                f"{COUCHDB_URL}/{DATABASE}/_index",
                json=idx,
                headers={"Content-Type": "application/json"},
                timeout=30
            )

            if response.status_code in [200, 201]:
                log(f"✅ Índice '{idx['name']}' criado com sucesso", "OK")
                success_count += 1
            elif response.status_code == 409:
                log(f"⚠️  Índice '{idx['name']}' já existe", "WARN")
                success_count += 1  # Contar como sucesso
            else:
                log(f"❌ Erro ao criar '{idx['name']}': HTTP {response.status_code}", "ERROR")
                try:
                    log(f"   Response: {response.text}", "ERROR")
                except:
                    pass

        except requests.exceptions.Timeout:
            log(f"❌ Timeout ao criar '{idx['name']}'", "ERROR")
        except requests.exceptions.RequestException as e:
            log(f"❌ Exceção de rede ao criar '{idx['name']}': {e}", "ERROR")
        except Exception as e:
            log(f"❌ Exceção ao criar '{idx['name']}': {e}", "ERROR")

    # Resultado final
    log("")
    if success_count == len(indexes):
        log(f"✅ Setup de índices concluído com sucesso! ({success_count}/{len(indexes)})", "OK")
        return True
    elif success_count > 0:
        log(f"⚠️  Setup de índices parcialmente concluído ({success_count}/{len(indexes)})", "WARN")
        return True  # Retornar True mesmo com parcial (índices já existentes)
    else:
        log(f"❌ Setup de índices falhou ({success_count}/{len(indexes)})", "ERROR")
        return False

if __name__ == "__main__":
    success = create_indexes()
    sys.exit(0 if success else 1)
