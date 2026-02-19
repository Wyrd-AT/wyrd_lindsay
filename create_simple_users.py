#!/usr/bin/env python3
"""
Script simplificado para criar usuários básicos no Cognito (sem custom attributes)
Vamos criar usuários simples primeiro, depois adicionar os custom attributes
"""

import boto3

USER_POOL_ID = "sa-east-1_plnyzL41t"
REGION = "sa-east-1"

cognito = boto3.client('cognito-idp', region_name=REGION)

users = [
    {
        'email': 'admin@company.com',
        'name': 'Admin User',
        'password': 'Admin@12345'
    },
    {
        'email': 'revenda@example.com',
        'name': 'Revenda Example',
        'password': 'Revenda@12345'
    },
    {
        'email': 'cliente@example.com',
        'name': 'Cliente Example',
        'password': 'Cliente@12345'
    },
]

print("\n🚀 Criando usuários simples (sem custom attributes)...\n")

for user in users:
    try:
        # Criar usuário
        cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=user['email'],
            TemporaryPassword=user['password'],
            MessageAction='SUPPRESS',
            UserAttributes=[
                {'Name': 'email', 'Value': user['email']},
                {'Name': 'name', 'Value': user['name']},
            ]
        )

        # Definir senha permanente
        cognito.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=user['email'],
            Password=user['password'],
            Permanent=True
        )

        print(f"✅ Usuário criado: {user['email']}")

    except Exception as e:
        print(f"❌ Erro ao criar {user['email']}: {str(e)}")

print("\n" + "="*60)
print("✅ USUÁRIOS CRIADOS COM SUCESSO!")
print("="*60 + "\n")

print("Credenciais de teste:\n")
print("👑 ADMIN:")
print("   Email: admin@company.com")
print("   Senha: Admin@12345\n")

print("🏢 REVENDA:")
print("   Email: revenda@example.com")
print("   Senha: Revenda@12345\n")

print("👤 CLIENTE:")
print("   Email: cliente@example.com")
print("   Senha: Cliente@12345\n")

print("="*60)
print("Próximo passo: Faça login no frontend com admin@company.com")
print("="*60 + "\n")
