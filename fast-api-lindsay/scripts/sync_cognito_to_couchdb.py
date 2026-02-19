#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para sincronizar usuários do AWS Cognito para o CouchDB

Este script:
1. Lista todos os usuários do Cognito
2. Verifica quais já existem no CouchDB
3. Cria/atualiza usuários no CouchDB com a estrutura correta

Uso:
    python scripts/sync_cognito_to_couchdb.py
    python scripts/sync_cognito_to_couchdb.py --dry-run  # Apenas visualizar
    python scripts/sync_cognito_to_couchdb.py --type admin  # Apenas admins
"""

import sys
import os
import boto3
from datetime import datetime
from typing import List, Dict, Optional
import argparse

# Adicionar o diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import couchdb
from app.core.config import settings

# =============================================================================
# Configuração Cognito
# =============================================================================

# Configurar essas variáveis ou usar variáveis de ambiente
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "sa-east-1_plnyzL41t")
COGNITO_REGION = os.getenv("COGNITO_REGION", "sa-east-1")

# =============================================================================
# Cores para terminal
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


# =============================================================================
# Funções auxiliares
# =============================================================================

def print_header(text: str):
    """Imprimir cabeçalho formatado"""
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{text:^80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}\n")


def get_cognito_users(cognito_client, user_pool_id: str, user_type_filter: Optional[str] = None) -> List[Dict]:
    """
    Listar todos os usuários do Cognito
    
    Args:
        cognito_client: Cliente boto3 do Cognito
        user_pool_id: ID do User Pool
        user_type_filter: Filtrar por tipo (admin, revenda, cliente)
    
    Returns:
        Lista de usuários com seus atributos
    """
    users = []
    pagination_token = None
    
    print(f"{Colors.OKCYAN}Buscando usuários do Cognito...{Colors.ENDC}")
    
    try:
        while True:
            kwargs = {
                'UserPoolId': user_pool_id,
                'Limit': 60  # Máximo permitido
            }
            
            if pagination_token:
                kwargs['PaginationToken'] = pagination_token
            
            response = cognito_client.list_users(**kwargs)
            
            for user in response.get('Users', []):
                # Extrair atributos
                attributes = {}
                for attr in user.get('UserAttributes', []):
                    attributes[attr['Name']] = attr['Value']
                
                # Obter tipo do usuário (pode estar em custom:type ou inferir)
                user_type = attributes.get('custom:type', '')
                
                # Se não tiver custom:type, tentar inferir
                if not user_type:
                    # Verificar se tem domain (revenda) ou revenda_id (cliente)
                    if attributes.get('custom:domain'):
                        user_type = 'revenda'
                    elif attributes.get('custom:revenda_id'):
                        user_type = 'cliente'
                    else:
                        # Padrão: assumir admin se não tiver outros atributos
                        user_type = 'admin'
                
                # Filtrar por tipo se especificado
                if user_type_filter and user_type != user_type_filter:
                    continue
                
                user_data = {
                    'username': user.get('Username'),
                    'email': attributes.get('email', user.get('Username')),
                    'name': attributes.get('name', attributes.get('email', 'Sem nome')),
                    'type': user_type,
                    'status': attributes.get('custom:status', 'active'),
                    'domain': attributes.get('custom:domain', ''),
                    'revenda_id': attributes.get('custom:revenda_id', ''),
                    'doc_id': attributes.get('custom:doc_id', ''),
                    'enabled': user.get('Enabled', True),
                    'user_status': user.get('UserStatus', ''),
                    'created_at': user.get('UserCreateDate', datetime.now()).isoformat() if hasattr(user.get('UserCreateDate', datetime.now()), 'isoformat') else str(user.get('UserCreateDate', datetime.now())),
                    'cognito_attributes': attributes
                }
                
                users.append(user_data)
            
            # Verificar se há mais páginas
            pagination_token = response.get('PaginationToken')
            if not pagination_token:
                break
            
            print(f"{Colors.OKCYAN}  Processados {len(users)} usuários...{Colors.ENDC}")
        
        print(f"{Colors.OKGREEN}✅ Total de {len(users)} usuário(s) encontrado(s) no Cognito{Colors.ENDC}\n")
        return users
    
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao buscar usuários do Cognito: {e}{Colors.ENDC}")
        raise


def create_couchdb_doc(user: Dict) -> Dict:
    """
    Criar documento do CouchDB a partir dos dados do Cognito
    
    Args:
        user: Dados do usuário do Cognito
    
    Returns:
        Documento formatado para CouchDB
    """
    email = user['email']
    user_type = user['type']
    
    # Gerar _id se não tiver doc_id
    if user['doc_id']:
        doc_id = user['doc_id']
    else:
        if user_type == 'admin':
            doc_id = f"admin:{email}"
        elif user_type == 'revenda':
            domain = user['domain'] or email.split('@')[1]
            doc_id = f"revenda:{domain}"
        else:  # cliente
            doc_id = f"user:{email}"
    
    # Criar documento base
    doc = {
        '_id': doc_id,
        'type': user_type,
        'email': email,
        'name': user['name'],
        'status': user['status'],
        'created_at': user['created_at'],
        'cognito_synced': True,
        'cognito_synced_at': datetime.now().isoformat()
    }
    
    # Adicionar campos específicos por tipo
    if user_type == 'revenda':
        domain = user['domain'] or email.split('@')[1]
        doc['domain'] = domain
        doc['clientes'] = []  # Inicializar lista de clientes
    
    elif user_type == 'cliente':
        if user['revenda_id']:
            doc['revenda_id'] = user['revenda_id']
        else:
            # Tentar inferir revenda_id do email ou domain
            domain = email.split('@')[1]
            doc['revenda_id'] = f"revenda:{domain}"
    
    return doc


def sync_user_to_couchdb(db, user: Dict, dry_run: bool = False) -> Dict:
    """
    Sincronizar usuário do Cognito para o CouchDB
    
    Args:
        db: Conexão com CouchDB
        user: Dados do usuário do Cognito
        dry_run: Se True, apenas simula sem salvar
    
    Returns:
        Resultado da sincronização
    """
    try:
        doc = create_couchdb_doc(user)
        doc_id = doc['_id']
        
        # Verificar se já existe
        try:
            existing_doc = db[doc_id]
            # Atualizar documento existente
            doc['_rev'] = existing_doc['_rev']
            doc['created_at'] = existing_doc.get('created_at', doc['created_at'])
            action = 'atualizado'
        except couchdb.http.ResourceNotFound:
            # Criar novo documento
            action = 'criado'
        
        if not dry_run:
            db.save(doc)
            return {
                'success': True,
                'action': action,
                'doc_id': doc_id,
                'user': user['email']
            }
        else:
            return {
                'success': True,
                'action': f'{action} (simulado)',
                'doc_id': doc_id,
                'user': user['email']
            }
    
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'user': user.get('email', 'unknown')
        }


# =============================================================================
# Main
# =============================================================================

def main():
    """Função principal"""
    parser = argparse.ArgumentParser(
        description="Sincronizar usuários do AWS Cognito para o CouchDB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python scripts/sync_cognito_to_couchdb.py                    # Sincronizar todos
  python scripts/sync_cognito_to_couchdb.py --dry-run          # Apenas visualizar
  python scripts/sync_cognito_to_couchdb.py --type admin       # Apenas admins
  python scripts/sync_cognito_to_couchdb.py --type revenda      # Apenas revendas
        """
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Apenas simular, não salvar no CouchDB"
    )
    
    parser.add_argument(
        "--type",
        choices=["admin", "revenda", "cliente"],
        help="Filtrar por tipo de usuário"
    )
    
    parser.add_argument(
        "--user-pool-id",
        default=COGNITO_USER_POOL_ID,
        help=f"ID do Cognito User Pool (default: {COGNITO_USER_POOL_ID})"
    )
    
    parser.add_argument(
        "--region",
        default=COGNITO_REGION,
        help=f"Região AWS (default: {COGNITO_REGION})"
    )
    
    args = parser.parse_args()
    
    # Cabeçalho
    title = "Sincronização Cognito → CouchDB"
    if args.dry_run:
        title += " (DRY RUN)"
    print_header(title)
    
    # Conectar ao Cognito
    print(f"{Colors.OKCYAN}Conectando ao AWS Cognito...{Colors.ENDC}")
    print(f"{Colors.OKCYAN}User Pool ID: {args.user_pool_id}{Colors.ENDC}")
    print(f"{Colors.OKCYAN}Região: {args.region}{Colors.ENDC}\n")
    
    try:
        cognito_client = boto3.client('cognito-idp', region_name=args.region)
        # Testar conexão
        cognito_client.describe_user_pool(UserPoolId=args.user_pool_id)
        print(f"{Colors.OKGREEN}✅ Conectado ao Cognito com sucesso!{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao conectar ao Cognito: {e}{Colors.ENDC}")
        print(f"{Colors.WARNING}Certifique-se de que as credenciais AWS estão configuradas.{Colors.ENDC}")
        sys.exit(1)
    
    # Conectar ao CouchDB
    print(f"{Colors.OKCYAN}Conectando ao CouchDB...{Colors.ENDC}")
    print(f"{Colors.OKCYAN}URL: {settings.COUCHDB_URL}{Colors.ENDC}")
    print(f"{Colors.OKCYAN}Database: {settings.COUCHDB_DB}{Colors.ENDC}\n")
    
    try:
        server = couchdb.Server(settings.COUCHDB_URL)
        db = server[settings.COUCHDB_DB]
        print(f"{Colors.OKGREEN}✅ Conectado ao CouchDB com sucesso!{Colors.ENDC}\n")
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao conectar ao CouchDB: {e}{Colors.ENDC}")
        sys.exit(1)
    
    # Buscar usuários do Cognito
    try:
        cognito_users = get_cognito_users(cognito_client, args.user_pool_id, args.type)
    
    except Exception as e:
        print(f"{Colors.FAIL}❌ Erro ao buscar usuários: {e}{Colors.ENDC}")
        sys.exit(1)
    
    if not cognito_users:
        print(f"{Colors.WARNING}⚠️  Nenhum usuário encontrado no Cognito.{Colors.ENDC}")
        sys.exit(0)
    
    # Sincronizar usuários
    print(f"{Colors.OKCYAN}Sincronizando usuários...{Colors.ENDC}\n")
    
    results = {
        'success': [],
        'errors': []
    }
    
    for user in cognito_users:
        result = sync_user_to_couchdb(db, user, dry_run=args.dry_run)
        
        if result['success']:
            results['success'].append(result)
            status_color = Colors.OKGREEN
            print(f"{status_color}✅ {result['action'].upper()}: {result['user']} ({result['doc_id']}){Colors.ENDC}")
        else:
            results['errors'].append(result)
            print(f"{Colors.FAIL}❌ ERRO: {result['user']} - {result['error']}{Colors.ENDC}")
    
    # Resumo
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}Resumo da Sincronização:{Colors.ENDC}")
    print(f"  {Colors.OKGREEN}Sucesso:{Colors.ENDC} {len(results['success'])}")
    print(f"  {Colors.FAIL}Erros:{Colors.ENDC} {len(results['errors'])}")
    print(f"  {Colors.BOLD}Total:{Colors.ENDC} {len(cognito_users)}")
    
    if args.dry_run:
        print(f"\n{Colors.WARNING}⚠️  MODO DRY RUN - Nenhum dado foi salvo no CouchDB{Colors.ENDC}")
    
    print(f"{Colors.BOLD}{Colors.HEADER}{'='*80}{Colors.ENDC}\n")
    
    # Mostrar erros se houver
    if results['errors']:
        print(f"{Colors.FAIL}Erros encontrados:{Colors.ENDC}")
        for error in results['errors']:
            print(f"  - {error['user']}: {error['error']}")
        print()


if __name__ == "__main__":
    main()
