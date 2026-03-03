#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para copiar/exportar todos os dados dos irrigadores cadastrados

Este script:
1. Busca todos os irrigadores do CouchDB
2. Exporta em formato JSON
3. Opcionalmente exporta em CSV
4. Pode salvar em arquivo ou mostrar no console

Uso:
    python scripts/export_irrigadores.py                    # Mostrar no console
    python scripts/export_irrigadores.py --output irrigadores.json  # Salvar JSON
    python scripts/export_irrigadores.py --csv irrigadores.csv     # Salvar CSV
    python scripts/export_irrigadores.py --output irrigadores.json --csv irrigadores.csv  # Ambos
"""

import sys
import os
import json
import csv
from datetime import datetime
from typing import List, Dict, Optional

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


def get_all_irrigadores(db) -> List[Dict]:
    """
    Buscar todos os irrigadores do banco

    Args:
        db: Conexão com CouchDB

    Returns:
        Lista de documentos de irrigadores
    """
    irrigadores = []

    try:
        # Buscar por table="irrigadores"
        result = db.find({"selector": {"table": "irrigadores"}, "limit": 10000})
        irrigadores = list(result)

        # Se não encontrou, tentar por type="pivo"
        if not irrigadores:
            result = db.find({"selector": {"type": "pivo"}, "limit": 10000})
            irrigadores = list(result)

        return irrigadores

    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao buscar irrigadores: {e}{Colors.ENDC}")
        raise


def export_to_json(irrigadores: List[Dict], output_file: Optional[str] = None) -> str:
    """
    Exportar irrigadores para JSON

    Args:
        irrigadores: Lista de irrigadores
        output_file: Caminho do arquivo (None para retornar string)

    Returns:
        JSON string ou caminho do arquivo
    """
    export_data = {
        "export_date": datetime.now().isoformat(),
        "total": len(irrigadores),
        "irrigadores": irrigadores,
    }

    json_str = json.dumps(export_data, indent=2, ensure_ascii=False, default=str)

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(json_str)
        return output_file
    else:
        return json_str


def export_to_csv(irrigadores: List[Dict], output_file: str):
    """
    Exportar irrigadores para CSV

    Args:
        irrigadores: Lista de irrigadores
        output_file: Caminho do arquivo CSV
    """
    if not irrigadores:
        print(f"{Colors.WARNING}⚠️  Nenhum irrigador para exportar{Colors.ENDC}")
        return

    # Coletar todos os campos únicos
    all_fields = set()
    for irrigador in irrigadores:
        all_fields.update(irrigador.keys())

    # Ordenar campos (colocar os mais importantes primeiro)
    priority_fields = [
        "_id",
        "_rev",
        "codigo",
        "nome",
        "name",
        "table",
        "type",
        "owner_id",
        "gerente_id",
        "companyId",
        "ativo",
        "created_at",
        "updated_at",
    ]
    ordered_fields = []
    for field in priority_fields:
        if field in all_fields:
            ordered_fields.append(field)
            all_fields.remove(field)

    # Adicionar campos restantes
    ordered_fields.extend(sorted(all_fields))

    # Escrever CSV
    with open(output_file, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(
            csvfile, fieldnames=ordered_fields, extrasaction="ignore"
        )
        writer.writeheader()

        for irrigador in irrigadores:
            # Converter valores complexos para string
            row = {}
            for field in ordered_fields:
                value = irrigador.get(field)
                if isinstance(value, (dict, list)):
                    row[field] = json.dumps(value, ensure_ascii=False)
                elif value is None:
                    row[field] = ""
                else:
                    row[field] = str(value)
            writer.writerow(row)

    return output_file


def print_summary(irrigadores: List[Dict]):
    """Imprimir resumo dos irrigadores"""
    if not irrigadores:
        print(f"{Colors.WARNING}⚠️  Nenhum irrigador encontrado{Colors.ENDC}")
        return

    print(f"\n{Colors.BOLD}{Colors.OKGREEN}Resumo dos Irrigadores:{Colors.ENDC}\n")
    print(f"  {Colors.OKCYAN}Total:{Colors.ENDC} {len(irrigadores)}")

    # Estatísticas
    with_codigo = sum(1 for i in irrigadores if i.get("codigo"))
    with_nome = sum(1 for i in irrigadores if i.get("nome") or i.get("name"))
    with_owner = sum(1 for i in irrigadores if i.get("owner_id") or i.get("companyId"))
    with_gerente = sum(1 for i in irrigadores if i.get("gerente_id"))
    ativos = sum(1 for i in irrigadores if i.get("ativo", True))

    print(f"  {Colors.OKCYAN}Com código:{Colors.ENDC} {with_codigo}")
    print(f"  {Colors.OKCYAN}Com nome:{Colors.ENDC} {with_nome}")
    print(f"  {Colors.OKCYAN}Com owner_id:{Colors.ENDC} {with_owner}")
    print(f"  {Colors.OKCYAN}Com gerente_id:{Colors.ENDC} {with_gerente}")
    print(f"  {Colors.OKCYAN}Ativos:{Colors.ENDC} {ativos}")
    print(f"  {Colors.OKCYAN}Inativos:{Colors.ENDC} {len(irrigadores) - ativos}")

    # Mostrar alguns exemplos
    print(f"\n{Colors.BOLD}{Colors.OKCYAN}Primeiros 5 irrigadores:{Colors.ENDC}\n")
    for i, irrigador in enumerate(irrigadores[:5], 1):
        print(
            f"  {i}. {Colors.BOLD}{irrigador.get('codigo', 'Sem código')}{Colors.ENDC}"
        )
        print(f"     ID: {irrigador.get('_id', 'N/A')}")
        print(f"     Nome: {irrigador.get('nome') or irrigador.get('name') or 'N/A'}")
        print(
            f"     Owner: {irrigador.get('owner_id') or irrigador.get('companyId') or 'N/A'}"
        )
        print()


def main():
    """Função principal"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Exportar todos os dados dos irrigadores cadastrados",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python scripts/export_irrigadores.py                           # Mostrar no console
  python scripts/export_irrigadores.py --output irrigadores.json # Salvar JSON
  python scripts/export_irrigadores.py --csv irrigadores.csv      # Salvar CSV
  python scripts/export_irrigadores.py --output irrigadores.json --csv irrigadores.csv
        """,
    )

    parser.add_argument("--output", help="Arquivo JSON de saída")

    parser.add_argument("--csv", help="Arquivo CSV de saída")

    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Mostrar JSON formatado no console (se não usar --output)",
    )

    args = parser.parse_args()

    print_header("Exportar Dados dos Irrigadores")

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

    # Buscar irrigadores
    print(f"{Colors.OKCYAN}Buscando irrigadores...{Colors.ENDC}\n")

    try:
        irrigadores = get_all_irrigadores(db)
        print(
            f"{Colors.OKGREEN}✅ Encontrados {len(irrigadores)} irrigador(es){Colors.ENDC}\n"
        )
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao buscar irrigadores: {e}{Colors.ENDC}")
        sys.exit(1)

    if not irrigadores:
        print(f"{Colors.WARNING}⚠️  Nenhum irrigador encontrado{Colors.ENDC}")
        sys.exit(0)

    # Mostrar resumo
    print_summary(irrigadores)

    # Exportar JSON
    if args.output:
        try:
            output_path = export_to_json(irrigadores, args.output)
            print(f"{Colors.OKGREEN}✅ JSON exportado para: {output_path}{Colors.ENDC}")
            print(f"   Total de {len(irrigadores)} irrigador(es) exportado(s)")
        except Exception as e:
            print(f"{Colors.FAIL}❌ Erro ao exportar JSON: {e}{Colors.ENDC}")
    elif args.pretty:
        # Mostrar JSON formatado no console
        json_str = export_to_json(irrigadores)
        print(f"\n{Colors.BOLD}{Colors.OKCYAN}Dados em JSON:{Colors.ENDC}\n")
        print(json_str)
    else:
        # Mostrar apenas resumo
        print(
            f"\n{Colors.WARNING}💡 Use --output para salvar em arquivo JSON{Colors.ENDC}"
        )
        print(f"{Colors.WARNING}💡 Use --csv para salvar em arquivo CSV{Colors.ENDC}")
        print(
            f"{Colors.WARNING}💡 Use --pretty para ver JSON formatado no console{Colors.ENDC}"
        )

    # Exportar CSV
    if args.csv:
        try:
            export_to_csv(irrigadores, args.csv)
            print(f"{Colors.OKGREEN}✅ CSV exportado para: {args.csv}{Colors.ENDC}")
            print(f"   Total de {len(irrigadores)} irrigador(es) exportado(s)")
        except Exception as e:
            print(f"{Colors.FAIL}❌ Erro ao exportar CSV: {e}{Colors.ENDC}")

    # Resumo final
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}Exportação Concluída:{Colors.ENDC}")
    print(f"  {Colors.OKGREEN}Total de irrigadores:{Colors.ENDC} {len(irrigadores)}")
    if args.output:
        print(f"  {Colors.OKGREEN}JSON salvo em:{Colors.ENDC} {args.output}")
    if args.csv:
        print(f"  {Colors.OKGREEN}CSV salvo em:{Colors.ENDC} {args.csv}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}\n")


if __name__ == "__main__":
    main()
