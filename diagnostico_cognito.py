#!/usr/bin/env python3
"""
Diagnóstico de Custom Attributes no AWS Cognito
Verifica quais custom attributes existem e ajuda a criar os faltantes
"""

import boto3
import json
from dotenv import load_dotenv
import os

# Carregar variáveis de ambiente
load_dotenv("fast-api-lindsay/.env")

# Configuração
AWS_REGION = os.getenv("AWS_REGION", "sa-east-1")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "sa-east-1_bm329gdfB")

print("=" * 80)
print("🔍 DIAGNÓSTICO DE CUSTOM ATTRIBUTES - AWS COGNITO")
print("=" * 80)
print(f"\n📍 Região: {AWS_REGION}")
print(f"📍 User Pool ID: {COGNITO_USER_POOL_ID}")

# Conectar ao Cognito
cognito = boto3.client('cognito-idp', region_name=AWS_REGION)

try:
    # 1. Obter detalhes do User Pool
    print("\n1️⃣ Obtendo detalhes do User Pool...")
    pool_response = cognito.describe_user_pool(UserPoolId=COGNITO_USER_POOL_ID)
    pool = pool_response['UserPool']

    print(f"   ✅ Pool encontrada: {pool['Name']}")

    # 2. Verificar Schema de Custom Attributes
    print("\n2️⃣ Verificando Custom Attributes definidos...")
    schema = pool.get('SchemaAttributes', [])
    custom_attrs = [s for s in schema if s['Name'].startswith('custom:')]

    if custom_attrs:
        print(f"   ✅ {len(custom_attrs)} custom attributes encontrados:")
        for attr in custom_attrs:
            print(f"      - {attr['Name']}")
    else:
        print("   ❌ NENHUM custom attribute encontrado!")
        print("      Os custom attributes precisam ser criados ANTES de usar!")

    # 3. Listar todos os atributos (incluindo padrão)
    print("\n3️⃣ Todos os atributos disponíveis:")
    for attr in schema:
        attr_type = "📌 Custom" if attr['Name'].startswith('custom:') else "⚙️ Padrão"
        mutable = "✏️ Mutável" if attr.get('Mutable', False) else "🔒 Imutável"
        required = "⚠️ Obrigatório" if attr.get('Required', False) else "⏸️ Opcional"
        print(f"   {attr_type:15} | {attr['Name']:25} | {mutable:12} | {required}")

    # 4. Verificar custom attributes necessários
    print("\n4️⃣ Verificando custom attributes necessários para Lindsay...")
    required_custom = ['custom:type', 'custom:status', 'custom:domain', 'custom:company_id', 'custom:doc_id']
    existing_custom = [s['Name'] for s in custom_attrs]

    missing = [attr for attr in required_custom if attr not in existing_custom]

    if missing:
        print(f"   ❌ FALTANDO {len(missing)} custom attributes:")
        for attr in missing:
            print(f"      - {attr}")
    else:
        print("   ✅ Todos os custom attributes necessários existem!")

    # 5. Listar usuários e seus atributos
    print("\n5️⃣ Verificando usuários e seus atributos...")
    users_response = cognito.list_users(UserPoolId=COGNITO_USER_POOL_ID, Limit=10)

    if users_response['Users']:
        for user in users_response['Users'][:3]:  # Mostrar apenas 3 primeiros
            print(f"\n   📧 {user['Username']}")
            print(f"      Status: {user['UserStatus']}")
            attrs = {a['Name']: a.get('Value', 'N/A') for a in user.get('Attributes', [])}
            for key, value in attrs.items():
                if key.startswith('custom:'):
                    print(f"      ✅ {key}: {value}")
            # Verificar se tem custom attributes
            custom_user_attrs = [k for k in attrs if k.startswith('custom:')]
            if not custom_user_attrs:
                print(f"      ❌ Nenhum custom attribute encontrado!")
    else:
        print("   ℹ️ Nenhum usuário encontrado")

    # 6. Resumo final
    print("\n" + "=" * 80)
    print("📊 RESUMO")
    print("=" * 80)

    if custom_attrs:
        print("✅ Custom attributes estão DEFINIDOS no User Pool")
        print("   Próximo passo: Deletar usuários antigos e criar novos")
        print("   Ou verificar por que os atributos não estão sendo salvos")
    else:
        print("❌ Custom attributes NÃO estão DEFINIDOS no User Pool")
        print("   Solução: Usar AWS Console ou Script para criar os custom attributes")

    print("\n" + "=" * 80)

except Exception as e:
    print(f"\n❌ ERRO: {e}")
    print("\n💡 Dicas de troubleshooting:")
    print("   1. Verifique se o arquivo .env está configurado corretamente")
    print("   2. Verifique se o COGNITO_USER_POOL_ID está correto")
    print("   3. Verifique se as credenciais AWS estão configuradas (~/.aws/credentials)")
    print("   4. Execute: aws configure")
