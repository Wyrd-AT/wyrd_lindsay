# MQTT to CouchDB - Guia de Produção

## Requisitos

- Python 3.10+
- CouchDB 3.x
- Mosquitto MQTT Broker
- Conta Twilio com WhatsApp Business aprovado

## Instalação

### 1. Dependências

```bash
pip install -r requirements.txt
```

### 2. Configuração de Ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas credenciais
nano .env
```

### 3. Arquivo de Números

Crie o arquivo `numbers.txt` com os números que receberão notificações:

```
+5511999999999
+5521988888888
+5511977777777
```

**Importante:**
- Formato internacional com `+`
- Um número por linha
- Sem espaços, parênteses ou hífens

## Configuração Twilio WhatsApp (Produção)

### Pré-requisitos

1. **Conta Twilio**: https://console.twilio.com
2. **WhatsApp Business API aprovado**

### Passos

1. **Solicitar Número WhatsApp**:
   - Console → Messaging → Senders → WhatsApp Senders
   - Request to have your Sender Approved

2. **Preencher Formulário**:
   - Nome da empresa
   - Website
   - Caso de uso (ex: "Alertas de monitoramento de irrigação")
   - Templates de mensagens

3. **Aguardar Aprovação** (1-3 semanas)

4. **Configurar Templates**:
   - Mensagens iniciadas pelo sistema precisam usar templates pré-aprovados
   - Para alertas críticos, crie template tipo "UTILITY"
   - Exemplo de template:
     ```
     Nome: alerta_irrigacao
     Categoria: UTILITY
     Idioma: pt_BR
     Corpo:
     Alarme Acionado

     ID do Irrigador: {{1}}
     ID do evento: {{2}}
     Evento: {{3}}
     Horário: {{4}}
     ```

5. **Atualizar `.env`**:
   ```bash
   TWILIO_WHATSAPP_FROM=whatsapp:+5511999999999  # Seu número aprovado
   ```

### Diferenças Sandbox vs Produção

| Aspecto | Sandbox (Teste) | Produção |
|---------|----------------|----------|
| Aprovação | Imediata | 1-3 semanas |
| Opt-in | Manual (join code) | Não necessário* |
| Mensagens | Qualquer texto | Templates aprovados** |
| Custo | Grátis | ~$0.005 por mensagem |
| Número | Compartilhado | Exclusivo |

*Para mensagens iniciadas pelo sistema (como alertas)
**Mensagens de resposta (dentro de 24h) podem ser texto livre

## Execução

### Desenvolvimento

```bash
python mqtt_to_couchdb.py
```

### Produção (com systemd)

1. **Crie o service**:

```bash
sudo nano /etc/systemd/system/mqtt-to-couchdb.service
```

```ini
[Unit]
Description=MQTT to CouchDB with WhatsApp Notifications
After=network.target mosquitto.service couchdb.service

[Service]
Type=simple
User=seu-usuario
WorkingDirectory=/caminho/para/Lightsail_python_files
Environment="PATH=/caminho/para/venv/bin"
ExecStart=/caminho/para/venv/bin/python mqtt_to_couchdb.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

2. **Ative o serviço**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable mqtt-to-couchdb
sudo systemctl start mqtt-to-couchdb
```

3. **Verifique status**:

```bash
sudo systemctl status mqtt-to-couchdb
sudo journalctl -u mqtt-to-couchdb -f  # logs em tempo real
```

## Monitoramento

### Logs

O sistema imprime logs estruturados:

```
[OK] Mensagem enviada para +5511999999999 (SID: SMxxx)
[ERRO] Falha ao enviar para +5511888888888 [Code: 21211]: Invalid 'To' Phone Number
[AVISO] 1 número(s) inválido(s)
```

### Histórico no CouchDB

Cada alarme registra histórico de notificações:

```json
{
  "notification_history": {
    "sent_at": "2025-11-10T14:30:00-03:00",
    "results": {
      "success": [
        {
          "phone": "+5511999999999",
          "message_sid": "SMxxx",
          "status": "queued",
          "timestamp": "2025-11-10T14:30:00-03:00"
        }
      ],
      "failed": [],
      "invalid": []
    },
    "total_numbers": 1,
    "success_count": 1,
    "failed_count": 0,
    "invalid_count": 0
  }
}
```

### Dashboard Twilio

- Console → Messaging → Logs
- Filtre por número remetente
- Veja status (delivered, failed, undelivered)

## Troubleshooting

### Erro: "The number +55... is unverified"

- **Sandbox**: Número precisa fazer opt-in (enviar `join xxx`)
- **Produção**: Número não está aprovado para WhatsApp Business

### Erro: "Error 21211: Invalid 'To' Phone Number"

- Formato incorreto (use formato internacional com `+`)
- Número não é WhatsApp válido

### Erro: "Error 63007: Template not found"

- Você está usando texto livre em número de produção
- Crie e use um template aprovado

### Mensagens não chegam

1. Verifique logs do sistema
2. Verifique Twilio Console → Messaging → Logs
3. Confirme que `numbers.txt` tem formato correto
4. Teste envio manual no Twilio Console

## Segurança

- ✅ Credenciais em variáveis de ambiente (não no código)
- ✅ `.gitignore` configurado para não commitar `.env`
- ✅ Validação de números antes de enviar
- ✅ Rate limiting para evitar throttling
- ✅ Tratamento de erros por número

## Custos Estimados (Twilio)

- **WhatsApp Business**: ~$0.005 USD por mensagem enviada
- **Conversação iniciada**: Primeira mensagem pode ter custo maior (~$0.042)
- **Mensagens de resposta**: Dentro de 24h, sem custo adicional

**Exemplo**: 1000 alarmes/mês para 3 números = 3000 mensagens = ~$15 USD/mês

## Suporte

- Documentação Twilio: https://www.twilio.com/docs/whatsapp
- Issues: [GitHub do projeto]
