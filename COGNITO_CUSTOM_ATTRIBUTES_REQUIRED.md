# 🔐 COGNITO CUSTOM ATTRIBUTES - CONFIGURAÇÃO NECESSÁRIA

**Data:** 17/02/2026
**Status:** ⚠️ PARCIALMENTE CONFIGURADO
**Prioridade:** ALTA (necessário para autenticação multi-nível)

---

## 📋 CUSTOM ATTRIBUTES OBRIGATÓRIOS

### 1️⃣ **custom:type** (OBRIGATÓRIO)
```
Nome do Atributo: type
Tipo: String
Comprimento Máximo: 20
Mutável: Sim
Requerido: Não

Valores Permitidos:
  • "admin"    → Administrador (super user)
  • "revenda"  → Revenda/Revendedor
  • "cliente"  → Cliente final
```

**Usado em:**
- `auth.js:214` → Identificar tipo de usuário
- `SignIn.jsx:53-62` → Redirecionar para dashboard correto
- `authStore.ts:user.type` → Armazenar no state management

---

### 2️⃣ **custom:status** (OBRIGATÓRIO)
```
Nome do Atributo: status
Tipo: String
Comprimento Máximo: 20
Mutável: Sim
Requerido: Não

Valores Permitidos:
  • "active"    → Aprovado e ativo
  • "pending"   → Aguardando aprovação
  • "rejected"  → Rejeitado
```

**Usado em:**
- `auth.js:276-299` → Obter status do usuário
- `authStore.ts:selectIsActiveUser()` → Verificar se pode acessar dashboard
- `PermissionGuard.tsx:27` → Bloquear acesso se não ativo

**Lógica de Status:**
- `admin` → sempre `"active"` (linha 292-293)
- `revenda` → `"pending"` até ser aprovado pelo admin
- `cliente` → `"pending"` até ser aprovado pela revenda

---

### 3️⃣ **custom:domain** (OBRIGATÓRIO para REVENDA)
```
Nome do Atributo: domain
Tipo: String
Comprimento Máximo: 255
Mutável: Sim
Requerido: Não

Exemplo: "wyrd.com.br", "acmetech.com.br"
```

**Usado em:**
- `auth.js:272` → Gerar revenda_id = `revenda:{domain}`
- `SignUp.jsx:14` → Campo opcional (usa domínio do email se não fornecido)
- `authStore.ts:user.domain` → Armazenar domínio

---

### 4️⃣ **custom:doc_id** (OBRIGATÓRIO)
```
Nome do Atributo: doc_id
Tipo: String
Comprimento Máximo: 255
Mutável: Não (idealmente)
Requerido: Não

Formato por Tipo:
  • Admin:  "admin:julio.paz@wyrd.com.br"
  • Revenda: "revenda:wyrd.com.br"
  • Cliente: "user:julio.paz@wyrd.com.br"
```

**Usado em:**
- `auth.js:269-273` → Gerar ID do documento no CouchDB
- `authStore.ts:user.doc_id` → Referência ao documento

---

### 5️⃣ **custom:cnpj** (RECOMENDADO)
```
Nome do Atributo: cnpj
Tipo: String
Comprimento Máximo: 18
Mutável: Sim
Requerido: Não

Formato: "XX.XXX.XXX/0001-XX"
Exemplo: "12.345.678/0001-99"
```

**Usado em:**
- `auth.js:311` → Armazenar CNPJ no user object
- **NOVO:** Associar pivôs por CNPJ (futura implementação)
- Backend: validação de revenda por CNPJ

---

## 🔧 CUSTOM ATTRIBUTES OPCIONAIS

### 6️⃣ **custom:company_id**
```
Nome do Atributo: company_id
Tipo: String
Comprimento Máximo: 50
Mutável: Sim
Requerido: Não

Exemplo: "wyrd", "acmetech", "gmail"
```

**Usado em:**
- `auth.js:119-123` (comentado) → Referência à empresa
- Backend para agrupamento

---

### 7️⃣ **custom:hierarquia** (DEPRECADO)
```
⚠️ NOTA: Substituído por "custom:type"
Nome: hierarquia
Status: NÃO USAR (mantido por compatibilidade)
```

---

## 📊 MAPA DE CONFIGURAÇÃO POR TIPO DE USUÁRIO

