# 🚀 Como Rodar o FastAPI sem Docker

Este guia mostra como executar a aplicação FastAPI localmente, sem usar Docker.

---

## 📋 Pré-requisitos

1. **Python 3.12+** instalado
2. **pip** (gerenciador de pacotes Python)
3. **Conexão VPN** (para acessar o CouchDB remoto)
4. **Acesso ao servidor CouchDB**: `https://admin:wyrd@db.vpn.ind.br`

---

## 🔧 Passo a Passo

### 1️⃣ Criar Ambiente Virtual (Recomendado)

```bash
# Navegar para a pasta do projeto
cd fast-api-lindsay

# Criar ambiente virtual
python3 -m venv venv

# Ativar ambiente virtual
# Linux/Mac:
source venv/bin/activate

# Windows:
# venv\Scripts\activate
```

### 2️⃣ Instalar Dependências

```bash
# Com o ambiente virtual ativado
pip install --upgrade pip
pip install -r requirements.txt
```

### 3️⃣ Configurar Variáveis de Ambiente (Opcional)

Crie um arquivo `.env` na raiz do projeto `fast-api-lindsay/`:

```bash
# .env
ENVIRONMENT=development
DEBUG=true

# CouchDB Remoto
COUCHDB_URL=https://admin:wyrd@db.vpn.ind.br
COUCHDB_DB=lindsay-data

# JWT
JWT_SECRET=your-secret-key-here-change-in-production
JWT_EXPIRATION_HOURS=24

# MQTT (se necessário)
MQTT_BROKER=localhost
MQTT_PORT=1883
MQTT_TOPIC=pivo/+/dados
MQTT_QOS=1
MQTT_CLIENT_ID=lindsay-api

# Workers
WORKER_COUNT=8
QUEUE_MAXSIZE=5000

# Logging
LOG_LEVEL=INFO
```

**Nota**: Se não criar o `.env`, a aplicação usará os valores padrão definidos em `app/core/config.py`.

### 4️⃣ Verificar Conexão com CouchDB

Antes de rodar, certifique-se de que:
- ✅ Você está conectado à VPN
- ✅ O servidor CouchDB está acessível

Teste a conexão:

```bash
# Teste rápido (se tiver curl instalado)
curl https://admin:wyrd@db.vpn.ind.br/_up

# Ou use o script de validação
python scripts/validate_database.py
```

### 5️⃣ Rodar a Aplicação

#### Opção A: Usando o script principal (Recomendado)

```bash
python main.py
```

Isso iniciará o servidor na porta **8000** com reload automático em modo desenvolvimento.

#### Opção B: Usando uvicorn diretamente

```bash
# Modo desenvolvimento (com reload)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Modo produção (sem reload)
uvicorn main:app --host 0.0.0.0 --port 8000
```

#### Opção C: Com configurações customizadas

```bash
uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --log-level info \
  --reload-dir app
```

---

## ✅ Verificar se Está Funcionando

### 1. Health Check

```bash
curl http://localhost:8000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "app": "Lindsay API"
}
```

### 2. Documentação Interativa

Abra no navegador:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 3. Verificar Logs

Você deve ver algo como:

```
╔═══════════════════════════════════════════════════════════╗
║         Lindsay API - FastAPI v2.0                        ║
║  Sistema Multi-Nível: Admin → Revenda → Cliente → Pivôs   ║
║  Environment: development                                 ║
║  CouchDB: https://admin:wyrd@db.vpn.ind.br              ║
╚═══════════════════════════════════════════════════════════╝
✅ CouchDB conectado: lindsay-data
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

---

## 🛠️ Solução de Problemas

### Erro: "ModuleNotFoundError"

```bash
# Certifique-se de que o ambiente virtual está ativado
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Reinstale as dependências
pip install -r requirements.txt
```

### Erro: "Connection refused" ou "Failed to connect to CouchDB"

1. Verifique se está conectado à VPN
2. Teste a conexão manualmente:
   ```bash
   curl https://admin:wyrd@db.vpn.ind.br/_up
   ```
3. Verifique se o banco `lindsay-data` existe no servidor

### Erro: "Port 8000 already in use"

```bash
# Use outra porta
uvicorn main:app --port 8001

# Ou mate o processo na porta 8000
# Linux/Mac:
lsof -ti:8000 | xargs kill -9

# Windows:
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Erro: "SSL Certificate verification failed"

Se você estiver em desenvolvimento e o certificado SSL não for confiável, pode temporariamente desabilitar a verificação (NÃO recomendado para produção):

```python
# Em app/core/database.py (temporário, apenas para dev)
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
```

---

## 📝 Comandos Úteis

### Rodar em Background (Linux/Mac)

```bash
# Usando nohup
nohup python main.py > api.log 2>&1 &

# Ou usando screen
screen -S lindsay-api
python main.py
# Pressione Ctrl+A depois D para detachar
```

### Ver Logs em Tempo Real

```bash
# Se rodou em background
tail -f api.log
```

### Parar a Aplicação

```bash
# Se estiver rodando no terminal
# Pressione Ctrl+C

# Se estiver em background
ps aux | grep "python main.py"
kill <PID>
```

---

## 🔄 Desenvolvimento com Hot Reload

O modo desenvolvimento já está configurado para recarregar automaticamente quando você modificar arquivos:

```bash
python main.py
# ou
uvicorn main:app --reload
```

Qualquer mudança em arquivos `.py` dentro da pasta `app/` fará o servidor reiniciar automaticamente.

---

## 🌐 Acessar de Outros Dispositivos

Se você quiser acessar a API de outros dispositivos na mesma rede:

```bash
# A aplicação já está configurada para aceitar conexões externas
# (host="0.0.0.0")

# Descubra seu IP local
# Linux/Mac:
ifconfig | grep "inet "

# Windows:
ipconfig

# Acesse de outro dispositivo:
# http://<SEU_IP>:8000/docs
```

---

## 📦 Estrutura de Comandos Resumida

```bash
# 1. Criar e ativar ambiente virtual
python3 -m venv venv
source venv/bin/activate  # Linux/Mac

# 2. Instalar dependências
pip install -r requirements.txt

# 3. (Opcional) Criar .env com suas configurações

# 4. Rodar aplicação
python main.py

# 5. Acessar documentação
# http://localhost:8000/docs
```

---

## 🎯 Próximos Passos

1. ✅ API rodando localmente
2. 🔗 Conectar o React App ao FastAPI
3. 🧪 Testar endpoints
4. 📊 Monitorar logs e performance

---

## 💡 Dicas

- Use `--reload` apenas em desenvolvimento
- Em produção, use um servidor WSGI como Gunicorn com Uvicorn workers
- Configure variáveis de ambiente via `.env` para diferentes ambientes
- Monitore os logs para identificar problemas de conexão com CouchDB
- Mantenha o ambiente virtual ativado enquanto desenvolve

---

**Pronto!** Sua API FastAPI está rodando sem Docker! 🚀
