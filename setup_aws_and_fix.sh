#!/bin/bash

# Script para reconfigurá AWS e depois corrigir o Cognito Client

set -e

echo "🔐 Verificando Credenciais AWS..."
echo ""

# Verificar se credenciais são válidas
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ Credenciais AWS inválidas ou expiradas!"
    echo ""
    echo "Precisa reconfigurá-las. Execute:"
    echo ""
    echo "  aws configure"
    echo ""
    echo "Será pedido:"
    echo "  - AWS Access Key ID"
    echo "  - AWS Secret Access Key"
    echo "  - Default region: sa-east-1"
    echo "  - Default output format: json"
    echo ""
    exit 1
fi

echo "✅ Credenciais AWS válidas!"
echo ""

# Agora executar o fix
echo "🔧 Recriando Cognito Client SEM Secret..."
echo ""

bash fix_cognito_client.sh
