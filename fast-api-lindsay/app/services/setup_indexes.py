#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Setup de Índices Mango para CouchDB - Sistema Lindsay

Configura os índices necessários para otimizar as queries de:
- Filtragem de revendas por cnpj_admin
- Filtragem de clientes por revenda_id
- Filtragem de revendas por status
"""

import requests
from typing import Tuple


def setup_indexes(couchdb_url: str, database: str) -> Tuple[bool, str]:
    """
    Criar índices Mango necessários para o sistema Lindsay

    Args:
        couchdb_url: URL do CouchDB (ex: http://admin:password@localhost:5984)
        database: Nome do banco de dados (ex: lindsay-data)

    Returns:
        Tuple[bool, str]: (sucesso, mensagem)
    """
    try:
        # Índices a criar
        indexes = [
            {
                "name": "type-cnpj_admin",
                "fields": ["type", "cnpj_admin"],
                "desc": "Índice para filtrar revendas por admin",
            },
            {
                "name": "type-status",
                "fields": ["type", "status"],
                "desc": "Índice para filtrar por tipo e status",
            },
            {
                "name": "type-revenda_id",
                "fields": ["type", "revenda_id"],
                "desc": "Índice para filtrar clientes por revenda",
            },
            {
                "name": "email",
                "fields": ["email"],
                "desc": "Índice para busca por email",
            },
            {
                "name": "type-cnpj_cliente-sub_role",
                "fields": ["type", "cnpj_cliente", "sub_role"],
                "desc": "Índice para filtrar usuários de empresa por cnpj_cliente e sub_role",
            },
            {
                "name": "invitation-token",
                "fields": ["invitation_token"],
                "desc": "Índice para busca por token de convite",
            },
            {
                "name": "voice-tracking-phone-status",
                "fields": ["table", "phone_clean", "status"],
                "desc": "Índice para tracking de ligações Z-API por telefone/status",
            },
            {
                "name": "voice-tracking-message-id",
                "fields": ["table", "last_message_id"],
                "desc": "Índice para tracking de ligações Z-API por messageId",
            },
            {
                "name": "voice-tracking-zaap-id",
                "fields": ["table", "last_zaap_id"],
                "desc": "Índice para tracking de ligações Z-API por zaapId",
            },
            {
                "name": "idx_tensao_raw_irrigador_tipo_ts",
                "fields": ["table", "irrigadorId", "tipo", "timestamp"],
                "desc": "Índice para histórico de tensão por irrigador",
            },
            {
                "name": "idx_sw_raw_irrigador_ts",
                "fields": ["table", "irrigadorId", "timestamp"],
                "desc": "Índice para histórico SW por irrigador",
            },
            {
                "name": "idx_events_irrigador_eventType_ts",
                "fields": ["table", "irrigadorId", "eventType", "timestamp"],
                "desc": "Índice para histórico de eventos por irrigador",
            },
        ]

        print(f"✅ Conectado ao banco de dados: {database}")

        success_count = 0
        for idx in indexes:
            try:
                url = f"{couchdb_url}/{database}/_index"
                payload = {
                    "index": {"fields": idx["fields"]},
                    "name": idx["name"],
                    "type": "json",
                }

                response = requests.post(url, json=payload)

                if response.status_code in [200, 201]:
                    print(f"✅ Índice criado: {idx['name']} - {idx['desc']}")
                    success_count += 1
                elif response.status_code == 400:
                    # Já existe
                    print(f"ℹ️  Índice já existe: {idx['name']}")
                    success_count += 1
                else:
                    print(f"⚠️  Erro ao criar índice {idx['name']}: {response.text}")

            except Exception as e:
                print(f"⚠️  Erro ao criar índice {idx['name']}: {str(e)}")

        print(
            f"\n✅ Setup de índices concluído! ({success_count}/{len(indexes)} índices)"
        )
        return True, f"Índices configurados ({success_count}/{len(indexes)})"

    except Exception as e:
        msg = f"❌ Erro ao criar índices: {str(e)}"
        print(msg)
        return False, msg


if __name__ == "__main__":
    import os

    couchdb_url = os.getenv("COUCHDB_URL", "http://admin:wyrd@localhost:5984")
    database = os.getenv("COUCHDB_DB", "lindsay-data")

    print(f"🔧 Configurando índices CouchDB...")
    print(f"   URL: {couchdb_url.split('@')[-1]}")
    print(f"   Database: {database}\n")

    success, msg = setup_indexes(couchdb_url, database)

    if success:
        print(f"\n✅ {msg}")
        exit(0)
    else:
        print(f"\n❌ {msg}")
        exit(1)
