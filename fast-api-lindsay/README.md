# 🚀 Lindsay FastAPI v2.0

**Sistema Multi-Nível: Admin → Revenda → Cliente → Pivôs**

Aplicação FastAPI totalmente refatorada com estrutura profissional e modular.

---

## 📁 Estrutura do Projeto

```
fast-api-lindsay/
├── main.py                      # Aplicação FastAPI principal
├── requirements.txt             # Dependências Python
├── Dockerfile                   # Para containerização
├── docker-compose.yml          # Dev environment com CouchDB + MQTT
├── .env.example                # Variáveis de ambiente
├── README.md                   # Este arquivo
│
└── app/
    ├── __init__.py
    ├── core/                   # Configuração, DB, Security
    │   ├── config.py          # Pydantic Settings
    │   ├── database.py        # Conexão CouchDB
    │   └── __init__.py
    │
    ├── models/                # Schemas Pydantic
    │   ├── schemas.py         # Todos os modelos
    │   └── __init__.py
    │
    ├── services/              # Business Logic
    │   ├── auth.py           # Autenticação (copiado de new/)
    │   ├── permissions.py    # Controle de acesso
    │   ├── pivo.py           # Gerenciamento de pivôs
    │   └── __init__.py
    │
    └── api/                   # API Routes
        ├── routes/
        │   ├── auth.py       # POST /api/auth/*
        │   ├── revendas.py   # GET/POST /api/revendas/*
        │   ├── clientes.py   # GET/POST /api/clientes/*
        │   ├── pivos.py      # GET/POST /api/pivos/*
        │   └── __init__.py
        └── __init__.py

└── tests/                     # Testes unitários
    └── __init__.py
```

---

## 🚀 Quick Start

### 1️⃣ Preparar Ambiente

```bash
# Clonar/cria pasta
cd fast-api-lindsay

# Copiar env
cp .env.example .env

# Instalar dependências
pip install -r requirements.txt
```

### 2️⃣ Rodar com Docker Compose (Recomendado)

```bash
# Levanta CouchDB + MQTT + API
docker-compose up -d

# Aguardar ~10s para inicialização
sleep 10

# Verificar saúde
curl http://localhost:8000/health

# Acessar documentação
open http://localhost:8000/docs
```

### 3️⃣ Rodar Localmente (Desenvolvimento)

```bash
# Certificar que CouchDB e MQTT estão rodando
# CouchDB: http://localhost:5984
# MQTT: localhost:1883

# Rodar API
python main.py

# Ou com uvicorn diretamente
uvicorn main:app --reload --port 8000

# Acessar documentação
open http://localhost:8000/docs
```

---

## 🔑 Autenticação

### Fluxo

1. **Register** → Criar usuário (Admin/Revenda/Cliente)
2. **Login** → Obter token
3. **Usar Token** → Em todo request como `Authorization: Bearer <token>`

### Exemplo

