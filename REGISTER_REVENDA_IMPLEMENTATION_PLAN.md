# 📋 PLANO DE IMPLEMENTAÇÃO: Registro de Revenda (Opção B - Completa)

**Tempo estimado:** 30-40 minutos
**Complexidade:** MÉDIA
**Impacto:** CRÍTICO (abre fluxo de onboarding de revendas)

---

## 🎯 OBJETIVO

Permitir que uma revenda se registre pelo SignUp.jsx e criar automaticamente:
1. Usuário no Cognito com custom attributes
2. Documento de revenda no CouchDB
3. Redirecionamento automático para aprovação do admin

---

## 📊 FLUXO COMPLETO

```
┌──────────────────────────────────────────────────────────┐
│ 1. FRONTEND: SignUp.jsx                                  │
│    - Email, Senha, Nome                                  │
│    - Tipo: "revenda" (select)                            │
│    - Domínio: "wyrd.com.br" (input)                      │
│    - CNPJ: "12.345.678/0001-99" (input) ← NOVO!         │
│    - Termos de uso: checkbox                             │
└─────────────────┬────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────┐
│ 2. BACKEND: /api/auth/register (NOVO ENDPOINT)          │
│    - POST /api/auth/register                             │
│    - Body: {email, password, name, domain, cnpj}        │
│    - Validação:                                          │
│      ✓ Email válido                                      │
│      ✓ Domínio único                                     │
│      ✓ CNPJ válido (format: XX.XXX.XXX/0001-XX)        │
│      ✓ Senha forte (8+ chars)                           │
└─────────────────┬────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────┐
│ 3. CRIAR NO COGNITO                                      │
│    - POST /cognito/SignUp                                │
│    - Username: email                                     │
│    - Password: hash                                      │
│    - Return: userSub (sub do usuário)                    │
└─────────────────┬────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────┐
│ 4. CRIAR NO COUCHDB                                      │
│    - _id: "revenda:domain.com"                           │
│    - type: "revenda"                                     │
│    - email, name, domain, cnpj, status: "pending"       │
│    - created_at, cognito_sub                            │
└─────────────────┬────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────┐
│ 5. ATUALIZAR CUSTOM ATTRIBUTES NO COGNITO               │
│    - AdminUpdateUserAttributes                           │
│    - custom:type = "revenda"                             │
│    - custom:status = "pending"                           │
│    - custom:domain = domain                              │
│    - custom:doc_id = "revenda:domain"                    │
│    - custom:cnpj = cnpj                                  │
│    - custom:revenda_id = "revenda:domain"                │
└─────────────────┬────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────┐
│ 6. RESPOSTA PARA FRONTEND                               │
│    - Status 201 Created                                  │
│    - {status: "success", revenda_id, message}           │
│    - Frontend redireciona para /login                    │
│    - Mensagem: "Registrado com sucesso! Aguarde..."     │
└──────────────────────────────────────────────────────────┘
```

---

## 📁 ARQUIVOS A CRIAR/MODIFICAR

### **CRIAR:**
- [ ] `fast-api-lindsay/app/services/revenda.py` - RevendaService
- [ ] `fast-api-lindsay/app/utils/validators.py` - Validadores (CNPJ, etc)
- [ ] `fast-api-lindsay/app/api/routes/auth.py` - Atualizar com endpoint register

### **MODIFICAR:**
- [ ] `React_app/src/pages/new/SignUp.jsx` - Adicionar campo CNPJ + integração
- [ ] `React_app/src/api/new/auth.js` - Adicionar função registerRevenda()

---

## 🔧 DETALHES DE IMPLEMENTAÇÃO

### **1. Backend: Validators (Novo Arquivo)**

**Arquivo:** `fast-api-lindsay/app/utils/validators.py`

```python
def validate_cnpj(cnpj: str) -> bool:
    """Valida CNPJ brasileiro"""
    # Remove caracteres especiais
    cnpj = ''.join(filter(str.isdigit, cnpj))

    # Deve ter 14 dígitos
    if len(cnpj) != 14:
        return False

    # Algoritmo de validação do CNPJ
    # (implementação padrão brasileira)

    return True

def format_cnpj(cnpj: str) -> str:
    """Formata CNPJ para XX.XXX.XXX/0001-XX"""
    cnpj = ''.join(filter(str.isdigit, cnpj))
    return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:14]}"
```

---

### **2. Backend: RevendaService**

**Arquivo:** `fast-api-lindsay/app/services/revenda.py`

Métodos:
- `create_revenda_couchdb(email, domain, name, cnpj)` - Cria no CouchDB
- `update_cognito_attributes(sub, custom_attributes)` - Atualiza Cognito
- `verify_domain_unique(domain)` - Valida domínio único
- `register_complete(email, password, domain, name, cnpj)` - Fluxo completo

---

### **3. Backend: Auth Endpoint**

**Arquivo:** `fast-api-lindsay/app/api/routes/auth.py` (NOVO ENDPOINT)

```
POST /api/auth/register
Content-Type: application/json

Request Body:
{
  "email": "gerente@wyrd.com.br",
  "password": "SecurePass123!",
  "name": "Gerente WYRD",
  "user_type": "revenda",
  "domain": "wyrd.com.br",
  "cnpj": "12.345.678/0001-99"
}

Response (201 Created):
{
  "status": "success",
  "message": "Revenda registrada com sucesso! Aguarde aprovação do admin.",
  "revenda_id": "revenda:wyrd.com.br",
  "next_steps": "Faça login para acompanhar sua solicitação"
}

Response (400 Bad Request):
{
  "status": "error",
  "message": "CNPJ inválido",
  "details": "CNPJ deve estar no formato XX.XXX.XXX/0001-XX"
}
```

