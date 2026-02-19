# 🔧 Criando Custom Attributes no AWS Cognito - Guia Prático

## 🎯 O Problema

Quando você criou a revenda, os **custom attributes não foram salvos** no Cognito. O código tenta adicionar:
- `custom:type` (revenda/cliente/admin)
- `custom:status` (active/pending)
- `custom:domain` (domínio da empresa)
- `custom:company_id` (nome da empresa)
- `custom:doc_id` (ID do documento CouchDB)

Mas como esses atributos não existem no User Pool, a operação falha silenciosamente.

---

## 📌 SOLUÇÃO: Criar Custom Attributes no AWS Cognito

### ✅ Opção 1: Via AWS Console (Mais Fácil)

1. **Acesse AWS Console:**
   - https://console.aws.amazon.com/cognito/

2. **Selecione User Pool > "Lindsay"**

3. **Vá para: "Schema" ou "Atributos do Usuário"**
   - Procure por "User attributes" ou "Schema"
   - Pode estar em: "General settings" → "Attributes"

4. **Clique em "Add custom attribute"** (ou botão similar)

5. **Crie os seguintes custom attributes:**

#### Custom Attribute 1: `type`
```
Name: type
Data type: String
Required: false
Mutable: true
Min length: 1
Max length: 256
```

#### Custom Attribute 2: `status`
```
Name: status
Data type: String
Required: false
Mutable: true
Min length: 1
Max length: 256
```

#### Custom Attribute 3: `domain`
```
Name: domain
Data type: String
Required: false
Mutable: true
Min length: 1
Max length: 256
```

#### Custom Attribute 4: `company_id`
```
Name: company_id
Data type: String
Required: false
Mutable: true
Min length: 1
Max length: 256
```

#### Custom Attribute 5: `doc_id`
```
Name: doc_id
Data type: String
Required: false
Mutable: true
Min length: 1
Max length: 256
```

#### (Opcional) Custom Attribute 6: `cnpj`
```
Name: cnpj
Data type: String
Required: false
Mutable: true
Min length: 1
Max length: 20
```

#### (Opcional) Custom Attribute 7: `revenda_id`
```
Name: revenda_id
Data type: String
Required: false
Mutable: true
Min length: 1
Max length: 256
```

---

### ✅ Opção 2: Via AWS CLI (Mais Rápido)

Execute esses comandos no terminal (requer AWS CLI instalado):

```bash
# Variáveis
POOL_ID="sa-east-1_bm329gdfB"
REGION="sa-east-1"

# Criar custom attribute: type
aws cognito-idp add-custom-attributes \
  --user-pool-id $POOL_ID \
  --custom-attributes Name=type,AttributeDataType=String,Mutable=true \
  --region $REGION

# Criar custom attribute: status
aws cognito-idp add-custom-attributes \
  --user-pool-id $POOL_ID \
  --custom-attributes Name=status,AttributeDataType=String,Mutable=true \
  --region $REGION

# Criar custom attribute: domain
aws cognito-idp add-custom-attributes \
  --user-pool-id $POOL_ID \
  --custom-attributes Name=domain,AttributeDataType=String,Mutable=true \
  --region $REGION

# Criar custom attribute: company_id
aws cognito-idp add-custom-attributes \
  --user-pool-id $POOL_ID \
  --custom-attributes Name=company_id,AttributeDataType=String,Mutable=true \
  --region $REGION

# Criar custom attribute: doc_id
aws cognito-idp add-custom-attributes \
  --user-pool-id $POOL_ID \
  --custom-attributes Name=doc_id,AttributeDataType=String,Mutable=true \
  --region $REGION
```

---

## ✅ Passo 2: Verificar Custom Attributes Criados

### Via AWS Console:
1. Vá para User Pool → "Schema" ou "Attributes"
2. Procure pela seção "Custom attributes"
3. Deverá listar:
   - ✅ `custom:type`
   - ✅ `custom:status`
   - ✅ `custom:domain`
   - ✅ `custom:company_id`
   - ✅ `custom:doc_id`

