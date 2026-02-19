#!/usr/bin/env python3
"""
Script para criar usuários com hierarquia multi-nível

Estratégia:
- Cognito: armazena apenas email/senha (autenticação)
- CouchDB: armazena hierarquia (type, status, domain, revenda_id, doc_id)
- Após login: Backend retorna dados de hierarquia via CouchDB

Isso é mais flexível e não requer custom attributes no Cognito
"""

import boto3
import requests
import json
from datetime import datetime

# ===== CONFIGURAÇÃO COGNITO =====
COGNITO_USER_POOL_ID = "sa-east-1_plnyzL41t"
COGNITO_REGION = "sa-east-1"

# ===== CONFIGURAÇÃO COUCHDB =====
COUCHDB_URL = "http://localhost:5984"  # MUDAR SE NECESSÁRIO
COUCHDB_DB = "lindsay-data"  # MUDAR SE NECESSÁRIO

# ===== COGNITO CLIENT =====
cognito = boto3.client('cognito-idp', region_name=COGNITO_REGION)

# ===== USUÁRIOS A CRIAR =====
users_hierarchy = [
    {
        'cognito_email': 'admin@company.com',
        'cognito_password': 'Admin@12345',
        'cognito_name': 'Admin User',
        # Dados de hierarquia (armazenar no CouchDB)
        'hierarchy': {
            '_id': 'admin:admin@company.com',
            'type': 'admin',
            'status': 'active',
            'email': 'admin@company.com',
            'name': 'Admin User',
            'doc_type': 'user',
            'created_at': datetime.now().isoformat(),
        }
    },
    {
        'cognito_email': 'revenda@example.com',
        'cognito_password': 'Revenda@12345',
        'cognito_name': 'Revenda Example',
        'hierarchy': {
            '_id': 'revenda:example.com',
            'type': 'revenda',
            'status': 'active',
            'email': 'revenda@example.com',
            'name': 'Revenda Example',
            'domain': 'example.com',
            'doc_type': 'user',
            'created_at': datetime.now().isoformat(),
        }
    },
    {
        'cognito_email': 'cliente@example.com',
        'cognito_password': 'Cliente@12345',
        'cognito_name': 'Cliente Example',
        'hierarchy': {
            '_id': 'cliente:cliente@example.com',
            'type': 'cliente',
            'status': 'pending',  # Aguardando aprovação da revenda
            'email': 'cliente@example.com',
            'name': 'Cliente Example',
            'revenda_id': 'revenda:example.com',
            'doc_type': 'user',
            'created_at': datetime.now().isoformat(),
        }
    },
]

print("\n" + "="*70)
print("  CRIAR USUÁRIOS COM HIERARQUIA MULTI-NÍVEL")
print("="*70 + "\n")

# ===== 1. CRIAR NO COGNITO =====
print("📋 PASSO 1: Criar usuários no Cognito (autenticação)\n")

created_users = []

for user in users_hierarchy:
    try:
        # Criar no Cognito
        cognito.admin_create_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=user['cognito_email'],
            TemporaryPassword=user['cognito_password'],
            MessageAction='SUPPRESS',
            UserAttributes=[
                {'Name': 'email', 'Value': user['cognito_email']},
                {'Name': 'name', 'Value': user['cognito_name']},
            ]
        )

        # Definir senha permanente
        cognito.admin_set_user_password(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=user['cognito_email'],
            Password=user['cognito_password'],
            Permanent=True
        )

        print(f"✅ Criado no Cognito: {user['cognito_email']}")
        created_users.append(user)

    except Exception as e:
        print(f"❌ Erro ao criar {user['cognito_email']}: {str(e)}")

# ===== 2. CRIAR NO COUCHDB =====
print("\n📋 PASSO 2: Criar usuários no CouchDB (hierarquia)\n")

for user in created_users:
    try:
        # Criar documento de hierarquia no CouchDB
        response = requests.put(
            f"{COUCHDB_URL}/{COUCHDB_DB}/{user['hierarchy']['_id']}",
            json=user['hierarchy'],
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code in [201, 202]:
            print(f"✅ Criado no CouchDB: {user['hierarchy']['_id']}")
            print(f"   Type: {user['hierarchy']['type']}")
            print(f"   Status: {user['hierarchy']['status']}\n")
        else:
            print(f"⚠️  Resposta CouchDB: {response.status_code}")
            print(f"   {response.text}\n")

    except Exception as e:
        print(f"❌ Erro ao criar no CouchDB: {str(e)}\n")

# ===== 3. RESUMO =====
print("\n" + "="*70)
print("  ✅ USUÁRIOS CRIADOS COM SUCESSO!")
print("="*70 + "\n")

print("📊 HIERARQUIA CRIADA:\n")

print("👑 ADMIN (Nível Topo)")
print("   Email:  admin@company.com")
print("   Senha:  Admin@12345")
print("   Type:   admin")
print("   Status: active")
print()

print("🏢 REVENDA (Nível 1)")
print("   Email:  revenda@example.com")
print("   Senha:  Revenda@12345")
print("   Type:   revenda")
print("   Status: active")
print("   Domínio: example.com")
print()

print("👤 CLIENTE (Nível 2)")
print("   Email:  cliente@example.com")
print("   Senha:  Cliente@12345")
print("   Type:   cliente")
print("   Status: pending (aguardando aprovação da revenda)")
print()

print("="*70)
print("  🚀 PRÓXIMOS PASSOS")
print("="*70 + "\n")

print("1. Testar login no frontend:")
print("   → admin@company.com / Admin@12345\n")

print("2. Verificar dados no CouchDB:")
print("   → http://localhost:5984/_utils/\n")

print("3. Backend deve retornar dados de hierarquia após login")
print("   → GET /api/user/me (retorna dados do CouchDB)\n")

print("4. Frontend usa PermissionGuard para controlar acesso\n")

print("="*70 + "\n")
