# Plano Completo: Migração CouchDB → FastAPI

## Objetivo

Eliminar o acesso direto do frontend React ao CouchDB (credenciais `admin:wyrd` hardcoded em `couch.ts`).
O frontend passará a consumir apenas a API FastAPI autenticada via Bearer token.

---

## Auditoria: hooks/stores com acesso direto ao CouchDB

| Arquivo | Situação |
|---------|---------|
| `src/hooks/new/getHistory.ts` | Usa views CouchDB → **Migrar** |
| `src/hooks/new/getRecent.ts` | Usa `getDoc` direto → **Migrar** |
| `src/hooks/new/useChangesListener.ts` | Usa `_changes` feed → **Migrar** |
| `src/hooks/new/useWhatsappPerIrrigador.ts` | Lê/escreve doc `notificacoes:` → **Migrar** |
| `src/hooks/new/useTensionData.ts` | Indireta via getHistory → **Atualizar** |
| `src/hooks/new/useAlertsData.ts` | Indireta via getHistory → **Atualizar** |
| `src/hooks/new/useAdminStats.ts` | Híbrido (usa getRecent) → **Atualizar** |
| `src/stores/new/dataStoreIrrigadores.js` | Usa Mango find direto → **Migrar → /api/pivos** |
| `src/api/new/couch.ts` | Raiz do problema → **Deletar ao final** |

---

## Parte 1 — Backend

### Novos arquivos

| Arquivo | Conteúdo |
|---------|---------|
| `app/services/history.py` | `HistoryService` — queries + agregação |
| `app/api/routes/history.py` | 5 endpoints de histórico |
| `app/api/routes/recent.py` | 3 endpoints de snapshot recente |
| `app/api/routes/notifications_config.py` | GET + PUT config de notificações |

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `main.py` linha 33 | Adicionar `history, recent, notifications_config` |
| `main.py` linha ~166 | `app.include_router(...)` para os 3 novos routers |
| `app/models/schemas.py` | Modelos de resposta (History, Recent, NotificationsConfig) |
| `app/services/setup_indexes.py` | 3 índices históricos (ausentes atualmente) |
| `requirements.txt` | `httpx>=0.27.0` |

---

### Endpoints: `/api/history/`

```
GET /api/history/{irrigador_id}/tension
  Query: tipo=A|B|both*, start_ts, end_ts, max_points=1000
  Response: { irrigador_id, points: [{timestamp, tipo, monitor_range, data}], total_raw, aggregated }

GET /api/history/{irrigador_id}/events
  Query: event_type?, start_ts, end_ts, skip=0, limit=50
  Response: { irrigador_id, total, skip, limit, items: [{_id, timestamp, eventType, monitor, estado, status, description, responsible}] }

GET /api/history/{irrigador_id}/sw
  Query: start_ts, end_ts, skip=0, limit=100
  Response: { irrigador_id, skip, limit, items: [{_id, timestamp, data}] }

GET /api/history/{irrigador_id}/alerts
  Query: start_ts, end_ts, skip=0, limit=50
  Response: { irrigador_id, total, skip, limit, items: [...] }

GET /api/history/changes
  Query: since=now, limit=1000, feed=normal|longpoll*, timeout_ms=30000, irrigador_id?
  Response: { last_seq, pending?, results: [{seq, id, changes, deleted?}] }
  Lógica: proxy httpx.AsyncClient → CouchDB _changes filtrado por permissão
```

---

### Endpoints: `/api/recent/`

Servem documentos `tensao_recente::{id}::{tipo}` e `sw_recente::{id}` (mantidos pelo MQTT/alert_service):

```
GET /api/recent/{irrigador_id}
  Response: { tensao: {A?, B?, C?, D?}, sw? }

GET /api/recent/{irrigador_id}/tension/{tipo}
  Response: { _id, updated_at, data: {timestamp, monitores: {name: {voltage, status}}} }

GET /api/recent/{irrigador_id}/sw
  Response: { _id, updated_at, data: {painel_1, painel_2, lampada, sirene, manutencao, monitores} }
```

---

### Endpoints: `/api/notifications-config/`

```
GET /api/notifications-config/{irrigador_id}
  Response: { irrigador_id, assinantes: [{email, msg_enabled, call_enabled}] }

PUT /api/notifications-config/{irrigador_id}
  Body: { email, msg_enabled, call_enabled }
  Lógica: upsert com retry em conflito 409
  Response: { ok: true }
```

---

### Lógica de permissão (helper compartilhado)

```python
def _verify_irrigador_access(irrigador_id, user, checker, db):
    if not checker.is_active():         raise HTTPException(403)
    if checker.is_admin():              return
    try:
        doc = db[irrigador_id]          # GET por _id (O(1))
    except couchdb.ResourceNotFound:    raise HTTPException(404)
    user_cnpj = user.get("cnpj", "")
    if checker.is_revenda():
        if doc.get("cnpj_revenda") != user_cnpj: raise HTTPException(403)
    elif checker.is_cliente():
        if doc.get("cnpj_cliente") != user_cnpj: raise HTTPException(403)
    else:                               raise HTTPException(403)
```

