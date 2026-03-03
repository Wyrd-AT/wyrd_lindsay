#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para listar todos os usuários cadastrados no sistema
(Admins, Gerentes/Revendas e Clientes)

Uso:
    python scripts/list_users.py
    python scripts/list_users.py --type admin
    python scripts/list_users.py --type revenda
    python scripts/list_users.py --type cliente
    python scripts/list_users.py --status pending
"""

import sys
import os
from datetime import datetime
from typing import List, Dict, Optional

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import couchdb
from app.core.config import settings


# =============================================================================
# Cores para terminal (ANSI)
# =============================================================================


class Colors:
    """Cores ANSI para terminal"""

    HEADER = "\033[95m"
    OKBLUE = "\033[94m"
    OKCYAN = "\033[96m"
    OKGREEN = "\033[92m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"


# =============================================================================
# Funções auxiliares
# =============================================================================


def format_date(date_str: Optional[str]) -> str:
    """Formatar data para exibição"""
    if not date_str:
        return "N/A"
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y %H:%M")
    except:
        return date_str


def print_header(text: str):
    """Imprimir cabeçalho formatado"""
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{text:^80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}\n")


def print_section(text: str):
    """Imprimir seção formatada"""
    print(f"\n{Colors.BOLD}{Colors.OKCYAN}{'─' * 80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.OKCYAN}{text}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.OKCYAN}{'─' * 80}{Colors.ENDC}\n")


def get_status_color(status: str) -> str:
    """Retornar cor baseada no status"""
    status_lower = status.lower()
    if status_lower == "active":
        return Colors.OKGREEN
    elif status_lower == "pending":
        return Colors.WARNING
    elif status_lower == "rejected":
        return Colors.FAIL
    else:
        return Colors.ENDC


# =============================================================================
# Funções de busca
# =============================================================================


def get_all_users(
    db, user_type: Optional[str] = None, status_filter: Optional[str] = None
) -> Dict[str, List[Dict]]:
    """
    Buscar todos os usuários do banco

    Args:
        db: Conexão com CouchDB
        user_type: Filtrar por tipo (admin, revenda, cliente)
        status_filter: Filtrar por status (active, pending, rejected)

    Returns:
        Dicionário com listas de usuários por tipo
    """
    users = {"admin": [], "revenda": [], "cliente": []}

    try:
        # Construir selector para query Mango
        selector = {}

        # Se especificou tipo, buscar apenas esse tipo
        if user_type:
            selector["type"] = user_type
        else:
            # Buscar todos os tipos de usuário
            selector["$or"] = [
                {"type": "admin"},
                {"type": "revenda"},
                {"type": "cliente"},
            ]

        # Adicionar filtro de status se especificado
        if status_filter:
            selector["status"] = status_filter.lower()

        # Executar query Mango
        results = db.find({"selector": selector, "limit": 10000})

        for doc in results:
            doc_type = doc.get("type", "")

            # Classificar por tipo
            if doc_type == "admin":
                users["admin"].append(doc)
            elif doc_type == "revenda":
                users["revenda"].append(doc)
            elif doc_type == "cliente":
                users["cliente"].append(doc)
            # Fallback: tentar inferir pelo _id se não tiver type
            elif "_id" in doc:
                doc_id = doc.get("_id", "")
                if doc_id.startswith("admin:"):
                    users["admin"].append(doc)
                elif doc_id.startswith("revenda:"):
                    users["revenda"].append(doc)
                elif doc_id.startswith("user:") or "email" in doc:
                    if "domain" in doc:
                        users["revenda"].append(doc)
                    else:
                        users["cliente"].append(doc)

        # Se não encontrou nada com query Mango, tentar _all_docs como fallback
        if sum(len(v) for v in users.values()) == 0:
            print(
                f"{Colors.WARNING}⚠️  Query Mango não retornou resultados, tentando _all_docs...{Colors.ENDC}"
            )
            all_docs = db.view("_all_docs", include_docs=True, limit=10000)

            for row in all_docs:
                doc = row.doc
                doc_type = doc.get("type", "")

                # Filtrar por tipo se especificado
                if user_type and doc_type != user_type:
                    continue

                # Filtrar por status se especificado
                if (
                    status_filter
                    and doc.get("status", "").lower() != status_filter.lower()
                ):
                    continue

                # Adicionar à lista apropriada
                if doc_type == "admin":
                    users["admin"].append(doc)
                elif doc_type == "revenda":
                    users["revenda"].append(doc)
                elif doc_type == "cliente":
                    users["cliente"].append(doc)
                # Tentar inferir pelo _id
                elif "_id" in doc:
                    doc_id = doc.get("_id", "")
                    if doc_id.startswith("admin:"):
                        users["admin"].append(doc)
                    elif doc_id.startswith("revenda:"):
                        users["revenda"].append(doc)
                    elif doc_id.startswith("user:") or "email" in doc:
                        if "domain" in doc:
                            users["revenda"].append(doc)
                        else:
                            users["cliente"].append(doc)

    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao buscar usuários: {e}{Colors.ENDC}")
        print(f"{Colors.WARNING}Tentando método alternativo...{Colors.ENDC}")

        # Fallback: usar _all_docs
        try:
            all_docs = db.view("_all_docs", include_docs=True, limit=10000)

            for row in all_docs:
                doc = row.doc
                doc_type = doc.get("type", "")

                if user_type and doc_type != user_type:
                    continue

                if (
                    status_filter
                    and doc.get("status", "").lower() != status_filter.lower()
                ):
                    continue

                if doc_type == "admin":
                    users["admin"].append(doc)
                elif doc_type == "revenda":
                    users["revenda"].append(doc)
                elif doc_type == "cliente":
                    users["cliente"].append(doc)
        except Exception as e2:
            print(f"{Colors.FAIL}❌ Erro no método alternativo: {e2}{Colors.ENDC}")
            raise

    return users


# =============================================================================
# Funções de exibição
# =============================================================================


def print_admins(admins: List[Dict]):
    """Exibir lista de admins"""
    if not admins:
        print(f"{Colors.WARNING}  Nenhum admin cadastrado{Colors.ENDC}")
        return

    print(f"{Colors.BOLD}{Colors.OKBLUE}Total: {len(admins)} admin(s){Colors.ENDC}\n")

    for i, admin in enumerate(admins, 1):
        email = admin.get("email", "N/A")
        name = admin.get("name", "N/A")
        status = admin.get("status", "N/A")
        created_at = format_date(admin.get("created_at"))
        created_by = admin.get("created_by", "N/A")
        doc_id = admin.get("_id", "N/A")

        status_color = get_status_color(status)

        print(f"{Colors.BOLD}{i}. {Colors.ENDC}{Colors.OKGREEN}{name}{Colors.ENDC}")
        print(f"   {Colors.OKCYAN}Email:{Colors.ENDC} {email}")
        print(
            f"   {Colors.OKCYAN}Status:{Colors.ENDC} {status_color}{status}{Colors.ENDC}"
        )
        print(f"   {Colors.OKCYAN}Criado em:{Colors.ENDC} {created_at}")
        print(f"   {Colors.OKCYAN}Criado por:{Colors.ENDC} {created_by}")
        print(f"   {Colors.OKCYAN}Doc ID:{Colors.ENDC} {doc_id}")
        print()


def print_revendas(revendas: List[Dict]):
    """Exibir lista de revendas/gerentes"""
    if not revendas:
        print(f"{Colors.WARNING}  Nenhuma revenda cadastrada{Colors.ENDC}")
        return

    print(
        f"{Colors.BOLD}{Colors.OKBLUE}Total: {len(revendas)} revenda(s){Colors.ENDC}\n"
    )

    for i, revenda in enumerate(revendas, 1):
        email = revenda.get("email", "N/A")
        name = revenda.get("name", "N/A")
        domain = revenda.get("domain", "N/A")
        status = revenda.get("status", "N/A")
        created_at = format_date(revenda.get("created_at"))
        approved_by = revenda.get("approved_by", "N/A")
        approved_at = format_date(revenda.get("approved_at"))
        clientes_count = len(revenda.get("clientes", []))
        doc_id = revenda.get("_id", "N/A")

        status_color = get_status_color(status)

        print(f"{Colors.BOLD}{i}. {Colors.ENDC}{Colors.OKGREEN}{name}{Colors.ENDC}")
        print(f"   {Colors.OKCYAN}Email:{Colors.ENDC} {email}")
        print(f"   {Colors.OKCYAN}Domínio:{Colors.ENDC} {domain}")
        print(
            f"   {Colors.OKCYAN}Status:{Colors.ENDC} {status_color}{status}{Colors.ENDC}"
        )
        print(f"   {Colors.OKCYAN}Clientes:{Colors.ENDC} {clientes_count}")
        print(f"   {Colors.OKCYAN}Criado em:{Colors.ENDC} {created_at}")
        if approved_by != "N/A":
            print(f"   {Colors.OKCYAN}Aprovado por:{Colors.ENDC} {approved_by}")
            print(f"   {Colors.OKCYAN}Aprovado em:{Colors.ENDC} {approved_at}")
        print(f"   {Colors.OKCYAN}Doc ID:{Colors.ENDC} {doc_id}")
        print()


def print_clientes(clientes: List[Dict]):
    """Exibir lista de clientes"""
    if not clientes:
        print(f"{Colors.WARNING}  Nenhum cliente cadastrado{Colors.ENDC}")
        return

    print(
        f"{Colors.BOLD}{Colors.OKBLUE}Total: {len(clientes)} cliente(s){Colors.ENDC}\n"
    )

    for i, cliente in enumerate(clientes, 1):
        email = cliente.get("email", "N/A")
        name = cliente.get("name", "N/A")
        revenda_id = cliente.get("revenda_id", "N/A")
        status = cliente.get("status", "N/A")
        created_at = format_date(cliente.get("created_at"))
        approved_by = cliente.get("approved_by", "N/A")
        approved_at = format_date(cliente.get("approved_at"))
        doc_id = cliente.get("_id", "N/A")

        status_color = get_status_color(status)

        print(f"{Colors.BOLD}{i}. {Colors.ENDC}{Colors.OKGREEN}{name}{Colors.ENDC}")
        print(f"   {Colors.OKCYAN}Email:{Colors.ENDC} {email}")
        print(f"   {Colors.OKCYAN}Revenda:{Colors.ENDC} {revenda_id}")
        print(
            f"   {Colors.OKCYAN}Status:{Colors.ENDC} {status_color}{status}{Colors.ENDC}"
        )
        print(f"   {Colors.OKCYAN}Criado em:{Colors.ENDC} {created_at}")
        if approved_by != "N/A":
            print(f"   {Colors.OKCYAN}Aprovado por:{Colors.ENDC} {approved_by}")
            print(f"   {Colors.OKCYAN}Aprovado em:{Colors.ENDC} {approved_at}")
        print(f"   {Colors.OKCYAN}Doc ID:{Colors.ENDC} {doc_id}")
        print()


# =============================================================================
# Main
# =============================================================================


def main():
    """Função principal"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Listar usuários cadastrados no sistema Lindsay",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python scripts/list_users.py                    # Listar todos
  python scripts/list_users.py --type admin        # Apenas admins
  python scripts/list_users.py --type revenda     # Apenas revendas
  python scripts/list_users.py --type cliente      # Apenas clientes
  python scripts/list_users.py --status pending   # Apenas pendentes
  python scripts/list_users.py --status active    # Apenas ativos
        """,
    )

    parser.add_argument(
        "--type",
        choices=["admin", "revenda", "cliente"],
        help="Filtrar por tipo de usuário",
    )

    parser.add_argument(
        "--status", choices=["active", "pending", "rejected"], help="Filtrar por status"
    )

    args = parser.parse_args()

    # Conectar ao CouchDB
    print(f"{Colors.OKCYAN}Conectando ao CouchDB...{Colors.ENDC}")
    print(f"{Colors.OKCYAN}URL: {settings.COUCHDB_URL}{Colors.ENDC}")
    print(f"{Colors.OKCYAN}Database: {settings.COUCHDB_DB}{Colors.ENDC}\n")

    try:
        server = couchdb.Server(settings.COUCHDB_URL)
        db = server[settings.COUCHDB_DB]
        print(f"{Colors.OKGREEN}✅ Conectado com sucesso!{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao conectar ao CouchDB: {e}{Colors.ENDC}")
        sys.exit(1)

    # Buscar usuários
    print(f"{Colors.OKCYAN}Buscando usuários...{Colors.ENDC}\n")

    try:
        users = get_all_users(db, args.type, args.status)
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao buscar usuários: {e}{Colors.ENDC}")
        sys.exit(1)

    # Exibir resultados
    total = len(users["admin"]) + len(users["revenda"]) + len(users["cliente"])

    if total == 0:
        print(
            f"{Colors.WARNING}⚠️  Nenhum usuário encontrado com os filtros especificados.{Colors.ENDC}"
        )
        sys.exit(0)

    # Cabeçalho
    title = "Usuários Cadastrados"
    if args.type:
        title += f" - {args.type.capitalize()}"
    if args.status:
        title += f" ({args.status})"

    print_header(title)

    # Exibir por tipo
    if not args.type or args.type == "admin":
        print_section("👑 ADMINS")
        print_admins(users["admin"])

    if not args.type or args.type == "revenda":
        print_section("🏢 REVENDAS / GERENTES")
        print_revendas(users["revenda"])

    if not args.type or args.type == "cliente":
        print_section("👤 CLIENTES")
        print_clientes(users["cliente"])

    # Resumo
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}Resumo:{Colors.ENDC}")
    print(f"  {Colors.OKGREEN}Admins:{Colors.ENDC} {len(users['admin'])}")
    print(f"  {Colors.OKGREEN}Revendas:{Colors.ENDC} {len(users['revenda'])}")
    print(f"  {Colors.OKGREEN}Clientes:{Colors.ENDC} {len(users['cliente'])}")
    print(f"  {Colors.BOLD}Total:{Colors.ENDC} {total}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'=' * 80}{Colors.ENDC}\n")


if __name__ == "__main__":
    main()
