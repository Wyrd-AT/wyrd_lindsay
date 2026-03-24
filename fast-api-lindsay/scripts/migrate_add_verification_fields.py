#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Migração: Adicionar campos de verificação e termos

Para usuários existentes no CouchDB:
- email_verified = True (já estão verificados por uso)
- terms_accepted = False (devem aceitar termos no próximo login)

Executar UMA vez antes de deploy:
    python scripts/migrate_add_verification_fields.py
"""

import os
import sys
import couchdb
from datetime import datetime

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def migrate(couchdb_url: str, database: str, dry_run: bool = True):
    """
    Migrar usuários existentes adicionando campos de verificação/termos

    Args:
        couchdb_url: URL do CouchDB
        database: Nome do banco de dados
        dry_run: Se True, apenas mostra o que seria feito sem alterar
    """
    print(f"{'[DRY RUN] ' if dry_run else ''}Conectando ao CouchDB...")
    server = couchdb.Server(couchdb_url)
    db = server[database]

    # Campos a serem adicionados
    new_fields = {
        "email_verified": True,  # Existentes = já verificados
        "email_verified_at": None,
        "terms_accepted": False,  # Devem aceitar no próximo login
        "terms_version": None,
        "terms_accepted_at": None,
        "terms_accepted_ip": None,
        "first_login_at": None,
        "last_login_at": None,
    }

    # Buscar todos os documentos de usuários (admin, revenda, cliente)
    updated = 0
    skipped = 0
    errors = 0

    for doc_type in ["admin", "revenda", "cliente"]:
        print(f"\nProcessando tipo: {doc_type}")

        try:
            result = db.find({
                "selector": {"type": doc_type},
                "limit": 10000,
            })
            docs = list(result)
            print(f"  Encontrados: {len(docs)} documentos")

            for doc in docs:
                doc_id = doc.get("_id", "?")
                email = doc.get("email", "?")

                # Verificar se já tem os campos
                has_fields = doc.get("email_verified") is not None

                if has_fields:
                    skipped += 1
                    continue

                # Adicionar campos
                for field, default_value in new_fields.items():
                    if field not in doc:
                        doc[field] = default_value

                # Admin: email sempre verificado
                if doc_type == "admin":
                    doc["email_verified"] = True
                    doc["email_verified_at"] = datetime.utcnow().isoformat()

                if dry_run:
                    print(f"  [DRY RUN] Atualizaria: {doc_id} ({email})")
                else:
                    try:
                        db.save(doc)
                        print(f"  Atualizado: {doc_id} ({email})")
                    except Exception as e:
                        print(f"  ERRO ao atualizar {doc_id}: {e}")
                        errors += 1
                        continue

                updated += 1

        except Exception as e:
            print(f"  ERRO ao buscar {doc_type}: {e}")
            errors += 1

    print(f"\n{'=' * 50}")
    print(f"{'[DRY RUN] ' if dry_run else ''}Migração concluída!")
    print(f"  Atualizados: {updated}")
    print(f"  Já migrados (pulados): {skipped}")
    print(f"  Erros: {errors}")

    if dry_run and updated > 0:
        print(f"\nPara executar de verdade, rode com --execute:")
        print(f"  python scripts/migrate_add_verification_fields.py --execute")


if __name__ == "__main__":
    couchdb_url = os.getenv("COUCHDB_URL", "https://admin:wyrd@db.vpn.ind.br")
    database = os.getenv("COUCHDB_USERS_DB", "lindsay-users")

    dry_run = "--execute" not in sys.argv

    print("=" * 50)
    print("Migração: Campos de Verificação & Termos de Uso")
    print("=" * 50)
    print(f"CouchDB: {couchdb_url.split('@')[-1]}")
    print(f"Database: {database}")
    print(f"Modo: {'DRY RUN (simulação)' if dry_run else 'EXECUÇÃO REAL'}")
    print("=" * 50)

    migrate(couchdb_url, database, dry_run)
