#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para criar o admin diretamente no CouchDB

Este script cria o documento do admin no CouchDB baseado nos dados do Cognito.

Uso:
    python scripts/create_admin_couchdb.py
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import couchdb
from app.core.config import settings

# =============================================================================
# Cores
# =============================================================================

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{text:^80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}\n")


def main():
    print_header("Criar Admin no CouchDB")
    
    # Dados do admin (baseado no Cognito)
    admin_email = "admin@company.com"
    admin_name = "Admin User"
    admin_doc_id = "admin:admin@company.com"
    
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
    
    # Verificar se já existe
    print(f"{Colors.OKCYAN}Verificando se admin já existe...{Colors.ENDC}")
    try:
        existing = db[admin_doc_id]
        print(f"{Colors.WARNING}⚠️  Admin já existe: {admin_doc_id}{Colors.ENDC}")
        print(f"   Type: {existing.get('type')}")
        print(f"   Status: {existing.get('status')}")
        print(f"   Name: {existing.get('name')}")
        
        response = input(f"\n{Colors.WARNING}Deseja atualizar? (s/N): {Colors.ENDC}")
        if response.lower() != 's':
            print(f"{Colors.OKBLUE}Operação cancelada{Colors.ENDC}")
            sys.exit(0)
        
        # Atualizar documento existente
        existing.update({
            "email": admin_email,
            "name": admin_name,
            "type": "admin",
            "status": "active",
            "updated_at": datetime.now().isoformat()
        })
        db.save(existing)
        print(f"{Colors.OKGREEN}✅ Admin atualizado com sucesso!{Colors.ENDC}\n")
        sys.exit(0)
        
    except couchdb.http.ResourceNotFound:
        print(f"{Colors.OKCYAN}Admin não existe, criando...{Colors.ENDC}\n")
    
    # Criar documento do admin
    admin_doc = {
        "_id": admin_doc_id,
        "type": "admin",
        "email": admin_email,
        "name": admin_name,
        "status": "active",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "created_by": "system"
    }
    
    try:
        db.save(admin_doc)
        print(f"{Colors.OKGREEN}✅ Admin criado com sucesso!{Colors.ENDC}")
        print(f"   Doc ID: {admin_doc_id}")
        print(f"   Email: {admin_email}")
        print(f"   Name: {admin_name}")
        print(f"   Type: admin")
        print(f"   Status: active\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao criar admin: {e}{Colors.ENDC}")
        sys.exit(1)
    
    # Verificar se foi criado
    try:
        created = db[admin_doc_id]
        print(f"{Colors.OKGREEN}✅ Verificação: Admin encontrado no banco!{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao verificar: {e}{Colors.ENDC}")
        sys.exit(1)
    
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}Admin Criado com Sucesso!{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}\n")
    
    print(f"{Colors.OKCYAN}Próximos passos:{Colors.ENDC}")
    print(f"  1. Faça logout e login novamente no frontend")
    print(f"  2. O token será gerado automaticamente")
    print(f"  3. Você deve conseguir ver os pivôs agora\n")


if __name__ == "__main__":
    main()
