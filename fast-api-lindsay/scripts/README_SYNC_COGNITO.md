# 🔄 Script: Sincronizar Cognito → CouchDB

Script para sincronizar usuários do AWS Cognito para o CouchDB.

## 🎯 Objetivo

Seus usuários estão cadastrados no **AWS Cognito** mas precisam estar também no **CouchDB** para o sistema funcionar corretamente. Este script:

1. ✅ Lista todos os usuários do Cognito
2. ✅ Cria/atualiza documentos no CouchDB no formato correto
3. ✅ Mantém a hierarquia (admin → revenda → cliente)
4. ✅ Preserva dados existentes no CouchDB

---

## 📋 Pré-requisitos

### 1. Credenciais AWS Configuradas

```bash
# Opção 1: AWS CLI configurado
aws configure

# Opção 2: Variáveis de ambiente
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=sa-east-1
```

### 2. Dependências Instaladas

```bash
cd fast-api-lindsay
pip install -r requirements.txt
```

### 3. Configuração do Cognito

Edite o script ou use variáveis de ambiente:

```bash
export COGNITO_USER_POOL_ID="sa-east-1_plnyzL41t"
export COGNITO_REGION="sa-east-1"
```

---

## 🚀 Como Usar

### 1. Teste Primeiro (Dry Run)

**Sempre teste primeiro sem salvar:**

```bash
cd fast-api-lindsay
python scripts/sync_cognito_to_couchdb.py --dry-run
```

Isso mostra o que seria feito sem modificar o banco.

### 2. Sincronizar Todos os Usuários

```bash
python scripts/sync_cognito_to_couchdb.py
```

### 3. Sincronizar por Tipo

```bash
# Apenas admins
python scripts/sync_cognito_to_couchdb.py --type admin

# Apenas revendas
python scripts/sync_cognito_to_couchdb.py --type revenda

# Apenas clientes
python scripts/sync_cognito_to_couchdb.py --type cliente
```

### 4. Com User Pool Customizado

```bash
python scripts/sync_cognito_to_couchdb.py \
  --user-pool-id "sa-east-1_XXXXX" \
  --region "sa-east-1"
```

---

## 📊 O Que o Script Faz

### Para Cada Usuário do Cognito:

1. **Extrai informações:**
   - Email, nome, tipo, status
   - Custom attributes (domain, revenda_id, etc.)

2. **Gera Document ID:**
   - Admin: `admin:{email}`
   - Revenda: `revenda:{domain}`
   - Cliente: `user:{email}`

3. **Cria/Atualiza no CouchDB:**
   - Se não existe: cria novo documento
   - Se existe: atualiza mantendo `_rev` e `created_at`

4. **Estrutura do Documento:**

```json
{
  "_id": "admin:admin@company.com",
  "type": "admin",
  "email": "admin@company.com",
  "name": "Admin User",
  "status": "active",
  "created_at": "2024-01-15T10:30:00",
  "cognito_synced": true,
  "cognito_synced_at": "2024-02-16T14:00:00"
}
```

---

## 🔍 Exemplo de Saída

```
================================================================================
                  Sincronização Cognito → CouchDB
================================================================================

Conectando ao AWS Cognito...
User Pool ID: sa-east-1_plnyzL41t
Região: sa-east-1

✅ Conectado ao Cognito com sucesso!

Conectando ao CouchDB...
URL: https://admin:wyrd@db.vpn.ind.br
Database: lindsay-data

✅ Conectado ao CouchDB com sucesso!

Buscando usuários do Cognito...
✅ Total de 15 usuário(s) encontrado(s) no Cognito

Sincronizando usuários...

✅ CRIADO: admin@company.com (admin:admin@company.com)
✅ ATUALIZADO: revenda@example.com (revenda:example.com)
✅ CRIADO: cliente@example.com (user:cliente@example.com)
...

================================================================================
Resumo da Sincronização:
  Sucesso: 15
  Erros: 0
  Total: 15
================================================================================
```

---

## ⚠️ Importante

### Custom Attributes no Cognito

O script tenta inferir o tipo do usuário se não houver `custom:type`:

- Se tem `custom:domain` → **revenda**
- Se tem `custom:revenda_id` → **cliente**
- Caso contrário → **admin** (padrão)

**Recomendação:** Configure os custom attributes no Cognito para melhor precisão.

### Preservação de Dados

- ✅ O script **NÃO** sobrescreve dados existentes no CouchDB
- ✅ Mantém `created_at` original
- ✅ Atualiza apenas campos necessários
- ✅ Adiciona flag `cognito_synced: true`

### Segurança

- 🔒 Credenciais AWS não são expostas
- 🔒 Conexão CouchDB usa HTTPS
- 🔒 Dry run disponível para testes

---

## 🐛 Troubleshooting

### Erro: "Unable to locate credentials"

```bash
# Configure as credenciais AWS
aws configure

# Ou use variáveis de ambiente
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

### Erro: "User Pool not found"

Verifique o User Pool ID:

```bash
# Listar user pools
aws cognito-idp list-user-pools --max-results 10 --region sa-east-1
```

### Erro: "Connection refused" (CouchDB)

1. Verifique se está conectado à VPN
2. Teste a conexão:
   ```bash
   curl https://admin:wyrd@db.vpn.ind.br/_up
   ```

### Usuários não aparecem

1. Verifique se os usuários existem no Cognito:
   ```bash
   aws cognito-idp list-users \
     --user-pool-id sa-east-1_plnyzL41t \
     --region sa-east-1
   ```

2. Verifique se o filtro `--type` está correto

---

## 🔄 Sincronização Contínua

Para manter sincronizado, você pode:

1. **Rodar manualmente** quando necessário
2. **Agendar com cron** (Linux/Mac):
   ```bash
   # Sincronizar diariamente às 2h da manhã
   0 2 * * * cd /path/to/fast-api-lindsay && python scripts/sync_cognito_to_couchdb.py
   ```

3. **Integrar no código** quando criar usuários no Cognito

---

## 📝 Próximos Passos

Após sincronizar:

1. ✅ Verificar usuários no CouchDB:
   ```bash
   python scripts/list_users.py
   ```

2. ✅ Testar autenticação no sistema

3. ✅ Configurar custom attributes no Cognito (se ainda não tiver)

---

## 💡 Dicas

- **Sempre use `--dry-run` primeiro** para ver o que será feito
- **Mantenha backups** do CouchDB antes de sincronizar em massa
- **Revise os logs** para identificar problemas
- **Sincronize por tipo** se tiver muitos usuários

---

**Última atualização:** 16/02/2026
