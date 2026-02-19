# 🚀 Lindsay API - FastAPI v2.0

**Sistema Multi-Nível: Admin → Revenda → Cliente → Pivôs**

---

## 📋 Pré-requisitos

```bash
# Python 3.12+
python --version

# Dependências
pip install -r requirements-lindsay.txt
```

---

## 🔧 Configuração

### 1. Copiar arquivo `.env`

```bash
cp .env.example .env
# Editar .env com suas configurações
```

### 2. Setup CouchDB

```bash
# Criar schema e índices
python setup_database_schema.py
python setup_couchdb_indexes.py

# Criar dados de teste
python create_test_data.py
```

### 3. Iniciar API

```bash
# Desenvolvimento (com hot reload)
python main.py

# Ou usando uvicorn diretamente
uvicorn main:app --reload --port 8000
```

---

## 📚 Documentação Interativa

Após iniciar a API, acesse:

```
http://localhost:8000/docs          # Swagger UI
http://localhost:8000/redoc         # ReDoc
```

---

## 🔑 Autenticação

### Token Format

Token é enviado no header `Authorization`:

```
Authorization: Bearer <token>
```

**Formato do token (desenvolvimento):**
```
Base64(<email>:<tipo>)
```

**Exemplo:**
```
Authorization: Bearer Y2xpZW50ZUBlbXByZXNhLmNvbTpjbGllbnRl
```

### Teste de Login

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@empresa.com",
    "password": "Cliente@123"
  }'
```

---

## 📦 Endpoints

### **Autenticação**

#### Registrar Novo Usuário
```
POST /api/auth/register

{
  "email": "novo@empresa.com",
  "password": "Senha@123",
  "name": "Novo Usuário",
  "type": "cliente",
  "domain": "revenda@empresa.com"
}
```

#### Login
```
POST /api/auth/login

{
  "email": "cliente@empresa.com",
  "password": "Cliente@123"
}
```

#### Obter Usuário Atual
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
```

---

### **Revendas (Admin Only)**

#### Listar Revendas
```
GET /api/revendas
Headers: Authorization: Bearer <token>
```

#### Listar Revendas Pendentes
```
GET /api/revendas/pending
Headers: Authorization: Bearer <token>
```

#### Aprovar Revenda
```
POST /api/revendas/{email}/approve
Headers: Authorization: Bearer <token>
```

#### Rejeitar Revenda
```
POST /api/revendas/{email}/reject
Headers: Authorization: Bearer <token>
```

---

### **Clientes (Revenda)**

#### Listar Clientes
```
GET /api/clientes
Headers: Authorization: Bearer <token>
```

#### Listar Clientes Pendentes
```
GET /api/clientes/pending
Headers: Authorization: Bearer <token>
```

#### Aprovar Cliente
```
POST /api/clientes/{email}/approve
Headers: Authorization: Bearer <token>
```

#### Rejeitar Cliente
```
POST /api/clientes/{email}/reject
Headers: Authorization: Bearer <token>
```

---

### **Pivôs (FASE 2)**

#### Listar Pivôs (Filtrado por Role)
```
GET /api/pivos
Headers: Authorization: Bearer <token>

Resposta:
{
  "total": 3,
  "role": "cliente",
  "pivos": [
    {
      "_id": "pivo:cliente@empresa.com:P001:xyz123",
      "codigo": "P001",
      "nome": "Pivô Centro-Oeste",
      "owner_id": "cliente@empresa.com",
      "gerente_id": "revenda@empresa.com",
      "ativo": true,
      "created_at": "2026-02-16T10:00:00+00:00"
    },
    ...
  ]
}
```

#### Criar Pivô (Cliente Only)
```
POST /api/pivos
Headers: Authorization: Bearer <token>

{
  "codigo": "P004",
  "nome": "Novo Pivô",
  "location": {
    "lat": -15.8000,
    "lng": -48.1000
  }
}
```

#### Obter Pivô Específico
```
GET /api/pivos/{pivo_id}
Headers: Authorization: Bearer <token>
```

#### Atualizar Pivô
```
PUT /api/pivos/{pivo_id}
Headers: Authorization: Bearer <token>

{
  "nome": "Pivô Atualizado",
  "ativo": true
}
```

#### Deletar Pivô (Admin Only)
```
DELETE /api/pivos/{pivo_id}
Headers: Authorization: Bearer <token>
```