### **ADMIN**
```json
{
  "email": "julio.paz@wyrd.com.br",
  "name": "Júlio Paz",
  "custom:type": "admin",
  "custom:status": "active",
  "custom:doc_id": "admin:julio.paz@wyrd.com.br",
  "custom:cnpj": "12.345.678/0001-99"
}
```

### **REVENDA**
```json
{
  "email": "gerente@wyrd.com.br",
  "name": "Gerente WYRD",
  "custom:type": "revenda",
  "custom:status": "pending",  // ← Aguardando aprovação do admin
  "custom:domain": "wyrd.com.br",
  "custom:doc_id": "revenda:wyrd.com.br",
  "custom:cnpj": "12.345.678/0001-99",
  "custom:company_id": "wyrd"
}
```

### **CLIENTE**
```json
{
  "email": "fazendeiro@gmail.com",
  "name": "João Fazendeiro",
  "custom:type": "cliente",
  "custom:status": "pending",  // ← Aguardando aprovação da revenda
  "custom:doc_id": "user:fazendeiro@gmail.com",
  "custom:revenda_id": "revenda:wyrd.com.br"
}
```

---

## ✅ PASSO-A-PASSO PARA CONFIGURAR NO AWS COGNITO

### **1. Acessar AWS Console**
```
1. IAM → Cognito → User Pools
2. Selecionar seu pool (ex: lindsay-auth)
3. Clicar em "Attributes"
```

### **2. Adicionar Custom Attributes**

Para cada atributo abaixo, clicar em "Add an attribute":

**Atributo 1: type**
- Name: `type`
- Type: `String`
- Length: `20`
- Mutable: ✅ Sim
- Requerido: ❌ Não

**Atributo 2: status**
- Name: `status`
- Type: `String`
- Length: `20`
- Mutable: ✅ Sim
- Requerido: ❌ Não

**Atributo 3: domain**
- Name: `domain`
- Type: `String`
- Length: `255`
- Mutable: ✅ Sim
- Requerido: ❌ Não

**Atributo 4: doc_id**
- Name: `doc_id`
- Type: `String`
- Length: `255`
- Mutable: ❌ Não
- Requerido: ❌ Não

**Atributo 5: cnpj**
- Name: `cnpj`
- Type: `String`
- Length: `18`
- Mutable: ✅ Sim
- Requerido: ❌ Não

**Atributo 6: company_id** (Opcional)
- Name: `company_id`
- Type: `String`
- Length: `50`
- Mutable: ✅ Sim
- Requerido: ❌ Não

### **3. Verificar App Client**
```
1. Ir para "App clients" ou "App integration"
2. Clicar no seu client
3. Na seção "Custom attributes", garantir que TODOS os atributos acima
   estão selecionados em "Read attributes" e "Write attributes"
```

---

## 🔄 COMO POPULAR OS CUSTOM ATTRIBUTES

### **Opção A: Via Console AWS**
```
1. Cognito → User Pools → Users and groups
2. Clicar no usuário
3. Clicar em "Edit user attributes"
4. Preencher cada custom attribute
```

### **Opção B: Via AWS CLI**
```bash
aws cognito-idp admin-update-user-attributes \
  --user-pool-id us-east-1_XXXXX \
  --username julio.paz@wyrd.com.br \
  --user-attributes \
    Name=email,Value=julio.paz@wyrd.com.br \
    Name=name,Value="Júlio Paz" \
    Name=custom:type,Value=admin \
    Name=custom:status,Value=active \
    Name=custom:doc_id,Value="admin:julio.paz@wyrd.com.br" \
    Name=custom:cnpj,Value="12.345.678/0001-99"
```

### **Opção C: Via Script Python**
```python
import boto3

cognito = boto3.client('cognito-idp')

cognito.admin_update_user_attributes(
    UserPoolId='us-east-1_XXXXX',
    Username='julio.paz@wyrd.com.br',
    UserAttributes=[
        {'Name': 'email', 'Value': 'julio.paz@wyrd.com.br'},
        {'Name': 'name', 'Value': 'Júlio Paz'},
        {'Name': 'custom:type', 'Value': 'admin'},
        {'Name': 'custom:status', 'Value': 'active'},
        {'Name': 'custom:doc_id', 'Value': 'admin:julio.paz@wyrd.com.br'},
        {'Name': 'custom:cnpj', 'Value': '12.345.678/0001-99'},
    ]
)
```

