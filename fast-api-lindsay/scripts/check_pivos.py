#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar e diagnosticar problemas com pivôs no CouchDB

Este script:
1. Lista todos os pivôs no banco
2. Verifica se há índices necessários
3. Testa queries de busca
4. Mostra estatísticas

Uso:
    python scripts/check_pivos.py
    python scripts/check_pivos.py --create-index  # Criar índice se necessário
"""

import sys
import os
from typing import List, Dict

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import couchdb
from app.core.config import settings

# =============================================================================
# Cores
# =============================================================================


class Colors:
    HEADER = "\033[95m"
    OKBLUE = "\033[94m"
    OKCYAN = "\033[96m"
    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{text:^80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}\n")


def find_all_pivos(db) -> List[Dict]:
    """Buscar todos os pivôs usando diferentes métodos"""
    pivos = []

    print(f"{Colors.OKCYAN}Buscando pivôs...{Colors.ENDC}\n")

    # Método 1: Query Mango por "table": "irrigadores"
    try:
        print(
            f"{Colors.OKCYAN}1. Tentando query Mango (table='irrigadores')...{Colors.ENDC}"
        )
        result = db.find({"selector": {"table": "irrigadores"}})
        pivos_mango = list(result)
        print(
            f"{Colors.OKGREEN}   ✅ Encontrados {len(pivos_mango)} pivô(s) com query Mango (table){Colors.ENDC}"
        )
        pivos.extend(pivos_mango)
    except Exception as e:
        print(f"{Colors.WARNING}   ⚠️  Erro na query Mango (table): {e}{Colors.ENDC}")

    # Método 1b: Query Mango por "type": "pivo" (compatibilidade)
    try:
        print(f"{Colors.OKCYAN}1b. Tentando query Mango (type='pivo')...{Colors.ENDC}")
        result = db.find({"selector": {"type": "pivo"}})
        pivos_mango_type = list(result)
        print(
            f"{Colors.OKGREEN}   ✅ Encontrados {len(pivos_mango_type)} pivô(s) com query Mango (type){Colors.ENDC}"
        )
        # Adicionar apenas os que não estão na lista
        existing_ids = {p.get("_id") for p in pivos}
        for p in pivos_mango_type:
            if p.get("_id") not in existing_ids:
                pivos.append(p)
    except Exception as e:
        print(f"{Colors.WARNING}   ⚠️  Erro na query Mango (type): {e}{Colors.ENDC}")
        print(
            f"{Colors.WARNING}   Isso pode indicar que precisa criar um índice{Colors.ENDC}"
        )

    # Método 2: Buscar por _id que começa com "pivo:" ou documentos com table="irrigadores"
    try:
        print(
            f"\n{Colors.OKCYAN}2. Buscando por _id começando com 'pivo:' ou table='irrigadores'...{Colors.ENDC}"
        )
        all_docs = db.view(
            "_all_docs", startkey="pivo:", endkey="pivo:\ufff0", include_docs=True
        )
        pivos_by_id = [
            row.doc
            for row in all_docs
            if row.doc
            and (row.doc.get("table") == "irrigadores" or row.doc.get("type") == "pivo")
        ]
        print(
            f"{Colors.OKGREEN}   ✅ Encontrados {len(pivos_by_id)} pivô(s) por _id{Colors.ENDC}"
        )

        # Adicionar apenas os que não estão na lista
        existing_ids = {p.get("_id") for p in pivos}
        for p in pivos_by_id:
            if p.get("_id") not in existing_ids:
                pivos.append(p)
    except Exception as e:
        print(f"{Colors.WARNING}   ⚠️  Erro ao buscar por _id: {e}{Colors.ENDC}")

    # Método 3: Buscar todos os documentos e filtrar
    try:
        print(
            f"\n{Colors.OKCYAN}3. Buscando todos os documentos e filtrando...{Colors.ENDC}"
        )
        all_docs = db.view("_all_docs", include_docs=True, limit=1000)
        pivos_all = [
            row.doc
            for row in all_docs
            if row.doc
            and (row.doc.get("table") == "irrigadores" or row.doc.get("type") == "pivo")
        ]
        print(
            f"{Colors.OKGREEN}   ✅ Encontrados {len(pivos_all)} pivô(s) no total{Colors.ENDC}"
        )

        # Adicionar apenas os que não estão na lista
        existing_ids = {p.get("_id") for p in pivos}
        for p in pivos_all:
            if p.get("_id") not in existing_ids:
                pivos.append(p)
    except Exception as e:
        print(f"{Colors.WARNING}   ⚠️  Erro ao buscar todos: {e}{Colors.ENDC}")

    return pivos


def create_index_if_needed(db, create_index: bool = False):
    """Criar índice Mango se necessário"""
    print(f"\n{Colors.OKCYAN}Verificando índices...{Colors.ENDC}\n")

    try:
        # Verificar índices existentes
        indexes = db.list_indexes()
        print(f"{Colors.OKGREEN}Índices existentes:{Colors.ENDC}")
        for idx in indexes:
            print(f"  - {idx.get('name', 'sem nome')}: {idx.get('fields', [])}")

        # Verificar se existe índice para "type"
        has_type_index = any("type" in idx.get("fields", []) for idx in indexes)

        if not has_type_index:
            print(
                f"\n{Colors.WARNING}⚠️  Não há índice para o campo 'type'{Colors.ENDC}"
            )
            print(
                f"{Colors.WARNING}   Isso pode causar problemas na busca de pivôs{Colors.ENDC}"
            )

            if create_index:
                print(f"\n{Colors.OKCYAN}Criando índice para 'type'...{Colors.ENDC}")
                try:
                    result = db.create_index(["type"])
                    print(f"{Colors.OKGREEN}✅ Índice criado com sucesso!{Colors.ENDC}")
                    print(f"   {result}")
                except Exception as e:
                    print(f"{Colors.FAIL}❌ Erro ao criar índice: {e}{Colors.ENDC}")
            else:
                print(
                    f"\n{Colors.WARNING}Execute com --create-index para criar o índice automaticamente{Colors.ENDC}"
                )
        else:
            print(f"\n{Colors.OKGREEN}✅ Índice para 'type' já existe{Colors.ENDC}")

    except Exception as e:
        print(f"{Colors.WARNING}⚠️  Erro ao verificar índices: {e}{Colors.ENDC}")


def print_pivos(pivos: List[Dict]):
    """Exibir lista de pivôs"""
    if not pivos:
        print(
            f"{Colors.WARNING}⚠️  Nenhum pivô encontrado no banco de dados{Colors.ENDC}"
        )
        print(f"\n{Colors.OKCYAN}Possíveis causas:{Colors.ENDC}")
        print(f"  1. Não há pivôs cadastrados ainda")
        print(f"  2. Os pivôs não têm campo 'type' = 'pivo'")
        print(f"  3. Os pivôs estão com _id diferente de 'pivo:*'")
        return

    print(
        f"\n{Colors.BOLD}{Colors.OKGREEN}Total de {len(pivos)} pivô(s) encontrado(s):{Colors.ENDC}\n"
    )

    for i, pivo in enumerate(pivos, 1):
        print(f"{Colors.BOLD}{i}. {pivo.get('nome', 'Sem nome')}{Colors.ENDC}")
        print(f"   {Colors.OKCYAN}ID:{Colors.ENDC} {pivo.get('_id', 'N/A')}")
        print(f"   {Colors.OKCYAN}Código:{Colors.ENDC} {pivo.get('codigo', 'N/A')}")
        print(f"   {Colors.OKCYAN}Owner:{Colors.ENDC} {pivo.get('owner_id', 'N/A')}")
        print(
            f"   {Colors.OKCYAN}Gerente:{Colors.ENDC} {pivo.get('gerente_id', 'N/A')}"
        )
        print(f"   {Colors.OKCYAN}Ativo:{Colors.ENDC} {pivo.get('ativo', 'N/A')}")
        print(f"   {Colors.OKCYAN}Type:{Colors.ENDC} {pivo.get('type', 'N/A')}")
        print()


def analyze_pivos(pivos: List[Dict]):
    """Analisar estrutura dos pivôs"""
    if not pivos:
        return

    print(f"\n{Colors.BOLD}{Colors.HEADER}Análise dos Pivôs:{Colors.ENDC}\n")

    # Estatísticas
    total = len(pivos)
    ativos = sum(1 for p in pivos if p.get("ativo"))
    inativos = total - ativos

    print(f"  {Colors.OKGREEN}Total:{Colors.ENDC} {total}")
    print(f"  {Colors.OKGREEN}Ativos:{Colors.ENDC} {ativos}")
    print(f"  {Colors.WARNING}Inativos:{Colors.ENDC} {inativos}")

    # Verificar campos obrigatórios
    print(f"\n{Colors.OKCYAN}Verificando estrutura:{Colors.ENDC}")
    required_fields = ["_id", "nome", "codigo", "owner_id", "gerente_id"]

    for field in required_fields:
        missing = sum(1 for p in pivos if field not in p)
        if missing > 0:
            print(
                f"  {Colors.WARNING}⚠️  Campo '{field}' faltando em {missing} pivô(s){Colors.ENDC}"
            )
        else:
            print(
                f"  {Colors.OKGREEN}✅ Campo '{field}' presente em todos{Colors.ENDC}"
            )

    # Verificar campos de identificação (table/type)
    has_table = sum(1 for p in pivos if p.get("table") == "irrigadores")
    has_type = sum(1 for p in pivos if p.get("type") == "pivo")

    print(f"\n{Colors.OKCYAN}Campos de identificação:{Colors.ENDC}")
    print(f"  - table='irrigadores': {has_table}/{total}")
    print(f"  - type='pivo': {has_type}/{total}")

    # Verificar tipos/tables
    tables = {}
    types = {}
    for p in pivos:
        p_table = p.get("table", "sem table")
        p_type = p.get("type", "sem type")
        tables[p_table] = tables.get(p_table, 0) + 1
        types[p_type] = types.get(p_type, 0) + 1

    print(f"\n{Colors.OKCYAN}Valores de 'table' encontrados:{Colors.ENDC}")
    for table, count in tables.items():
        print(f"  - {table}: {count}")

    print(f"\n{Colors.OKCYAN}Valores de 'type' encontrados:{Colors.ENDC}")
    for p_type, count in types.items():
        print(f"  - {p_type}: {count}")


def main():
    """Função principal"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Verificar e diagnosticar pivôs no CouchDB"
    )

    parser.add_argument(
        "--create-index", action="store_true", help="Criar índice Mango se necessário"
    )

    args = parser.parse_args()

    print_header("Diagnóstico de Pivôs no CouchDB")

    # Conectar ao CouchDB
    print(f"{Colors.OKCYAN}Conectando ao CouchDB...{Colors.ENDC}")
    print(f"{Colors.OKCYAN}URL: {settings.COUCHDB_URL}{Colors.ENDC}")
    print(f"{Colors.OKCYAN}Database: {settings.COUCHDB_DB}{Colors.ENDC}\n")

    try:
        server = couchdb.Server(settings.COUCHDB_URL)
        db = server[settings.COUCHDB_DB]
        print(f"{Colors.OKGREEN}✅ Conectado com sucesso!{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao conectar: {e}{Colors.ENDC}")
        sys.exit(1)

    # Verificar/criar índice
    create_index_if_needed(db, args.create_index)

    # Buscar pivôs
    pivos = find_all_pivos(db)

    # Exibir resultados
    print_pivos(pivos)

    # Análise
    if pivos:
        analyze_pivos(pivos)

    # Resumo
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}")
    if pivos:
        print(f"{Colors.OKGREEN}✅ {len(pivos)} pivô(s) encontrado(s){Colors.ENDC}")
    else:
        print(f"{Colors.WARNING}⚠️  Nenhum pivô encontrado{Colors.ENDC}")
        print(f"\n{Colors.OKCYAN}Para criar um pivô de teste, use:{Colors.ENDC}")
        print(f"  curl -X POST http://localhost:8000/api/pivos \\")
        print(f"    -H 'Authorization: Bearer <token>' \\")
        print(f"    -H 'Content-Type: application/json' \\")
        print(f'    -d \'{{"codigo": "PIVO001", "nome": "Pivô Teste"}}\'')
        print(
            f"\n{Colors.OKCYAN}Nota: Os pivôs devem ter campo 'table': 'irrigadores' para serem encontrados{Colors.ENDC}"
        )
    print(f"{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}\n")


if __name__ == "__main__":
    main()
