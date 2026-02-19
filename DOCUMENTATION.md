# 📚 DOCUMENTAÇÃO COMPLETA - SISTEMA LINDSAY

**Data:** 17/02/2026 | **Status:** 🟢 PRONTO PARA PRODUÇÃO

---

## 📖 Índice
1. [Fluxo de Login](#-fluxo-de-login)
2. [Dashboards Implementados](#-dashboards-implementados)
3. [Arquitetura de Dados](#-arquitetura-de-dados)
4. [Como Testar](#-como-testar)
5. [Troubleshooting](#-troubleshooting)

---

## 🔐 Fluxo de Login

### Visão Geral
O sistema possui 3 camadas de hierarquia autenticadas via AWS Cognito:
- **Admin** - Root acesso (super admin)
- **Revenda** - Gerenciador intermediário
- **Cliente** - Usuário final

### Processo Detalhado

```
1. Usuário acessa /login
2. Entra email + senha
3. Cognito autentica
4. auth.js decodifica IdToken e identifica tipo
5. Zustand authStore persiste dados (sessionStorage)
6. SignIn.jsx redireciona baseado em type:
   ✅ admin    → /admin (AdminDashboard)
   ✅ revenda  → /revenda (RevendaDashboard)
   ✅ cliente  → /cliente (ClienteDashboard)
7. ProtectedRoute verifica isAuthenticated
8. PermissionGuard verifica role + status
9. Dashboard renderiza com dados da API
```

### Identificação de Tipo

**Priority order:**
1. `custom:type` no JWT (se existir no Cognito)
2. `cognito:groups[0]` no JWT
3. Email conhecido (`admin@company.com` = admin)
4. Lookup no CouchDB:
   - `admin:email` → admin
   - `revenda:domain` → revenda
   - `user:email` → cliente
5. **Fallback:** cliente (padrão)

### Obtenção de Status

**Priority order:**
1. `custom:status` no JWT (se existir)
2. Lookup no CouchDB por `doc_id`
3. **Admin:** sempre `'active'`
4. **Outros:** `'active'` se não encontrado

---

## 🎯 Dashboards Implementados

### 🏛️ AdminDashboard (`/admin`)

**Permissão:** `admin` role + `active` status

**Componentes:**

#### Stats Grid (6 cards)
```
├── Total de Revendas (+ ativas)
├── Revendas Pendentes (+ rejeitadas)
├── Total de Clientes (+ ativos)
├── Clientes Pendentes (+ rejeitados)
├── Total de Pivôs (+ ativos)
└── Pivôs Alarmados (+ em manutenção)
```

#### Approval Queue
- Lista **revendas com status 'pending'**
- Botões: Aprovar / Rejeitar
- Auto-refresh de stats

#### Revendas Section
- Filtro por status (Todas, Ativas, Pendentes, Rejeitadas)
- Info: email, nome, domínio, status
- Overflow scrollável

#### Clientes Section
- Filtro por status
- Info: email, nome, revenda_id
- Overflow scrollável

#### Pivôs Section
- Status de todos os pivôs do sistema

---

### 🏢 RevendaDashboard (`/revenda`)

**Permissão:** `revenda` role + `active` status (bloqueado se pending/rejected)

**Componentes:**

#### Stats Grid (4 cards)
```
├── Total de Clientes (+ ativos)
├── Clientes Pendentes
├── Total de Pivôs (+ ativos)
└── Pivôs Alarmados
```

#### Approval Queue
- Lista **clientes com status 'pending'** da revenda
- Botões: Aprovar / Rejeitar
- Auto-refresh de stats

#### Meus Clientes Section
- Filtro por status
- Info: email, nome
- Overflow scrollável

#### Pivôs Section
- Pivôs dos seus clientes

---

### 👤 ClienteDashboard (`/cliente`)

**Permissão:** `cliente` role (sem `requireActive` - permite pending)

**Componentes:**

#### Pending Approval Alert
- Mostra se status = 'pending'
- Sem bloqueio de acesso

#### Stats Grid (4 cards)
```
├── Total de Pivôs
├── Pivôs Ativos
├── Pivôs Alarmados
└── Em Manutenção
```

#### Meus Pivôs Section
- Filtro por status (Todos, Ativos, Inativos, Manutenção, Alarmados)
- Info: nome, ID, último dado
- Overflow scrollável

#### Alertas Section
- Placeholder para futuras integrações
- Atualmente mostra "Sem alertas no momento"

---

## 🗂️ Arquitetura de Dados

### Entities no CouchDB

**Revenda:**
```typescript
{
  _id: "revenda:domain.com",
  type: "revenda",
  email: string,
  name: string,
  domain: string,
  status: "active" | "pending" | "rejected",
  created_at: ISO8601,
  cnpj?: string
}
```

**Cliente:**
```typescript
{
  _id: "user:email@domain.com",
  type: "cliente",
  email: string,
  name: string,
  status: "active" | "pending" | "rejected",
  created_at: ISO8601,
  revenda_id?: string
}
```

**Pivô:**
```typescript
{
  _id: "pivo:abc123",
  type: "pivo",
  name: string,
  status: "active" | "inactive" | "alarmed" | "maintenance",
  owner_id: string, // cliente_id
  created_at: ISO8601,
  last_data?: ISO8601
}
```

### API Endpoints

**Revendas:**
```
GET  /api/revendas              → RevendasListResponse
GET  /api/revendas/pending      → { revendas: Revenda[] }
POST /api/revendas/{email}/approve → { status, revenda }
POST /api/revendas/{email}/reject  → { status, revenda }
```

**Clientes:**
```
GET  /api/clientes              → { clientes: Cliente[] }
GET  /api/clientes/pending      → { clientes: Cliente[] }
POST /api/clientes/{email}/approve → { status, cliente }
POST /api/clientes/{email}/reject  → { status, cliente }
```

**Pivôs:**
```
GET  /api/pivos                 → { pivos: Pivo[] }
```

---

## 🔧 Hooks Personalizados

### Admin Hooks

**`useAdminRevendas()`**
```typescript
{
  pendingRevendas: Revenda[],
  allRevendas: Revenda[],
  loading: boolean,
  error: string | null,
  fetchPendingRevendas(): Promise<void>,
  fetchAllRevendas(): Promise<void>,
  approveRevenda(email: string): Promise<void>,
  rejectRevenda(email: string): Promise<void>
}
```

**`useAdminStats()`**
```typescript
{
  stats: AdminStats | null,
  loading: boolean,
  error: string | null,
  fetchStats(): Promise<void>
}
```

**`useAdminClientes()`**
```typescript
{
  clientes: Cliente[],
  loading: boolean,
  error: string | null,
  fetchClientes(): Promise<void>
}
```

### Revenda Hooks

**`useRevendaClientes()`**
- `fetchClientes()`, `fetchPendingClientes()`
- `approveCliente(email)`, `rejectCliente(email)`

**`useRevendaStats()`**
- `fetchStats()` → RevendaStats

### Cliente Hooks

**`useClientePivos()`**
- `fetchPivos()` → Pivo[]

**`useClienteStats()`**
- `fetchStats()` → ClienteStats

---

## 🧪 Como Testar

### Pré-requisitos

```bash
# 1. FastAPI rodando
http://localhost:8000

# 2. CouchDB rodando com dados
https://admin:wyrd@db.vpn.ind.br

# 3. .env.local configurado (React_app/)
VITE_API_URL=http://localhost:8000

# 4. Cognito configurado com usuários:
# - admin@company.com (type: admin, status: active)
# - revenda@acmetech.com (type: revenda, status: active)
# - cliente@fazenda.com (type: cliente, status: pending ou active)
```

### Teste 1: Login como ADMIN

```
Email: admin@company.com
Senha: (sua senha Cognito)

✅ Esperado:
  - Redireciona para /admin
  - CarregaStats do sistema
  - Vê revendas pendentes
  - Consegue aprovar revenda
  - Stats atualiza após ação
  - Sem erros no console
```

### Teste 2: Login como REVENDA

```
Email: revenda@acmetech.com
Senha: (sua senha Cognito)

✅ Esperado:
  - Redireciona para /revenda
  - Carrega clientes da revenda
  - Vê clientes pendentes
  - Consegue aprovar cliente
  - Stats atualiza após ação
  - Sem erros no console
```

### Teste 3: Login como CLIENTE

```
Email: cliente@fazenda.com
Senha: (sua senha Cognito)

✅ Esperado:
  - Redireciona para /cliente
  - Se pending: mostra alerta (sem bloqueio)
  - Se active: acesso total
  - Carrega pivôs
  - Filtros funcionam
  - Sem erros no console
```

---

## 🔍 Troubleshooting

### ❌ "Não redireciona para dashboard"

**Causa:** `user.type` não está sendo definido
**Solução:**
```javascript
// Verificar no console do navegador
console.log('user.type:', authState.user?.type)

// Se undefined, verificar auth.js:214-267
// Pode ser necessário criar documento no CouchDB:
// admin:email, revenda:domain ou user:email
```

### ❌ "Dashboard vazio (sem dados)"

**Causa 1:** `VITE_API_URL` não configurada
```bash
# React_app/.env.local
VITE_API_URL=http://localhost:8000
```

**Causa 2:** FastAPI não rodando
```bash
cd fast-api-lindsay
python main.py
```

**Causa 3:** CouchDB não tem dados
- Verificar se documentos existem
- Rodar setup scripts se necessário

### ❌ "ApprovalQueue vazio"

**Verificar:**
```javascript
// Deve ter documentos com status='pending'
// Admin verifica: revenda:domain (status=pending)
// Revenda verifica: user:email (status=pending)

// Query CouchDB:
db.find({ selector: { status: "pending" } })
```

### ❌ "API retorna 403 Forbidden"

**Causa:** Token não está sendo enviado
**Verificar:**
- Network tab (DevTools)
- Header: `Authorization: Bearer <token>`
- Token deve estar em `useAuthStore`

### ❌ "CORS error"

**Causa:** FastAPI não tem CORS configurado para o origin
**Solução:** Verificar `main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ou lista específica
)
```

---

## 📊 Estrutura de Pastas

```
React_app/src/
├── types/
│   └── admin.ts ✅
│
├── hooks/new/
│   ├── useAdminRevendas.ts ✅
│   ├── useAdminStats.ts ✅
│   ├── useAdminClientes.ts ✅
│   ├── useRevendaClientes.ts ✅
│   ├── useRevendaStats.ts ✅
│   ├── useClientePivos.ts ✅
│   └── useClienteStats.ts ✅
│
├── pages/new/
│   ├── SignIn.jsx ✅ (redirect logic)
│   ├── AdminDashboard.tsx ✅
│   ├── RevendaDashboard.tsx ✅
│   └── ClienteDashboard.tsx ✅
│
└── components/new/
    ├── PermissionGuard.tsx ✅
    └── ApprovalQueue.tsx ✅
```

---

## ✨ Features Implementadas

✅ Redirecionamento automático por role
✅ Carregamento automático de dados
✅ Filtros por status em listas
✅ Botão refresh em cada seção
✅ Loading states com spinners
✅ Error handling com mensagens
✅ Icones emoji para melhor UX
✅ Hover effects nas cards
✅ Overflow scrollável em listas
✅ Status badges com cores
✅ Auto-refresh após ações
✅ Type-safe com TypeScript
✅ Memoização com useCallback
✅ Dependency arrays corretos

---

## 🚀 Próximos Passos (Futuro)

- [ ] Relatórios detalhados
- [ ] Gráficos (Charts.js/Recharts)
- [ ] Real-time updates (MQTT/WebSocket)
- [ ] Paginação nas listas
- [ ] Export CSV/PDF
- [ ] Dark mode
- [ ] Notificações (Toast)
- [ ] Busca/filtro avançado
- [ ] Analytics dashboard

---

## 📞 Contato & Suporte

Para questões sobre a implementação:
1. Verificar logs do console (F12)
2. Consultar este documento
3. Verificar Network tab (DevTools) para chamadas API

---

**Status Final:** 🟢 PRONTO PARA PRODUÇÃO

