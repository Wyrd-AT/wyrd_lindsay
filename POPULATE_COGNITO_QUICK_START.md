# ⚡ QUICK START: Popular Custom Attributes Cognito

**Tempo estimado:** 5 minutos

---

## 📋 PASSO 1: Encontrar seu User Pool ID

1. Acesse [AWS Console](https://console.aws.amazon.com)
2. Vá para **Cognito → User Pools**
3. Clique no seu pool (ex: `lindsay-auth`)
4. Copie o **User Pool ID** (formato: `us-east-1_XXXXX`)

---

## 🔧 PASSO 2: Configurar o Script

Abra o arquivo `scripts/populate_cognito_attributes.py` e substitua:

```python
# ANTES:
COGNITO_USER_POOL_ID = "us-east-1_XXXXX"  # ← SUBSTITUIR COM SEU POOL ID

# DEPOIS (exemplo):
COGNITO_USER_POOL_ID = "us-east-1_aBcDeF123gHi"
```

---

## 🚀 PASSO 3: Executar o Script

### **Opção A: Terminal Local (se tiver AWS CLI configurado)**

```bash
# 1. Instalar boto3
pip install boto3

# 2. Configurar AWS credentials (se ainda não fez)
aws configure

# 3. Executar script
python3 scripts/populate_cognito_attributes.py
```

### **Opção B: AWS CloudShell (sem setup local)**

```bash
# 1. Abrir AWS Console → CloudShell (canto superior direito)
# 2. Copiar o script para o CloudShell

cat > populate_cognito.py << 'EOF'
[COPIE TODO O CONTEÚDO DO ARQUIVO populate_cognito_attributes.py]
EOF

# 3. Executar
python3 populate_cognito.py
```

### **Opção C: AWS Lambda (via Console)**

1. AWS Console → Lambda → Create Function
2. Language: Python 3.12
3. Copiar código do script
4. Substituir COGNITO_USER_POOL_ID
5. Clicar "Deploy"
6. Executar a função

---

## ✅ PASSO 4: Verificar se Funcionou

Após executar o script, você deve ver:

```
======================================================================
🔐 SCRIPT: Popular Custom Attributes no Cognito
======================================================================

📍 User Pool: us-east-1_aBcDeF123gHi
📍 Region: us-east-1

✅ Conectado ao Cognito

📋 Atualizando usuários:

✅ julio.paz@wyrd.com.br: Atributos atualizados com sucesso
✅ revenda@wyrd.com.br: Atributos atualizados com sucesso
✅ revenda@gmail.com.br: Atributos atualizados com sucesso
✅ revenda@usp.br: Atributos atualizados com sucesso
✅ cliente@fazenda.com: Atributos atualizados com sucesso

======================================================================
✅ Sucesso: 5/5
❌ Falhas: 0/5
======================================================================

🎉 Todos os usuários foram atualizados com sucesso!

⏭️  Próximos passos:
   1. Fazer login novamente no aplicativo
   2. Abrir DevTools (F12) → Console
   3. Procurar por logs de 'User type:' para confirmar
   4. Você deve ser redirecionado automaticamente para o dashboard
```

---

## 🧪 PASSO 5: Testar o Login

1. **Logout** do aplicativo (se estiver logado)
2. **Abra DevTools** (F12 no navegador)
3. **Ir para Console**
4. **Fazer login** com `julio.paz@wyrd.com.br`
5. **Procurar pelos logs:**

```
✅ Resposta completa do Cognito:
🔐 Token Payload (atributos do usuário):
📦 User object final antes de salvar:
🔐 Login bem-sucedido, redirecionando...
   User type: admin
   User status: active
```

6. **Você deve ser redirecionado para `/admin`** automaticamente ✅

---

## ⚠️ Se Não Funcionar

### **Erro: "UserNotFoundException"**
- Verifique se o usuário existe no Cognito
- Tente criar o usuário no console primeiro

### **Erro: "InvalidParameter"**
- Verifique se o COGNITO_USER_POOL_ID está correto
- Verifique se a região está correta

### **Erro: "AccessDenied"**
- Verifique se suas credenciais AWS têm permissão
- Acesse IAM e adicione permissão para `cognito-idp:AdminUpdateUserAttributes`

### **Login funciona mas não redireciona para /admin**
- Abra DevTools → Console
- Procure por "User type: null"
- Isso significa que custom:type não foi preenchido
- Execute o script novamente

---

## 🎯 Checklist Final

- [ ] User Pool ID encontrado e configurado
- [ ] Script executado com sucesso (5/5)
- [ ] Fazer logout e login novamente
- [ ] DevTools mostra "User type: admin"
- [ ] Redirecionado automaticamente para `/admin`
- [ ] Dashboard carrega sem erros
- [ ] Stats aparecem (com dados ou vazios é OK)

---

## 📞 Suporte

Se algo não funcionar:

1. Verificar logs do navegador (F12 → Console)
2. Verificar logs do CloudWatch (se usando Lambda)
3. Verificar se o usuário existe no Cognito
4. Verificar se os Custom Attributes foram criados (AWS Console → Attributes)

---

**Status:** 🟢 Pronto para executar
