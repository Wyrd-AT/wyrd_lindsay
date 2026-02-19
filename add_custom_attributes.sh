#!/bin/bash

# Script para adicionar custom attributes ao User Pool via AWS CLI
# Infelizmente, UpdateUserPool não permite adicionar novos custom attributes
# Então vamos criar um novo User Pool com os custom attributes já inclusos

set -e

USER_POOL_ID="sa-east-1_plnyzL41t"
REGION="sa-east-1"

echo "⚠️  IMPORTANTE: Custom attributes SÓ podem ser adicionados ao criar o User Pool"
echo ""
echo "Você tem 3 opções:"
echo ""
echo "1️⃣  Criar novo User Pool com custom attributes (recomendado)"
echo "   → Vamos criar novo pool com setup correto"
echo ""
echo "2️⃣  Usar User Pool atual SEM custom attributes"
echo "   → Continuar com campo 'type' no CouchDB backend"
echo ""
echo "3️⃣  Recrear User Pool manualmente no console"
echo "   → Mais trabalhoso mas possível"
echo ""

echo "Escolha uma opção (1, 2 ou 3):"
read choice

case $choice in
  1)
    echo ""
    echo "Criando novo User Pool com custom attributes..."
    echo ""

    # Criar novo User Pool com custom attributes
    NEW_POOL=$(aws cognito-idp create-user-pool \
      --pool-name "lindsay-with-hierarchy" \
      --policies '{
        "PasswordPolicy": {
          "MinimumLength": 8,
          "RequireUppercase": true,
          "RequireLowercase": true,
          "RequireNumbers": true,
          "RequireSymbols": false
        }
      }' \
      --schema '[
        {
          "Name": "email",
          "AttributeDataType": "String",
          "Required": true,
          "Mutable": true
        },
        {
          "Name": "name",
          "AttributeDataType": "String",
          "Mutable": true
        },
        {
          "Name": "phone_number",
          "AttributeDataType": "String",
          "Mutable": true
        },
        {
          "Name": "type",
          "AttributeDataType": "String",
          "Mutable": true,
          "StringAttributeConstraints": {
            "MinLength": 1,
            "MaxLength": 20
          }
        },
        {
          "Name": "status",
          "AttributeDataType": "String",
          "Mutable": true,
          "StringAttributeConstraints": {
            "MinLength": 1,
            "MaxLength": 20
          }
        },
        {
          "Name": "domain",
          "AttributeDataType": "String",
          "Mutable": true,
          "StringAttributeConstraints": {
            "MinLength": 1,
            "MaxLength": 100
          }
        },
        {
          "Name": "revenda_id",
          "AttributeDataType": "String",
          "Mutable": true,
          "StringAttributeConstraints": {
            "MinLength": 1,
            "MaxLength": 100
          }
        },
        {
          "Name": "doc_id",
          "AttributeDataType": "String",
          "Mutable": true,
          "StringAttributeConstraints": {
            "MinLength": 1,
            "MaxLength": 100
          }
        }
      ]' \
      --auto-verified-attributes email \
      --region $REGION)

    NEW_POOL_ID=$(echo $NEW_POOL | jq -r '.UserPool.Id')

    echo "✅ Novo User Pool criado!"
    echo "   ID: $NEW_POOL_ID"
    echo ""
    echo "📝 Próximos passos:"
    echo "   1. Atualizar .env com novo USER_POOL_ID"
    echo "   2. Deletar User Pool antigo (sa-east-1_plnyzL41t)"
    echo "   3. Executar create_test_users_with_hierarchy.py"
    ;;

  2)
    echo ""
    echo "Continuando com User Pool atual (sem custom attributes Cognito)"
    echo "Vamos usar CouchDB para armazenar hierarquia"
    echo ""
    ;;

  3)
    echo ""
    echo "Acesse: https://console.aws.amazon.com/cognito/"
    echo "Siga os passos do COGNITO_SETUP.md"
    echo ""
    ;;

  *)
    echo "❌ Opção inválida"
    exit 1
    ;;
esac
