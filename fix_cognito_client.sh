#!/bin/bash

# Script para deletar o client antigo com secret e criar novo sem secret

set -e

# ===== CONFIGURAÇÃO =====
USER_POOL_ID="sa-east-1_plnyzL41t"  # MUDAR SE NECESSÁRIO
OLD_CLIENT_ID="esj0goqdvafbipfi8rsr0djla"
REGION="sa-east-1"

echo "🔧 Recriando Cognito Client SEM Secret..."
echo ""

# ===== DELETAR CLIENT ANTIGO (SE EXISTIR) =====
echo "1️⃣ Verificando se client antigo existe..."
if aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $OLD_CLIENT_ID \
  --region $REGION &> /dev/null; then

  echo "   Deletando client antigo..."
  aws cognito-idp delete-user-pool-client \
    --user-pool-id $USER_POOL_ID \
    --client-id $OLD_CLIENT_ID \
    --region $REGION
  echo "✅ Client antigo deletado"
else
  echo "✅ Client antigo não existe (já foi deletado)"
fi
echo ""

# ===== CRIAR NOVO CLIENT SEM SECRET =====
echo "2️⃣ Criando novo client sem secret..."
NEW_CLIENT=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name "lindsay-app-no-secret" \
  --explicit-auth-flows \
    ADMIN_NO_SRP_AUTH \
    USER_PASSWORD_AUTH \
  --region $REGION)

NEW_CLIENT_ID=$(echo $NEW_CLIENT | jq -r '.UserPoolClient.ClientId')

echo "✅ Novo client criado"
echo ""

# ===== EXIBIR NOVO CLIENT ID =====
echo "════════════════════════════════════════"
echo "🎉 NOVO CLIENT ID:"
echo "════════════════════════════════════════"
echo ""
echo "   $NEW_CLIENT_ID"
echo ""
echo "════════════════════════════════════════"
echo ""

# ===== INSTRUÇÕES =====
echo "📋 Próximos passos:"
echo ""
echo "1. Copiar o novo Client ID acima"
echo ""
echo "2. Atualizar .env.local:"
echo "   VITE_COGNITO_CLIENT_ID=$NEW_CLIENT_ID"
echo ""
echo "3. Atualizar api.js:"
echo "   export const COGNITO_CLIENT_ID = '$NEW_CLIENT_ID';"
echo ""
echo "4. Fazer reload do frontend (Ctrl+Shift+R)"
echo ""
echo "5. Testar login novamente"
echo ""
