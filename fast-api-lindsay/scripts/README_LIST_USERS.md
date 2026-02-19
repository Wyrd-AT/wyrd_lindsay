# 📋 Script: Listar Usuários

Script para visualizar todos os usuários cadastrados no sistema Lindsay.

## 🚀 Como Usar

### Listar Todos os Usuários

```bash
cd fast-api-lindsay
python scripts/list_users.py
```

### Filtrar por Tipo

```bash
# Apenas admins
python scripts/list_users.py --type admin

# Apenas revendas/gerentes
python scripts/list_users.py --type revenda

# Apenas clientes
python scripts/list_users.py --type cliente
```

### Filtrar por Status

```bash
# Apenas usuários ativos
python scripts/list_users.py --status active

# Apenas usuários pendentes
python scripts/list_users.py --status pending

# Apenas usuários rejeitados
python scripts/list_users.py --status rejected
```

### Combinar Filtros

```bash
# Revendas pendentes
python scripts/list_users.py --type revenda --status pending

# Clientes ativos
python scripts/list_users.py --type cliente --status active
```

## 📊 Informações Exibidas

### Admins
- Nome
- Email
- Status
- Data de criação
- Criado por
- Document ID

### Revendas/Gerentes
- Nome
- Email
- Domínio
- Status
- Quantidade de clientes
- Data de criação
- Aprovado por (se aplicável)
- Data de aprovação (se aplicável)
- Document ID

### Clientes
- Nome
- Email
- Revenda associada
- Status
- Data de criação
- Aprovado por (se aplicável)
- Data de aprovação (se aplicável)
- Document ID

## 🎨 Cores no Terminal

- 🟢 **Verde**: Status ativo
- 🟡 **Amarelo**: Status pendente
- 🔴 **Vermelho**: Status rejeitado
- 🔵 **Azul**: Informações gerais

## ⚙️ Requisitos

- Python 3.12+
- Conexão com o CouchDB remoto
- VPN conectada (se necessário)
- Dependências instaladas (`pip install -r requirements.txt`)

## 📝 Exemplo de Saída

```
================================================================================
                        Usuários Cadastrados
================================================================================

────────────────────────────────────────────────────────────────────────────────
👑 ADMINS
────────────────────────────────────────────────────────────────────────────────

Total: 2 admin(s)

1. João Silva
   Email: joao@example.com
   Status: active
   Criado em: 15/01/2024 10:30
   Criado por: system
   Doc ID: admin:joao@example.com

────────────────────────────────────────────────────────────────────────────────
🏢 REVENDAS / GERENTES
────────────────────────────────────────────────────────────────────────────────

Total: 3 revenda(s)

1. Empresa ABC
   Email: contato@empresaabc.com
   Domínio: empresaabc.com
   Status: active
   Clientes: 5
   Criado em: 20/01/2024 14:00
   Aprovado por: joao@example.com
   Aprovado em: 21/01/2024 09:00
   Doc ID: revenda:empresaabc.com

────────────────────────────────────────────────────────────────────────────────
👤 CLIENTES
────────────────────────────────────────────────────────────────────────────────

Total: 10 cliente(s)

1. Fazenda São João
   Email: fazenda@example.com
   Revenda: empresaabc.com
   Status: active
   Criado em: 25/01/2024 11:00
   Aprovado por: contato@empresaabc.com
   Aprovado em: 26/01/2024 08:00
   Doc ID: user:fazenda@example.com

================================================================================
Resumo:
  Admins: 2
  Revendas: 3
  Clientes: 10
  Total: 15
================================================================================
```

## 🔧 Troubleshooting

### Erro de Conexão

Se aparecer erro de conexão com o CouchDB:
1. Verifique se está conectado à VPN
2. Verifique as credenciais em `app/core/config.py`
3. Teste a conexão manualmente:
   ```bash
   curl https://admin:wyrd@db.vpn.ind.br/_up
   ```

### Nenhum Usuário Encontrado

Se não aparecer nenhum usuário:
1. Verifique se o banco de dados está correto
2. Verifique se há usuários cadastrados
3. Tente sem filtros primeiro
