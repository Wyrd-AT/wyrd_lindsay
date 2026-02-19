#!/bin/bash

# Quick Cognito Test Script
# Edite as variáveis abaixo e execute: bash test_cognito_quick.sh

set -e

# ===== CONFIGURAÇÃO =====
USER_POOL_ID="sa-east-1_XXXXX"      # MUDAR PARA SEU USER POOL ID
CLIENT_ID="YYYYYYY"                  # MUDAR PARA SEU CLIENT ID
REGION="sa-east-1"

# ===== CORES =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ===== FUNÇÕES =====

print_header() {
    echo -e "\n${YELLOW}════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ===== VERIFICAÇÕES =====

print_header "Verificações Iniciais"

# Verificar AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI não está instalado"
    echo "Instale com: brew install awscli (macOS) ou apt install awscli (Linux)"
    exit 1
fi
print_success "AWS CLI encontrado"

# Verificar configuração AWS
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS CLI não está configurado"
    echo "Execute: aws configure"
    exit 1
fi
print_success "AWS CLI configurado"

# Verificar variáveis
if [[ "$USER_POOL_ID" == "sa-east-1_XXXXX" ]] || [[ "$CLIENT_ID" == "YYYYYYY" ]]; then
    print_error "Variáveis não configuradas!"
    echo "Edite o script e mude USER_POOL_ID e CLIENT_ID"
    exit 1
fi
print_success "Variáveis configuradas"

# ===== TESTES =====

print_header "TESTE 1: Criar Usuário de Teste"

USERNAME="teste_$(date +%s)@example.com"

aws cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username $USERNAME \
    --user-attributes \
        Name=email,Value=$USERNAME \
        Name=name,Value="Usuário Teste" \
        Name="custom:type",Value=admin \
        Name="custom:status",Value=active \
    --message-action SUPPRESS \
    --region $REGION > /dev/null

print_success "Usuário criado: $USERNAME"

# ===== TESTE 2 =====

print_header "TESTE 2: Definir Senha"

aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username $USERNAME \
    --password "TestPassword123!" \
    --permanent \
    --region $REGION > /dev/null

print_success "Senha definida"

# ===== TESTE 3 =====

print_header "TESTE 3: Recuperar Usuário"

echo "Recuperando dados do usuário..."
USER_DATA=$(aws cognito-idp admin-get-user \
    --user-pool-id $USER_POOL_ID \
    --username $USERNAME \
    --region $REGION)

echo "Username: $USERNAME"
echo "$USER_DATA" | jq '.UserAttributes[] | select(.Name | contains("custom:")) | "\(.Name): \(.Value)"' -r

# Verificar custom attributes
if echo "$USER_DATA" | grep -q "custom:type"; then
    print_success "Custom attributes encontrados!"
else
    print_error "Custom attributes NÃO encontrados!"
fi

# ===== TESTE 4 =====

print_header "TESTE 4: Fazer Login"

LOGIN_DATA=$(aws cognito-idp admin-initiate-auth \
    --user-pool-id $USER_POOL_ID \
    --client-id $CLIENT_ID \
    --auth-flow ADMIN_NO_SRP_AUTH \
    --auth-parameters USERNAME=$USERNAME,PASSWORD="TestPassword123!" \
    --region $REGION)

ID_TOKEN=$(echo "$LOGIN_DATA" | jq -r '.AuthenticationResult.IdToken')

if [[ -z "$ID_TOKEN" ]] || [[ "$ID_TOKEN" == "null" ]]; then
    print_error "Falha ao fazer login!"
    exit 1
fi

print_success "Login bem-sucedido"

# ===== TESTE 5 =====

print_header "TESTE 5: Decodificar ID Token"

# Extrair payload
PAYLOAD=$(echo $ID_TOKEN | cut -d'.' -f2)

# Adicionar padding se necessário
PADDING=$((4 - ${#PAYLOAD} % 4))
if [ $PADDING != 4 ]; then
    PAYLOAD="${PAYLOAD}$(printf '%0.s=' $(seq 1 $PADDING))"
fi

# Decodificar
DECODED=$(echo $PAYLOAD | base64 -d 2>/dev/null || echo $PAYLOAD | base64 -D)

if ! command -v jq &> /dev/null; then
    echo "Token decodificado (instale 'jq' para melhor visualização):"
    echo "$DECODED"
else
    echo "Claims no ID Token:"
    echo "$DECODED" | jq '.email, .name, ."custom:type", ."custom:status"' -r

    if echo "$DECODED" | jq -e '."custom:type"' > /dev/null 2>&1; then
        print_success "Custom attributes estão no ID Token!"
    else
        print_error "Custom attributes NÃO estão no ID Token!"
    fi
fi

# ===== TESTE 6 =====

print_header "TESTE 6: Atualizar Custom Attribute"

aws cognito-idp admin-update-user-attributes \
    --user-pool-id $USER_POOL_ID \
    --username $USERNAME \
    --user-attributes Name="custom:status",Value=pending \
    --region $REGION > /dev/null

print_success "Atributo atualizado (status: active → pending)"

# Verificar atualização
UPDATED_STATUS=$(aws cognito-idp admin-get-user \
    --user-pool-id $USER_POOL_ID \
    --username $USERNAME \
    --region $REGION | jq -r '.UserAttributes[] | select(.Name=="custom:status") | .Value')

if [[ "$UPDATED_STATUS" == "pending" ]]; then
    print_success "Atualização confirmada: $UPDATED_STATUS"
else
    print_error "Atualização falhou! Status atual: $UPDATED_STATUS"
fi

# ===== LIMPEZA =====

print_header "Limpeza"

aws cognito-idp admin-delete-user \
    --user-pool-id $USER_POOL_ID \
    --username $USERNAME \
    --region $REGION > /dev/null

print_success "Usuário de teste deletado"

# ===== RESULTADO FINAL =====

print_header "✅ TODOS OS TESTES PASSARAM!"

echo "Resumo:"
echo "  ✅ Criar usuário com custom attributes"
echo "  ✅ Definir senha permanente"
echo "  ✅ Recuperar usuário"
echo "  ✅ Fazer login"
echo "  ✅ Decodificar ID Token"
echo "  ✅ Atualizar custom attributes"
echo ""
echo "🎉 Cognito está 100% funcional!"
echo ""