---

## ⚠️ PROBLEMAS CONHECIDOS E SOLUÇÕES

### **Problema 1: "Custom attributes not found in token"**
**Causa:** Atributos não foram adicionados ao User Pool
**Solução:** Adicionar via console (passos acima)

### **Problema 2: "SignUp falha ao tentar enviar custom attributes"**
**Causa:** SignUp não suporta custom attributes direto (Cognito limitation)
**Solução:** Usar `AdminUpdateUserAttributes` após o SignUp

### **Problema 3: "custom:status não aparece no token"**
**Causa:** Atributo não está incluído no App Client config
**Solução:** Ir em App Client settings → "Custom attributes" → marcar checkbox

### **Problema 4: "user.type fica null no login"**
**Causa:** custom:type não foi configurado no Cognito
**Solução:**
1. Adicionar custom:type no User Pool
2. Executar `AdminUpdateUserAttributes` para usuários existentes
3. Novo login vai trazer o atributo no JWT

---

## 🔗 FLUXO COMPLETO

```
┌─────────────────────────────────────────────────────────┐
│ 1. CADASTRO (SignUp.jsx)                                │
│    - Email, Senha, Tipo (admin/revenda/cliente)        │
│    - Domínio (se revenda)                               │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ 2. CRIAR NO COGNITO (auth.js → signUp)                 │
│    - Usuário criado com status "pending"                │
│    - ⚠️ Custom attributes NÃO são enviados (limitation) │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ 3. CRIAR NO COUCHDB (Backend → /api/auth/register)    │
│    - Documento "revenda:" ou "user:" salvo              │
│    - Status = "pending" (aguardando aprovação)          │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ 4. POPULATAR CUSTOM ATTRIBUTES (AdminUpdateUserAttributes)│
│    - custom:type = "admin" | "revenda" | "cliente"    │
│    - custom:status = "pending" | "active"              │
│    - custom:doc_id = "revenda:domain.com"              │
│    - custom:cnpj = "XX.XXX.XXX/0001-XX"                │
│    - custom:domain = "domain.com" (se revenda)         │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ 5. LOGIN (SignIn.jsx → auth.js → signIn)              │
│    - Cognito valida usuário e senha                     │
│    - Retorna JWT com custom attributes                  │
│    - auth.js decodifica JWT e extrai dados             │
│    - Zustand armazena user (type, status, etc)         │
│    - Frontend redireciona para dashboard correto        │
└─────────────────────────────────────────────────────────┘
```

---

## 📌 CHECKLIST DE CONFIGURAÇÃO

- [ ] `custom:type` criado no User Pool
- [ ] `custom:status` criado no User Pool
- [ ] `custom:domain` criado no User Pool
- [ ] `custom:doc_id` criado no User Pool
- [ ] `custom:cnpj` criado no User Pool
- [ ] `custom:company_id` criado no User Pool (opcional)
- [ ] Todos os atributos marcados em App Client "Custom attributes"
- [ ] Usuário admin possui custom:type = "admin"
- [ ] Usuário admin possui custom:status = "active"
- [ ] Testar login → verificar se JWT contém custom attributes
- [ ] Testar redirect para /admin (se custom:type = "admin")
- [ ] Testar redirect para /revenda (se custom:type = "revenda")
- [ ] Testar redirect para /cliente (se custom:type = "cliente")

---

## 🚀 PRÓXIMOS PASSOS

**IMEDIATO:**
1. Adicionar 6 custom attributes no Cognito (via AWS Console)
2. Atualizar usuários de teste com os atributos
3. Testar login e verificar JWT no //console.log

**MÉDIO PRAZO:**
1. Criar script de sincronização Cognito ↔ CouchDB
2. Implementar aprovação de revenda com atualização de custom:status
3. Adicionar CNPJ no signup de revenda

**LONGO PRAZO:**
1. Migrar para JWT with custom claims
2. Implementar MFA
3. Adicionar audit log de alterações de status

---

**Status:** ⚠️ Não configurado
**Impacto:** CRÍTICO (login não funciona sem custom:type e custom:status)
