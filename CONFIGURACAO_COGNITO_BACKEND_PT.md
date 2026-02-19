# 🔐 Configuração Cognito para Backend - Guia Completo (PT-BR)

## 🎯 O Problema

Seu **User Pool está em `sa-east-1` (São Paulo)**, mas o backend estava configurado com `us-east-1` (Norte Virginia). Por isso recebeu o erro:

```
User pool client 42qha79hpnknpksf2k1djo7eq9 does not exist
```

---

## ✅ Solução Rápida

O arquivo `React_app/.env.example` tem os valores CORRETOS:

```env
# Frontend (correto):
VITE_COGNITO_USER_POOL_ID=sa-east-1_bm329gdfB
VITE_COGNITO_CLIENT_ID=42qha79hpnknpksf2k1djo7eq9
VITE_COGNITO_BASE_URL=https://cognito-idp.sa-east-1.amazonaws.com/sa-east-1_YOUR_POOL_ID
```

O **backend precisa dos MESMOS valores**:

---

## 📝 Passo 1: Criar arquivo `.env` no Backend

Crie `fast-api-lindsay/.env` com o seguinte conteúdo:

```env
# ============================================================================
# AWS Cognito Configuration
# ============================================================================
AWS_REGION=sa-east-1
COGNITO_USER_POOL_ID=sa-east-1_bm329gdfB
COGNITO_CLIENT_ID=42qha79hpnknpksf2k1djo7eq9

# ============================================================================
# Database
# ============================================================================
COUCHDB_URL=http://localhost:5984
COUCHDB_DB=lindsay-data

# ============================================================================
# MQTT Configuration
# ============================================================================
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_TOPIC=pivo/+/dados
MQTT_QOS=1
MQTT_CLIENT_ID=lindsay-api

# ============================================================================
# Workers & Queue
# ============================================================================
WORKER_COUNT=8
QUEUE_MAXSIZE=5000

# ============================================================================
# FastAPI & Security
# ============================================================================
JWT_SECRET=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# ============================================================================
# Environment
# ============================================================================
ENVIRONMENT=development
LOG_LEVEL=INFO

# ============================================================================
# Timezone
# ============================================================================
TIMEZONE=America/Sao_Paulo
```

---

## 🔍 Passo 2: Verificar no AWS Cognito Console

Para confirmar que está tudo certo:

1. **Acesse AWS Console:**
   - https://console.aws.amazon.com/cognito/

2. **Selecione "User Pools"** → Sua pool de Lindsay

3. **Verifique o Pool ID:**
   - Deve ser: `sa-east-1_bm329gdfB`
   - Local: Topo da página (perto do nome da pool)

4. **Verifique o Client ID:**
   - Vá para: "Integrations" → "App clients" (ou "Aplicações" em português)
   - Procure por um client com ID: `42qha79hpnknpksf2k1djo7eq9`
   - Este é o seu **backend client**

5. **Verifique Auth Flows:**
   - Clique no client
   - Na seção "Authentication flows", certifique-se que estão habilitados:
     - ✅ `ADMIN_NO_SRP_AUTH` (para criar usuários como admin)
     - ✅ `USER_PASSWORD_AUTH` (para login de usuários)

---

## 🚀 Passo 3: Reiniciar o Backend

Após criar o arquivo `.env`, reinicie o FastAPI:

```bash
# Se está rodando localmente:
cd fast-api-lindsay/
python main.py

# Ou com Docker Compose:
docker-compose up --build
```

Deve aparecer:
```
INFO:     Application startup complete
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 🧪 Passo 4: Testar Criação de Revenda

### Opção A: Via Frontend (Recomendado)

1. Abra o app em http://localhost:5173
2. Faça login como **admin**
3. Clique no ícone **⚙️ (engrenagem)** na sidebar
4. Selecione **🏢 Criar Revenda**
5. Preencha o formulário:
   - **Nome:** Test Revenda
   - **Email:** gerente@testdomain.com.br
   - **Domínio:** testdomain.com.br
   - **CNPJ:** 11.222.333/0001-81
   - **Senha:** TempPass123! (deve ter maiúscula, minúscula, número e caractere especial)
6. Clique em **Criar Revenda**

### Opção B: Via cURL (Diagnóstico)

```bash
# Crie uma revenda
curl -X POST http://localhost:8000/api/revendas \
  -H "Authorization: Bearer admin:admin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gerente@testdomain.com.br",
    "password": "TempPass123!",
    "name": "Test Revenda",
    "domain": "testdomain.com.br",
    "cnpj": "11.222.333/0001-81"
  }'