#### Obter Estatísticas de Pivôs
```
GET /api/pivos-stats
Headers: Authorization: Bearer <token>

Resposta:
{
  "total": 3,
  "ativos": 3,
  "inativos": 0,
  "total_clientes": 1  // Para gerentes
}
```

---

## 🧪 Exemplos de Teste

### 1. Registrar Admin

```bash
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@empresa.com",
    "password": "Admin@123",
    "name": "Administrador",
    "type": "admin"
  }'
```

### 2. Login como Admin

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@empresa.com",
    "password": "Admin@123"
  }'

# Copiar o token da resposta
TOKEN="Y2xpZW50ZUBlbXByZXNhLmNvbTpjbGllbnRl"
```

### 3. Listar Todos os Pivôs (Admin)

```bash
curl -X GET "http://localhost:8000/api/pivos" \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Criar Novo Pivô (Cliente)

```bash
curl -X POST "http://localhost:8000/api/pivos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "P005",
    "nome": "Meu Novo Pivô",
    "location": {
      "lat": -15.8500,
      "lng": -48.1200
    }
  }'
```

---

## 🔐 Permissões por Role

| Endpoint | Admin | Gerente | Cliente |
|----------|-------|---------|---------|
| GET /api/revendas | ✅ | ❌ | ❌ |
| POST /api/revendas/*/approve | ✅ | ❌ | ❌ |
| GET /api/clientes | ✅ | ✅ | ❌ |
| POST /api/clientes/*/approve | ✅ | ✅ | ❌ |
| GET /api/pivos | ✅ (todos) | ✅ (seus clientes) | ✅ (seus) |
| POST /api/pivos | ✅ | ❌ | ✅ |
| PUT /api/pivos/* | ✅ | ❌ | ✅ (seus) |
| DELETE /api/pivos/* | ✅ | ❌ | ❌ |

---

## 🚀 Deployment

### Production (Gunicorn + Uvicorn)

```bash
pip install gunicorn

gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --env JWT_SECRET=your-secret-key
```

### Docker

```dockerfile
FROM python:3.12

WORKDIR /app

COPY requirements-lindsay.txt .
RUN pip install -r requirements-lindsay.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 📊 Estrutura de Arquivos

```
Lightsail_python_files/new/
├── main.py                      # ✨ API FastAPI (NOVO)
├── requirements-lindsay.txt     # ✅ Atualizado com FastAPI
├── .env.example                 # ✨ Variáveis de ambiente (NOVO)
├── auth_service.py              # ✅ Autenticação
├── permissions.py               # ✅ Controle de acesso
├── pivo_service.py              # ✅ Gerenciamento de pivôs
├── setup_database_schema.py     # ✅ Schema CouchDB
├── setup_couchdb_indexes.py     # ✅ Índices
├── create_test_data.py          # ✅ Dados de teste
├── lindsay_parsed.py            # ✅ MQTT listener (legacy)
├── push_notifications.py        # ✅ Notificações
└── simulator.py                 # ✅ Simulador de dados
```

---

## 🔄 Fluxo de Requisição

```
Cliente HTTP
    ↓
FastAPI Middleware (CORS)
    ↓
Route Handler (/api/*)
    ↓
get_current_user() - Validar Token
    ↓
PermissionChecker - Verificar Role
    ↓
Service (AuthService, PivoService)
    ↓
CouchDB
    ↓
Response JSON
```

---

## 🐛 Troubleshooting

### Erro: "CouchDB connection refused"

```bash
# Verificar se CouchDB está rodando
curl http://localhost:5984/

# Iniciar CouchDB (Docker)
docker run -d -p 5984:5984 couchdb
```

### Erro: "Token inválido"

```bash
# Verificar formato do token
# Deve ser Base64(<email>:<type>)

python3 -c "import base64; print(base64.b64encode(b'cliente@empresa.com:cliente').decode())"
```

### Erro: "Acesso negado"

```bash
# Verificar role do usuário e permissões
# GET /api/auth/me para verificar user type
```

---

## 📖 Documentação Relacionada

- [QUICK_START_E2E.md](../../../QUICK_START_E2E.md) - Guia rápido
- [E2E_TEST_FLOW.md](../../../E2E_TEST_FLOW.md) - Fluxo completo
- [IMPLEMENTATION_SUMMARY.md](../../../IMPLEMENTATION_SUMMARY.md) - Resumo de implementação

---

**Versão:** 2.0.0 (FastAPI)
**Última atualização:** 16/02/2026
**Status:** ✅ Production Ready
