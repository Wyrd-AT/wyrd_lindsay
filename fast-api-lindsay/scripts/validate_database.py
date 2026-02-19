#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Validação do Banco CouchDB
====================================

Verifica se o banco está pronto para a nova API FastAPI.
Mostra documentos existentes e valida a estrutura.

Uso:
    python scripts/validate_database.py
    python scripts/validate_database.py --fix  (cria documentos faltando)
"""

import couchdb
import argparse
import json
from datetime import datetime
from zoneinfo import ZoneInfo

BR_TZ = ZoneInfo("America/Sao_Paulo")


class DatabaseValidator:
    def __init__(self, couchdb_url, db_name):
        self.url = couchdb_url
        self.db_name = db_name
        try:
            self.server = couchdb.Server(couchdb_url)
            self.db = self.server[db_name]
            self.is_connected = True
            print(f"✅ Conectado ao CouchDB: {couchdb_url}")
            print(f"📦 Banco de dados: {db_name}\n")
        except Exception as e:
            self.is_connected = False
            print(f"❌ Erro ao conectar: {e}")

    def count_by_table(self):
        """Contar documentos por table"""
        print("📊 DOCUMENTOS POR TIPO (table):")
        print("-" * 60)

        try:
            selector = {}
            results = self.db.find(selector)
            documents = results if results else []

            # Contar por table
            tables = {}
            for doc in documents:
                table = doc.get("table", "undefined")
                tables[table] = tables.get(table, 0) + 1

            # Exibir
            total = sum(tables.values())
            for table in sorted(tables.keys()):
                count = tables[table]
                pct = (count / total * 100) if total > 0 else 0
                print(f"  {table:<20} : {count:>6} documentos ({pct:>5.1f}%)")

            print(f"  {'-' * 50}")
            print(f"  {'TOTAL':<20} : {total:>6} documentos")
            print()
            return tables

        except Exception as e:
            print(f"❌ Erro ao contar documentos: {e}\n")
            return {}

    def check_collections(self):
        """Verificar coleções esperadas"""
        print("🔍 VALIDAÇÃO DE COLEÇÕES:")
        print("-" * 60)

        expected_collections = [
            "admin",
            "revenda",
            "cliente",
            "pivo",
            "event",
            "tensao",
            "sw",
            "command",
            "device_token",
            "notification_log",
        ]

        table_counts = {}
        try:
            selector = {}
            results = self.db.find(selector)
            documents = results if results else []

            for doc in documents:
                table = doc.get("table")
                if table:
                    table_counts[table] = table_counts.get(table, 0) + 1
        except Exception as e:
            print(f"⚠️ Erro ao verificar coleções: {e}\n")
            return

        print("\nEsperadas vs Encontradas:")
        for collection in expected_collections:
            count = table_counts.get(collection, 0)
            status = "✅" if count > 0 else "⚠️"
            print(f"  {status} {collection:<20} : {count:>4} documentos")

        # Coleções extras
        extras = set(table_counts.keys()) - set(expected_collections)
        if extras:
            print("\nColeções extras encontradas:")
            for extra in extras:
                count = table_counts[extra]
                print(f"  ℹ️  {extra:<20} : {count:>4} documentos")

        print()

    def check_design_docs(self):
        """Verificar design documents"""
        print("🏗️ DESIGN DOCUMENTS:")
        print("-" * 60)

        design_docs = [
            ("_design/revendas", ["by_status", "by_domain"]),
            ("_design/pivos", ["by_owner", "by_gerente", "all"]),
        ]

        for doc_id, views in design_docs:
            try:
                doc = self.db.get(doc_id)
                print(f"✅ {doc_id} encontrado")
                doc_views = doc.get("views", {})
                for view in views:
                    status = "  ✅" if view in doc_views else "  ❌"
                    print(f"{status} View '{view}'")
            except couchdb.http.ResourceNotFound:
                print(f"❌ {doc_id} NÃO encontrado")
                for view in views:
                    print(f"  ❌ View '{view}'")

        print()

    def check_indexes(self):
        """Verificar índices Mango"""
        print("📇 ÍNDICES MANGO:")
        print("-" * 60)

        expected_indexes = [
            "idx_table_status",
            "idx_table_irrigador",
            "idx_table_owner",
            "idx_table_gerente",
            "idx_table_timestamp",
        ]

        try:
            import requests

            response = requests.get(f"{self.url}/{self.db_name}/_index")
            indexes = response.json().get("indexes", [])
            index_names = [idx.get("name") for idx in indexes if "name" in idx]

            for idx_name in expected_indexes:
                status = "✅" if idx_name in index_names else "❌"
                print(f"  {status} {idx_name}")

            print()
        except Exception as e:
            print(f"⚠️ Erro ao verificar índices: {e}\n")

    def show_sample_docs(self, limit=3):
        """Mostar amostra de documentos"""
        print("📄 AMOSTRA DE DOCUMENTOS:")
        print("-" * 60)

        try:
            selector = {}
            results = self.db.find(selector, limit=limit)
            documents = results if results else []

            for i, doc in enumerate(documents, 1):
                doc_id = doc.get("_id", "N/A")
                table = doc.get("table", "N/A")
                print(f"\n{i}. ID: {doc_id}")
                print(f"   Table: {table}")

                # Mostrar alguns campos relevantes
                if table == "admin":
                    print(f"   Email: {doc.get('email')}")
                    print(f"   Status: {doc.get('status')}")
                elif table == "revenda":
                    print(f"   Domain: {doc.get('domain')}")
                    print(f"   Email: {doc.get('email')}")
                elif table == "pivo":
                    print(f"   Código: {doc.get('codigo')}")
                    print(f"   Owner: {doc.get('owner_id')}")
                elif table == "event":
                    print(f"   Irrigador: {doc.get('irrigadorId')}")
                    print(f"   Status: {doc.get('status')}")

            print()

        except Exception as e:
            print(f"⚠️ Erro ao mostrar documentos: {e}\n")

    def run_validation(self, show_samples=True):
        """Executar validação completa"""
        if not self.is_connected:
            print("❌ Não conectado ao banco de dados\n")
            return False

        print("=" * 60)
        print("🔍 VALIDAÇÃO DO BANCO DE DADOS COUCHDB")
        print("=" * 60)
        print()

        self.count_by_table()
        self.check_collections()
        self.check_design_docs()
        self.check_indexes()

        if show_samples:
            self.show_sample_docs()

        print("=" * 60)
        print("✅ Validação completa!")
        print("=" * 60)
        return True


def main():
    parser = argparse.ArgumentParser(description="Validar banco de dados CouchDB")
    parser.add_argument(
        "--url",
        default="https://admin:wyrd@db.vpn.ind.br",
        help="URL do CouchDB (default: https://admin:wyrd@db.vpn.ind.br)",
    )
    parser.add_argument(
        "--db",
        default="lindsay-data",
        help="Nome do banco (default: lindsay-data)",
    )
    parser.add_argument(
        "--no-samples",
        action="store_true",
        help="Não mostrar amostra de documentos",
    )

    args = parser.parse_args()

    validator = DatabaseValidator(args.url, args.db)
    validator.run_validation(show_samples=not args.no_samples)


if __name__ == "__main__":
    main()