---

### Índices Mango (adicionar em `setup_indexes.py`)

```python
{"name": "idx_tensao_raw_irrigador_tipo_ts",  "fields": ["table", "irrigadorId", "tipo", "timestamp"]},
{"name": "idx_sw_raw_irrigador_ts",           "fields": ["table", "irrigadorId", "timestamp"]},
{"name": "idx_events_irrigador_eventType_ts", "fields": ["table", "irrigadorId", "eventType", "timestamp"]},
```

---

## Parte 2 — Frontend

### Criar: `src/api/new/fastapi-history.js`

```js
import apiClient from './apiClient'

// History
export const getTensionHistory = (id, params) => apiClient.get(`/history/${id}/tension`, { params })
export const getEventsHistory  = (id, params) => apiClient.get(`/history/${id}/events`,  { params })
export const getSWHistory      = (id, params) => apiClient.get(`/history/${id}/sw`,       { params })
export const getAlertsHistory  = (id, params) => apiClient.get(`/history/${id}/alerts`,   { params })
export const getChanges        = (params)     => apiClient.get(`/history/changes`,        { params })

// Recent
export const getRecentAll      = (id)        => apiClient.get(`/recent/${id}`)
export const getRecentTension  = (id, tipo)  => apiClient.get(`/recent/${id}/tension/${tipo}`)
export const getRecentSW       = (id)        => apiClient.get(`/recent/${id}/sw`)

// Notifications config
export const getNotifConfig    = (id)        => apiClient.get(`/notifications-config/${id}`)
export const updateNotifConfig = (id, data)  => apiClient.put(`/notifications-config/${id}`, data)
```

---

### Reescrever (remover dependência do CouchDB)

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/new/getHistory.ts` | Remover `db` param + imports couch; chamar `fastapi-history.js` |
| `src/hooks/new/getRecent.ts` | Remover `db` param + imports couch; chamar `fastapi-history.js` |
| `src/hooks/new/useChangesListener.ts` | Substituir `getChanges(db, ...)` por `getChanges(params)` do fastapi-history |
| `src/hooks/new/useWhatsappPerIrrigador.ts` | Substituir `getDoc/upsertDoc` por `getNotifConfig/updateNotifConfig` |

---

### Atualizar (ajuste de assinatura)

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/new/useTensionData.ts` | `getTensaoHistory` não recebe mais `db` |
| `src/hooks/new/useAlertsData.ts` | `getAlertHistory` não recebe mais `db`; paginação via skip/limit |
| `src/hooks/new/useAdminStats.ts` | Substituir `getRecentAll(db, id)` por `getRecentAll(id)` |

---

### Migrar ou deletar

| Arquivo | Ação |
|---------|------|
| `src/stores/new/dataStoreIrrigadores.js` | Verificar uso; se ativo → usar `/api/pivos`; se não → **deletar** |
| `src/api/new/couch.ts` | **Deletar** após confirmar zero imports restantes |

---

## Ordem de implementação

### Backend (passos 1–8)
1. `requirements.txt` → `httpx>=0.27.0`
2. `setup_indexes.py` → 3 índices históricos
3. `schemas.py` → modelos de resposta
4. `app/services/history.py` → `HistoryService`
5. `app/api/routes/history.py` → 5 endpoints
6. `app/api/routes/recent.py` → 3 endpoints
7. `app/api/routes/notifications_config.py` → 2 endpoints
8. `main.py` → registrar 3 routers

### Frontend (passos 9–18)
9.  `src/api/new/fastapi-history.js` → criar
10. `src/hooks/new/getHistory.ts` → reescrever
11. `src/hooks/new/getRecent.ts` → reescrever
12. `src/hooks/new/useChangesListener.ts` → reescrever
13. `src/hooks/new/useWhatsappPerIrrigador.ts` → reescrever
14. `src/hooks/new/useTensionData.ts` → ajuste assinatura
15. `src/hooks/new/useAlertsData.ts` → ajuste assinatura
16. `src/hooks/new/useAdminStats.ts` → remover getRecent do CouchDB
17. `src/stores/new/dataStoreIrrigadores.js` → migrar ou deletar
18. `src/api/new/couch.ts` → deletar

---

## Verificação final

```bash
# Backend
cd fast-api-lindsay && python main.py
# Testar em http://localhost:8000/docs por role (admin, revenda, cliente)

# Frontend — confirmar zero imports do couch.ts
grep -r "from.*couch" React_app/src/
grep -r "import.*couch" React_app/src/
# Deve retornar vazio
```