```

**Resposta esperada:**
```json
{
  "status": "success",
  "message": "Revenda created successfully",
  "revenda_id": "revenda:testdomain.com.br",
  "email": "gerente@testdomain.com.br",
  "name": "Test Revenda"
}
```

---

## ✅ Checklist de Configuração

- [ ] Criei `fast-api-lindsay/.env` com os valores corretos
- [ ] `AWS_REGION` está como `sa-east-1`
- [ ] `COGNITO_USER_POOL_ID` está como `sa-east-1_bm329gdfB`
- [ ] `COGNITO_CLIENT_ID` está como `42qha79hpnknpksf2k1djo7eq9`
- [ ] Reiniciei o backend (python main.py)
- [ ] Backend está rodando em http://localhost:8000
- [ ] Testei criação de revenda via frontend ou cURL
- [ ] Usuário foi criado no AWS Cognito
- [ ] Documento foi criado no CouchDB com `status: active`

---

## 🔄 Próximas Etapas (Fluxo Completo)

### 1. **Admin cria uma Revenda**
```
Admin → Sidebar (⚙️) → "Criar Revenda"
  ↓
Modal form → Preenche dados
  ↓
API POST /api/revendas (com token admin)
  ↓
Backend cria user no Cognito + documento no CouchDB (status=active)
  ↓
Modal fecha → Lista de revendas atualiza
```

### 2. **Revenda cria um Cliente**
```
Revenda → Sidebar (⚙️) → "Criar Cliente"
  ↓
Modal form → Preenche dados + seleciona Revenda
  ↓
API POST /api/clientes (com token revenda)
  ↓
Backend cria user no Cognito + documento no CouchDB (status=active, revenda_id=xxx)
  ↓
Modal fecha → Lista de clientes atualiza
```

### 3. **Cliente faz Login**
```
Cliente → Login com email/senha criada pelo admin
  ↓
Cognito autentica → Retorna JWT
  ↓
Frontend obtém tipo=cliente, status=active
  ↓
App redireciona para ClienteDashboard
  ↓
Cliente vê apenas seus pivôs e alertas
```

---

## 🆘 Troubleshooting

### Erro: "User pool client does not exist"
**Causa:** COGNITO_CLIENT_ID ou COGNITO_USER_POOL_ID incorretos
**Solução:**
```bash
# Verifique o arquivo .env
cat fast-api-lindsay/.env | grep COGNITO

# Deve mostrar:
# AWS_REGION=sa-east-1
# COGNITO_USER_POOL_ID=sa-east-1_bm329gdfB
# COGNITO_CLIENT_ID=42qha79hpnknpksf2k1djo7eq9
```

### Erro: "Invalid AWS region"
**Causa:** AWS_REGION está errado
**Solução:** Mude para `sa-east-1` no arquivo `.env`

### Erro: "Admin user creation is not allowed"
**Causa:** Client não tem `ADMIN_NO_SRP_AUTH` habilitado
**Solução:**
1. AWS Console → Cognito → User Pools → Lindsay
2. "Integrations" → "App clients" → Selecione client
3. "Authentication flows" → Habilite ✅ `ADMIN_NO_SRP_AUTH`
4. Salve e reinicie backend

### Erro: "Connection timeout"
**Causa:** Backend não consegue alcançar AWS
**Solução:**
- Verifique internet
- Verifique se há VPN/firewall bloqueando
- Verifique AWS_REGION está correto

---

## 📌 Diferenças: Frontend vs Backend

| Configuração | Frontend | Backend |
|---|---|---|
| **Arquivo** | `React_app/.env` | `fast-api-lindsay/.env` |
| **COGNITO_USER_POOL_ID** | `sa-east-1_bm329gdfB` | `sa-east-1_bm329gdfB` (MESMO) |
| **COGNITO_CLIENT_ID** | `42qha79hpnknpksf2k1djo7eq9` | `42qha79hpnknpksf2k1djo7eq9` (MESMO) |
| **AWS_REGION** | Não precisa | `sa-east-1` (OBRIGATÓRIO) |
| **COGNITO_BASE_URL** | Sim (para Cognito UI) | Não precisa |

---

## 🔒 Segurança

- ✅ `.env` está no `.gitignore` (não comita credenciais)
- ✅ Client ID `42qha79hpnknpksf2k1djo7eq9` é público (ok para web)
- ✅ Pool ID é público (ok, é para saber onde buscar)
- ✅ AWS Region é público (ok, é informação pública)
- ⚠️ Tokens JWT devem ser guardados com segurança (sessionStorage ou localStorage)

---

**Última atualização:** 17/02/2026
**Status:** Ready para testes
