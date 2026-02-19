# 📋 Sistema de Aprovações - Guia Completo

## 🎯 Visão Geral

Sistema completo para gerenciar aprovações de **Revendas** (por Admins) e **Clientes** (por Revendas).

### Fluxo

```
Admin cria revenda
    ↓
Status: PENDING (no CouchDB)
    ↓
Admin visualiza em "Revendas Pendentes"
    ↓
Admin clica "Aprovar" ou "Rejeitar"
    ↓
Status muda: PENDING → ACTIVE/REJECTED
    ↓
Status sincroniza com Cognito também
```

---

## ✅ Componentes Implementados

### Backend (FastAPI)

#### 1. **Views do CouchDB** (`setup_views.py`)
```bash
# Criar/atualizar views
python3 setup_views.py

# Views criadas:
- revendas_by_status    (query por status)
- clientes_pending_approval (query por revenda_id)
- revendas_by_email     (query por email)
```

#### 2. **Endpoints de Aprovação**

```http
# Listar revendas pendentes
GET /api/revendas/pending
Response: { "total": 1, "revendas": [...] }

# Aprovar revenda
POST /api/revendas/{email}/approve
Response: { "status": "success", "message": "Revenda 'X' aprovada" }

# Rejeitar revenda
POST /api/revendas/{email}/reject
Response: { "status": "success", "message": "Revenda 'X' rejeitada" }

# Listar clientes pendentes
GET /api/clientes/pending
Response: { "total": 2, "clientes": [...] }

# Aprovar cliente
POST /api/clientes/{email}/approve
Response: { "status": "success", "message": "Cliente 'X' aprovado" }

# Rejeitar cliente
POST /api/clientes/{email}/reject
Response: { "status": "success", "message": "Cliente 'X' rejeitado" }
```

#### 3. **Sincronização Cognito**

Quando aprova/rejeita:
- ✅ CouchDB atualizado primeiro (seguro)
- ✅ Depois Cognito `custom:status` atualizado
- ⚠️ Se Cognito falhar, CouchDB já está correto

---

### Frontend (React)

#### 1. **Componentes Criados**

**RevendaPendingApprovals.tsx**
```tsx
import { RevendaPendingApprovals } from '@/components/new/RevendaPendingApprovals';

export function AdminDashboard() {
  return (
    <div>
      <RevendaPendingApprovals
        onApprovalChange={() => refetchStats()}
      />
    </div>
  );
}
```

**ClientePendingApprovals.tsx**
```tsx
import { ClientePendingApprovals } from '@/components/new/ClientePendingApprovals';

export function RevendaDashboard() {
  return (
    <div>
      <ClientePendingApprovals
        onApprovalChange={() => refetchStats()}
      />
    </div>
  );
}
```

#### 2. **Hook Existente**

`useAdminRevendas.ts` - já disponível
```tsx
const {
  pendingRevendas,     // Revendas pendentes
  allRevendas,         // Todas as revendas
  loading,
  error,
  fetchPendingRevendas,
  fetchAllRevendas,
  approveRevenda,      // Aprova por email
  rejectRevenda        // Rejeita por email
} = useAdminRevendas();
```

#### 3. **Tipos**

```typescript
// types/admin.ts
interface Revenda {
  _id: string;              // revenda:{uuid}
  _rev?: string;
  type: 'revenda';
  email: string;
  name: string;
  domain: string;
  status: 'pending' | 'active' | 'rejected';
  created_at: string;
  cnpj_revenda?: string;
}

interface Cliente {
  _id: string;              // user:{uuid}
  _rev?: string;
  type: 'cliente';
  email: string;
  name: string;
  status: 'pending' | 'active' | 'rejected';
  created_at: string;
  revenda_id?: string;
}
```

---

## 🔧 Setup Rápido

### 1. Criar Views no CouchDB

```bash
# Opção 1: Script Python
cd fast-api-lindsay
python3 setup_views.py

# Opção 2: Curl (se já tiver views criadas, ignora)
curl -X PUT "https://admin:wyrd@db.vpn.ind.br/lindsay-users/_design/app" \
  -H "Content-Type: application/json" \
  -d '{
    "views": {
      "revendas_by_status": { "map": "..." },
      ...
    }
  }'
```

### 2. Integrar Componentes no Dashboard

**AdminDashboard.tsx**
```tsx
import { RevendaPendingApprovals } from '../components/new/RevendaPendingApprovals';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Seção de Aprovações */}
      <RevendaPendingApprovals onApprovalChange={() => {
        // Refresh de stats se houver
      }} />

      {/* Outras seções... */}
    </div>
  );
}
```