### Via AWS CLI:
```bash
POOL_ID="sa-east-1_bm329gdfB"
REGION="sa-east-1"

aws cognito-idp describe-user-pool \
  --user-pool-id $POOL_ID \
  --region $REGION \
  | grep -A 5 '"Name": "custom:'
```

**Esperado:**
```
"Name": "custom:type",
"Name": "custom:status",
"Name": "custom:domain",
...
```

---

## ✅ Passo 3: Deletar Usuário Antigo (Sem Custom Attributes)

Como você criou um usuário SEM os custom attributes, você pode:

### Opção A: Deletar e Recriar
1. AWS Console → User Pool → "Users and groups"
2. Clique no usuário (ex: julio.paz961@gmail.com)
3. Clique em "Delete user" ou "Remove from group"
4. Volte para o app e clique em "Criar Revenda" novamente
5. Desta vez os custom attributes SERÃO salvos

### Opção B: Atualizar Manualmente
```bash
POOL_ID="sa-east-1_bm329gdfB"
EMAIL="julio.paz961@gmail.com"
REGION="sa-east-1"

aws cognito-idp admin-update-user-attributes \
  --user-pool-id $POOL_ID \
  --username $EMAIL \
  --user-attributes \
    Name=custom:type,Value=revenda \
    Name=custom:status,Value=active \
    Name=custom:domain,Value=v2com.com.br \
    Name=custom:company_id,Value=v2com \
  --region $REGION
```

---

## ✅ Passo 4: Testar de Novo

Após criar os custom attributes:

1. **Teste 1: Criar nova revenda**
   - Frontend → Admin → ⚙️ → "Criar Revenda"
   - Preencha e envie
   - Modal deve fechar com sucesso

2. **Teste 2: Verificar atributos**
   - AWS Console → User Pool → Users
   - Clique no novo usuário
   - Deverá mostrar na seção "Attributes":
     ```
     email: novo@email.com
     name: Nome da Revenda
     custom:type: revenda
     custom:status: active
     custom:domain: dominio.com.br
     custom:company_id: dominio
     custom:doc_id: revenda:dominio.com.br
     ```

3. **Teste 3: Login**
   - Faça login com o novo usuário
   - Deverá funcionar normalmente
   - Redirecionar para RevendaDashboard

---

## ✅ Checklist

- [ ] Acessei AWS Console e naveguei para Cognito
- [ ] Selecionei meu User Pool (Lindsay)
- [ ] Encontrei a seção "Schema" ou "Attributes"
- [ ] Criei custom attribute: `type`
- [ ] Criei custom attribute: `status`
- [ ] Criei custom attribute: `domain`
- [ ] Criei custom attribute: `company_id`
- [ ] Criei custom attribute: `doc_id`
- [ ] Verifiquei que todos os 5 custom attributes aparecem no pool
- [ ] Deletei o usuário antigo (sem custom attributes)
- [ ] Testei criar novo usuário (revenda/cliente)
- [ ] Verifiquei que o novo usuário tem os custom attributes preenchidos

---

## 🆘 Se der erro ao criar custom attribute...

### Erro: "Cannot update User Pool"
**Causa:** Você não tem permissões de admin na conta AWS
**Solução:** Use uma conta com permissões de admin

### Erro: "Attribute with name already exists"
**Causa:** O custom attribute já existe
**Solução:** Prossiga, ele já foi criado

### Erro: "Invalid attribute data type"
**Causa:** Tipo de dado inválido (deve ser String, Number, etc)
**Solução:** Use `String` para todos os atributos de Lindsay

---

## 📚 Referências

- AWS Cognito User Attributes: https://docs.aws.amazon.com/cognito-user-identity-pools/latest/userguide/user-pool-lambda-custom-message.html
- Custom Attributes Guide: https://docs.aws.amazon.com/cognito-user-identity-pools/latest/userguide/user-pool-custom-attributes.html

---

**Próximos passos:**
1. Criar os custom attributes (10 minutos)
2. Testar criação de novo usuário (2 minutos)
3. Verificar que custom attributes estão salvos (1 minuto)
4. Prosseguir com testes normais

Após isso, o fluxo completo de criação de revenda/cliente funcionará perfeitamente! 🎉
