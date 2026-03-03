#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para garantir que o admin tenha status "active" no CouchDB

Uso:
    python scripts/fix_admin_status.py
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import couchdb
from app.core.config import settings


class Colors:
    OKGREEN = "\033[92m"
    OKCYAN = "\033[96m"
    WARNING = "\033[93m"
    FAIL = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"


def main():
    admin_email = "admin@company.com"
    admin_doc_id = "admin:admin@company.com"

    print(f"{Colors.OKCYAN}Conectando ao CouchDB...{Colors.ENDC}")
    try:
        server = couchdb.Server(settings.COUCHDB_URL)
        db = server[settings.COUCHDB_DB]
        print(f"{Colors.OKGREEN}✅ Conectado!{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro: {e}{Colors.ENDC}")
        sys.exit(1)

    # Buscar admin
    try:
        admin_doc = db[admin_doc_id]
        print(f"{Colors.OKCYAN}Admin encontrado:{Colors.ENDC}")
        print(f"   Status atual: {admin_doc.get('status')}")

        if admin_doc.get("status") != "active":
            admin_doc["status"] = "active"
            admin_doc["updated_at"] = datetime.now().isoformat()
            db.save(admin_doc)
            print(f"{Colors.OKGREEN}✅ Status atualizado para 'active'!{Colors.ENDC}\n")
        else:
            print(f"{Colors.OKGREEN}✅ Status já está 'active'!{Colors.ENDC}\n")
    except couchdb.http.ResourceNotFound:
        print(
            f"{Colors.WARNING}⚠️  Admin não encontrado. Execute create_admin_couchdb.py primeiro{Colors.ENDC}\n"
        )
        sys.exit(1)
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro: {e}{Colors.ENDC}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