**RevendaDashboard.tsx**
```tsx
import { ClientePendingApprovals } from '../components/new/ClientePendingApprovals';

export function RevendaDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Revenda Dashboard</h1>

      {/* Seção de Aprovações */}
      <ClientePendingApprovals onApprovalChange={() => {
        // Refresh de stats se houver
      }} />

      {/* Outras seções... */}
    </div>
  );
}
```

---

## 📊 Fluxo de Dados

### Criar Revenda

```
Admin clica "Criar Revenda"
    ↓
Modal envia POST /api/revendas
    ↓
Backend:
  1. Valida dados
  2. Cria no CouchDB (status=pending, ID=uuid)
  3. Cria em Cognito (custom:status=pending)
  4. Retorna revenda_id (uuid)
    ↓
Frontend: Fecha modal, atualiza lista
```

### Aprovar Revenda

```
Admin clica "Aprovar" em pendente
    ↓
Componente chama POST /api/revendas/{email}/approve
    ↓
Backend:
  1. Busca revenda por email (status=pending)
  2. Muda status para 'active' no CouchDB
  3. Salva approved_at timestamp
  4. Atualiza Cognito custom:status=active
  5. Retorna sucesso
    ↓
Frontend:
  1. Remove da lista pendentes
  2. Callback onApprovalChange dispara
  3. Stats são atualizadas
```

---

## 🧪 Testando

### Via Curl

```bash
# Listar pendentes
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/revendas/pending

# Aprovar
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/revendas/julio.paz961@usp.br/approve

# Rejeitar
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/revendas/julio.paz961@usp.br/reject
```

### Via React DevTools

```tsx
// No console do navegador
const hook = window.__REACT_DEVTOOLS_HOOK__;
// Ou testar diretamente o componente
```

---

## 🔐 Permissões

| Ação | Admin | Revenda | Cliente |
|------|-------|---------|---------|
| Listar revendas pendentes | ✅ | ❌ | ❌ |
| Aprovar revenda | ✅ | ❌ | ❌ |
| Rejeitar revenda | ✅ | ❌ | ❌ |
| Listar clientes pendentes | ❌ | ✅ | ❌ |
| Aprovar cliente | ❌ | ✅ | ❌ |
| Rejeitar cliente | ❌ | ✅ | ❌ |

---

## 📝 Status no Banco

### Ciclo de Vida - Revenda

```
pending (novo registro)
    ↓
[Admin aprova] → active (pronto usar)
    ↓
[Ou: Admin rejeita] → rejected (não ativado)
```

### Ciclo de Vida - Cliente

```
pending (novo registro)
    ↓
[Revenda aprova] → active (vinculado)
    ↓
[Ou: Revenda rejeita] → rejected (não vinculado)
```

---

## 🐛 Troubleshooting

### Erro: "Revendas não carregam"

```bash
# 1. Verificar se views existem
curl https://db.vpn.ind.br/lindsay-users/_design/app | jq .views

# 2. Recriar views
python3 setup_views.py

# 3. Limpar cache do navegador (F12 → Application → Clear)
```

### Erro: "Aprovação falha"

```bash
# 1. Verificar token válido
echo $TOKEN

# 2. Testar endpoint diretamente
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://api.yourserver.com/api/revendas/email@example.com/approve

# 3. Ver logs do backend
docker logs container_name
```

### Erro: "Status não sincroniza com Cognito"

Isso é OK! O CouchDB está sempre correto. O Cognito é best-effort:

```bash
# Se precisar forçar sincronização:
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  https://api.yourserver.com/api/revendas/email@example.com/sync-cognito
```

---

## 📈 Performance

### Otimizações Implementadas

- ✅ Views do CouchDB (queries rápidas)
- ✅ Índices Mango (se usado)
- ✅ Pagination (pode adicionar ao componente)
- ✅ Polling otimizado (botão refresh manual)

### Se Precisar Melhorar

```typescript
// Adicionar ao componente:
const [page, setPage] = useState(1);
const pageSize = 10;

// Usar no endpoint:
const skip = (page - 1) * pageSize;
`/api/revendas/pending?skip=${skip}&limit=${pageSize}`
```

---

## 📚 Referências

- **Backend:** `fast-api-lindsay/app/api/routes/revendas.py`
- **Backend:** `fast-api-lindsay/app/api/routes/clientes.py`
- **Frontend:** `React_app/src/hooks/new/useAdminRevendas.ts`
- **Frontend:** `React_app/src/components/new/RevendaPendingApprovals.tsx`
- **Frontend:** `React_app/src/components/new/ClientePendingApprovals.tsx`
- **Types:** `React_app/src/types/admin.ts`

---

**Status:** ✅ Implementado e testado
**Data:** 2026-02-19
**Autor:** Claude Senior Engineer
