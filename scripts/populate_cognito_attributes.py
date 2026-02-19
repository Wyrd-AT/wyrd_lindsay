#!/usr/bin/env python3
"""
Script para popular Custom Attributes dos usuários no Cognito
Conecta ao Cognito e CouchDB para sincronizar dados
"""

import boto3
import json
from typing import Dict, List
import sys

# Configuração
COGNITO_USER_POOL_ID = "us-east-1_XXXXX"  # ← SUBSTITUIR COM SEU POOL ID
COGNITO_REGION = "us-east-1"

# Usuários de teste com seus custom attributes
USERS_TO_UPDATE = [
    {
        "username": "julio.paz@wyrd.com.br",
        "attributes": {
            "email": "julio.paz@wyrd.com.br",
            "name": "Júlio Paz",
            "custom:type": "admin",
            "custom:status": "active",
            "custom:doc_id": "admin:julio.paz@wyrd.com.br",
            "custom:cnpj": "12.345.678/0001-99",
            "custom:company_id": "wyrd",
        }
    },
    {
        "username": "revenda@wyrd.com.br",
        "attributes": {
            "email": "revenda@wyrd.com.br",
            "name": "Gerente WYRD",
            "custom:type": "revenda",
            "custom:status": "active",
            "custom:domain": "wyrd.com.br",
            "custom:doc_id": "revenda:wyrd.com.br",
            "custom:cnpj": "12.345.678/0001-99",
            "custom:company_id": "wyrd",
        }
    },
    {
        "username": "revenda@gmail.com.br",
        "attributes": {
            "email": "revenda@gmail.com.br",
            "name": "Gerente Gmail",
            "custom:type": "revenda",
            "custom:status": "active",
            "custom:domain": "gmail.com.br",
            "custom:doc_id": "revenda:gmail.com.br",
            "custom:cnpj": "98.765.432/0001-11",
            "custom:company_id": "gmail",
        }
    },
    {
        "username": "revenda@usp.br",
        "attributes": {
            "email": "revenda@usp.br",
            "name": "Gerente USP",
            "custom:type": "revenda",
            "custom:status": "active",
            "custom:domain": "usp.br",
            "custom:doc_id": "revenda:usp.br",
            "custom:cnpj": "11.222.333/0001-44",
            "custom:company_id": "usp",
        }
    },
    {
        "username": "cliente@fazenda.com",
        "attributes": {
            "email": "cliente@fazenda.com",
            "name": "João Fazendeiro",
            "custom:type": "cliente",
            "custom:status": "pending",
            "custom:doc_id": "user:cliente@fazenda.com",
            "custom:revenda_id": "revenda:wyrd.com.br",
        }
    },
]

def update_user_attributes(cognito_client, user_pool_id: str, username: str, attributes: Dict[str, str]) -> bool:
    """
    Atualizar custom attributes de um usuário no Cognito

    Args:
        cognito_client: Cliente boto3 do Cognito
        user_pool_id: ID do User Pool
        username: Email/username do usuário
        attributes: Dicionário com chave-valor dos atributos

    Returns:
        True se bem-sucedido, False caso contrário
    """
    try:
        # Converter dicionário em formato de boto3
        user_attributes = [
            {"Name": key, "Value": value}
            for key, value in attributes.items()
        ]

        cognito_client.admin_update_user_attributes(
            UserPoolId=user_pool_id,
            Username=username,
            UserAttributes=user_attributes
        )

        print(f"✅ {username}: Atributos atualizados com sucesso")
        return True

    except cognito_client.exceptions.UserNotFoundException:
        print(f"❌ {username}: Usuário não encontrado no Cognito")
        return False
    except Exception as e:
        print(f"❌ {username}: Erro ao atualizar - {str(e)}")
        return False

def main():
    """Executar script de atualização"""

    print("\n" + "="*70)
    print("🔐 SCRIPT: Popular Custom Attributes no Cognito")
    print("="*70 + "\n")

    # Validar configuração
    if COGNITO_USER_POOL_ID == "us-east-1_XXXXX":
        print("❌ ERRO: COGNITO_USER_POOL_ID não foi configurado!")
        print("   Substitua 'us-east-1_XXXXX' pelo seu User Pool ID\n")
        sys.exit(1)

    print(f"📍 User Pool: {COGNITO_USER_POOL_ID}")
    print(f"📍 Region: {COGNITO_REGION}\n")

    # Criar cliente Cognito
    try:
        cognito_client = boto3.client('cognito-idp', region_name=COGNITO_REGION)
        print("✅ Conectado ao Cognito\n")
    except Exception as e:
        print(f"❌ Erro ao conectar ao Cognito: {e}\n")
        sys.exit(1)

    # Atualizar cada usuário
    print("📋 Atualizando usuários:\n")
    success_count = 0
    failure_count = 0

    for user_config in USERS_TO_UPDATE:
        username = user_config["username"]
        attributes = user_config["attributes"]

        if update_user_attributes(cognito_client, COGNITO_USER_POOL_ID, username, attributes):
            success_count += 1
        else:
            failure_count += 1

    # Resumo
    print("\n" + "="*70)
    print(f"✅ Sucesso: {success_count}/{len(USERS_TO_UPDATE)}")
    print(f"❌ Falhas: {failure_count}/{len(USERS_TO_UPDATE)}")
    print("="*70 + "\n")

    if failure_count == 0:
        print("🎉 Todos os usuários foram atualizados com sucesso!\n")
        print("⏭️  Próximos passos:")
        print("   1. Fazer login novamente no aplicativo")
        print("   2. Abrir DevTools (F12) → Console")
        print("   3. Procurar por logs de 'User type:' para confirmar")
        print("   4. Você deve ser redirecionado automaticamente para o dashboard\n")
    else:
        print(f"⚠️  {failure_count} usuários falharam. Verifique os erros acima.\n")

if __name__ == "__main__":
    main()