---

### **4. Frontend: SignUp.jsx Modificações**

```javascript
// Adicionar campos:
const [cnpj, setCnpj] = useState("");
const [cnpjError, setCnpjError] = useState("");

// Mostrar campo CNPJ quando userType === 'revenda'
{userType === 'revenda' && (
  <div>
    <label>CNPJ *</label>
    <input
      type="text"
      value={cnpj}
      onChange={(e) => setCnpj(e.target.value)}
      placeholder="XX.XXX.XXX/0001-XX"
      pattern="\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}"
    />
  </div>
)}

// Modificar handleRegister:
if (userType === 'revenda') {
  await registerRevenda(email, password, name, domain, cnpj);
} else {
  await signUp(email, password, companyId, customAttributes);
}
```

---

### **5. Frontend: auth.js Nova Função**

```javascript
export const registerRevenda = async (
  email: string,
  password: string,
  name: string,
  domain: string,
  cnpj: string
) => {
  try {
    const response = await api.post('/auth/register', {
      email,
      password,
      name,
      user_type: 'revenda',
      domain: domain || email.split('@')[1],
      cnpj
    });

    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || 'Erro ao registrar revenda');
  }
};
```

---

## ✅ VALIDAÇÕES NECESSÁRIAS

### **Email**
```python
def validate_email(email: str) -> bool:
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None
```

### **CNPJ (Algoritmo Completo)**
```python
def validate_cnpj(cnpj: str) -> bool:
    """
    Valida CNPJ conforme algoritmo oficial do Brasil
    Formato: XX.XXX.XXX/0001-XX
    """
    cnpj = ''.join(filter(str.isdigit, cnpj))

    if len(cnpj) != 14:
        return False

    # Se todos os dígitos são iguais, é inválido
    if cnpj == cnpj[0] * 14:
        return False

    # Cálculo do primeiro dígito verificador
    mult = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    result = sum(int(cnpj[i]) * mult[i] for i in range(12))
    digit1 = 11 - (result % 11)
    digit1 = 0 if digit1 >= 10 else digit1

    if int(cnpj[12]) != digit1:
        return False

    # Cálculo do segundo dígito verificador
    mult = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    result = sum(int(cnpj[i]) * mult[i] for i in range(13))
    digit2 = 11 - (result % 11)
    digit2 = 0 if digit2 >= 10 else digit2

    if int(cnpj[13]) != digit2:
        return False

    return True
```

### **Domínio**
```python
def validate_domain(domain: str) -> bool:
    """
    Valida domínio
    Formato: exemplo.com.br ou exemplo.com
    """
    import re
    pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$'
    return re.match(pattern, domain) is not None
```

### **Senha**
```python
def validate_password(password: str) -> tuple[bool, str]:
    """
    Valida senha forte
    Requisitos:
    - Mínimo 8 caracteres
    - Pelo menos 1 maiúscula
    - Pelo menos 1 minúscula
    - Pelo menos 1 número
    - Pelo menos 1 caractere especial
    """
    if len(password) < 8:
        return False, "Mínimo 8 caracteres"

    if not any(c.isupper() for c in password):
        return False, "Deve conter pelo menos 1 maiúscula"

    if not any(c.islower() for c in password):
        return False, "Deve conter pelo menos 1 minúscula"

    if not any(c.isdigit() for c in password):
        return False, "Deve conter pelo menos 1 número"

    if not any(c in '!@#$%^&*(),.?":{}|<>' for c in password):
        return False, "Deve conter pelo menos 1 caractere especial"

    return True, ""
```

---

## 🧪 TESTES

### **Teste 1: Registrar Revenda Válida**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gerente@wyrd.com.br",
    "password": "SecurePass123!",
    "name": "Gerente WYRD",
    "user_type": "revenda",
    "domain": "wyrd.com.br",
    "cnpj": "12.345.678/0001-99"
  }'
```

### **Teste 2: CNPJ Inválido**
```bash
# Deve retornar erro 400
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"cnpj": "00.000.000/0000-00"}'
```

### **Teste 3: Domínio Já Existe**
```bash
# Deve retornar erro 400
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"domain": "wyrd.com.br"}'
```

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO

1. **Criar `validators.py`** (10 min)
   - Funções de validação de CNPJ, email, domínio, senha

2. **Criar `revenda.py` (RevendaService)** (10 min)
   - Métodos para criar revenda no CouchDB
   - Método para atualizar Cognito

3. **Criar endpoint `/api/auth/register`** (10 min)
   - Integrar tudo junto
   - Retornar resposta apropriada

4. **Modificar `SignUp.jsx`** (7 min)
   - Adicionar campo CNPJ
   - Integrar chamada para registerRevenda()

5. **Modificar `auth.js`** (3 min)
   - Adicionar função registerRevenda()

6. **Testar tudo junto** (5 min)
   - Registrar revenda via UI
   - Verificar Cognito + CouchDB
   - Fazer login

---

## ⚠️ CONSIDERAÇÕES IMPORTANTES

- **CNPJ público?** Não armazenar em frontend plain-text
- **Senha segura?** Usar HTTPS em produção
- **Rate limiting?** Adicionar em produção
- **Email verification?** Considerar após aprovação
- **Aprovação admin?** Status começa como "pending"

---

**Status:** 📋 Pronto para implementação
**Próximo:** Iniciar com validators.py