```bash
# 1. Register
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@empresa.com",
    "password": "Admin@123",
    "name": "Administrador",
    "type": "admin"
  }'

# 2. Login
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@empresa.com",
    "password": "Admin@123"
  }'

# Copiar o token da resposta
TOKEN="Y2xpZW50ZUBlbXByZXNhLmNvbTpjbGllbnRl"

# 3. Usar Token
curl -X GET "http://localhost:8000/api/pivos" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📚 API Endpoints

### **Autenticação**
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Fazer login
- `GET /api/auth/me` - Dados do usuário atual

### **Revendas** (Admin only)
- `GET /api/revendas` - Listar revendas
- `GET /api/revendas/pending` - Revendas pendentes
- `POST /api/revendas/{email}/approve` - Aprovar
- `POST /api/revendas/{email}/reject` - Rejeitar

### **Clientes** (Revenda/Admin)
- `GET /api/clientes` - Listar clientes
- `GET /api/clientes/pending` - Clientes pendentes
- `POST /api/clientes/{email}/approve` - Aprovar
- `POST /api/clientes/{email}/reject` - Rejeitar

### **Pivôs** (FASE 2)
- `GET /api/pivos` - Listar pivôs (filtrado por role)
- `POST /api/pivos` - Criar pivô (cliente only)
- `GET /api/pivos/{pivo_id}` - Get pivô
- `PUT /api/pivos/{pivo_id}` - Atualizar pivô
- `DELETE /api/pivos/{pivo_id}` - Deletar (admin only)
- `GET /api/pivos/stats` - Estatísticas

---

## 🔐 Permissões

| Operação | Admin | Gerente | Cliente |
|----------|-------|---------|---------|
| Listar Revendas | ✅ | ❌ | ❌ |
| Aprovar Revendas | ✅ | ❌ | ❌ |
| Listar Clientes | ✅ | ✅ | ❌ |
| Aprovar Clientes | ✅ | ✅ | ❌ |
| Listar Pivôs | Todos | Seus clientes | Seus |
| Criar Pivô | ✅ | ❌ | ✅ |
| Editar Pivô | ✅ | ❌ | Seus |
| Deletar Pivô | ✅ | ❌ | ❌ |

---

## 🔧 Desenvolvimento

### Adicionar Nova Rota

1. Criar arquivo em `app/api/routes/minha_rota.py`
2. Importar em `main.py`
3. Registrar com `app.include_router()`

**Exemplo:**

```python
# app/api/routes/minha_rota.py
from fastapi import APIRouter, Depends
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/minha-rota")

@router.get("")
async def my_endpoint(user: dict = Depends(get_current_user)):
    return {"message": "Olá"}
```

```python
# main.py
from app.api.routes import minha_rota

app.include_router(minha_rota.router, prefix=settings.API_PREFIX)
```

### Adicionar Novo Schema

```python
# app/models/schemas.py
class MeuSchema(BaseModel):
    campo1: str
    campo2: int
```

### Usar Database

```python
from app.core.database import get_db

db = get_db()
doc = db["doc_id"]
```

---

## 📊 Exemplo Completo: Criar e Listar Pivôs

### Passo 1: Login como Cliente

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@empresa.com",
    "password": "Cliente@123"
  }' \
  | jq .access_token | tr -d '"' > token.txt

TOKEN=$(cat token.txt)
```

### Passo 2: Criar Pivô

```bash
curl -X POST "http://localhost:8000/api/pivos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "P001",
    "nome": "Meu Novo Pivô",
    "location": {"lat": -15.8, "lng": -48.1}
  }'
```

### Passo 3: Listar Pivôs

```bash
curl -X GET "http://localhost:8000/api/pivos" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## 🧪 Testes

```bash
# Rodar testes unitários
pytest tests/

# Com cobertura
pytest tests/ --cov=app

# Modo watch
pytest-watch tests/
```

---

## 🚀 Deployment

### Produção com Gunicorn + Uvicorn

```bash
pip install gunicorn

gunicorn main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --env JWT_SECRET=seu-secret-seguro
```

### Docker Build & Run

```bash
# Build image
docker build -t lindsay-api:latest .

# Run container
docker run -p 8000:8000 \
  -e COUCHDB_URL=http://couchdb:5984 \
  -e JWT_SECRET=seu-secret-seguro \
  lindsay-api:latest
```

### Docker Compose (Production)

```bash
# Build + Run
docker-compose -f docker-compose.yml up -d

# Logs
docker-compose logs -f api

# Stop
docker-compose down
```

---

## 🔗 Relacionados

- [Documentação API Original](../API_README.md)
- [Guia E2E](../../QUICK_START_E2E.md)
- [Implementação](../../IMPLEMENTATION_SUMMARY.md)

---

## 📝 Notas

- CouchDB está em `http://localhost:5984` quando rodando com Docker
- MQTT está em `mosquitto:1883` quando rodando com Docker
- Docs automáticos em `/docs` (Swagger) e `/redoc`
- OpenAPI schema em `/openapi.json`

---

**Versão:** 2.0.0 (FastAPI Refactored)
**Status:** ✅ Production Ready
**Última atualização:** 16/02/2026
