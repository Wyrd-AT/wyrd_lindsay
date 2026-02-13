# Configuração de Chamadas de Voz (Voice Call) - Twilio

## Visão Geral
A função `send_voice_call()` permite enviar chamadas de voz automatizadas via Twilio para notificar usuários sobre alarmes.

## Variáveis de Ambiente Necessárias

### Obrigatórias
```bash
TWILIO_VOICE_FROM="+5511999999999"  # Número Twilio para chamadas (formato internacional)
```

### Opcionais
```bash
TWILIO_TWIML_URL="https://seu-servidor.com/twiml"  # URL com TwiML customizado (opcional)
```

## Como Funciona

### Opção 1: Síntese de Voz Automática (Padrão)
Se `TWILIO_TWIML_URL` não for configurado, a função gera um TwiML com síntese de voz:

```xml
<Response>
  <Say voice="woman" language="pt-BR">
    Alerta do Irrigador. Mensagem do alerta...
  </Say>
  <Gather numDigits="1" timeout="5">
    <Say voice="woman" language="pt-BR">
      Pressione 1 para confirmar, ou aguarde para encerrar.
    </Say>
  </Gather>
</Response>
```

**Características:**
- Voz feminina em português brasileiro
- Mensagem de até 1000 caracteres
- Aguarda entrada do usuário (1 = confirmação)
- Timeout de 5 segundos

### Opção 2: TwiML Customizado
Se desejar controle total sobre a chamada, crie um endpoint que retorne TwiML customizado:

```python
# Exemplo: seu backend retorna TwiML
@app.route('/twiml', methods=['POST'])
def twiml():
    from twilio.twiml.voice_response import VoiceResponse

    response = VoiceResponse()
    response.say('Seu irrigador apresentou uma falha crítica', voice='woman', language='pt-BR')
    response.play('https://seu-servidor.com/audio/alerta.mp3')
    response.gather(num_digits=1, timeout=10)

    return str(response)
```

Configure:
```bash
TWILIO_TWIML_URL="https://seu-servidor.com/twiml"
```

## Integração com NOTIFICATION_MODE

Adicione `"voice"` à variável `NOTIFICATION_MODE` para ativar chamadas de voz:

```bash
# Exemplo: SMS + Voice Call + Email
NOTIFICATION_MODE="sms,voice,email"

# Exemplo: Apenas Voice Call
NOTIFICATION_MODE="voice"

# Exemplo: WhatsApp + Voice Call
NOTIFICATION_MODE="whatsapp,voice"
```

## Uso Direto da Função

```python
# Enviar chamada de voz
results = send_voice_call(
    msg="Alarme crítico detectado no pivô 01",
    to=["+5511987654321", "+5511999999999"],
    irrigador_nome="Pivô Centro"
)

# Com TwiML customizado
results = send_voice_call(
    msg="Falha de comunicação detectada",
    to=["+5511987654321"],
    irrigador_nome="Pivô Sul",
    twiml_url="https://seu-servidor.com/twiml/custom"
)
```

## Estrutura de Resposta

```python
{
    "success": [
        {
            "phone": "+5511987654321",
            "call_sid": "CA1234567890abcdef",
            "status": "queued",
            "timestamp": "2024-01-15T14:30:45-03:00",
            "type": "voice_call",
            "direction": "outbound-api",
            "duration": 0
        }
    ],
    "failed": [
        {
            "phone": "+5511912345678",
            "error": "Invalid phone number",
            "error_code": "21211",
            "timestamp": "2024-01-15T14:30:46-03:00",
            "type": "voice_call"
        }
    ],
    "invalid": []
}
```

## Monitoramento de Chamadas

Use a Twilio Console para:
1. Verificar status das chamadas
2. Ouvir gravações (se habilitadas)
3. Ver logs de detalhe

## Limites e Considerações

| Aspecto | Limite |
|---------|--------|
| Duração máxima | Sem limite (configurável) |
| Mensagem máxima | 1000 caracteres |
| Timeout de diálogo | 5 segundos (customizável) |
| Rate Limit | Configurável via `RATE_LIMIT_DELAY` |
| Idioma | Português (pt-BR) |

## Troubleshooting

### Chamada não é feita
- ✓ Verifique se `TWILIO_VOICE_FROM` está configurado
- ✓ Verifique se o cliente Twilio foi inicializado com sucesso
- ✓ Valide o número de telefone (deve ter 10-15 dígitos)

### Mensagem não é ouvida
- ✓ Verifique a configuração de voz (`voice="woman"`)
- ✓ Verifique se o idioma está correto (`language="pt-BR"`)
- ✓ Teste a mensagem no [Twilio Studio](https://www.twilio.com/studio)

### Taxa de sucesso baixa
- ✓ Aumente `RATE_LIMIT_DELAY` para evitar throttling
- ✓ Verifique os números de telefone cadastrados
- ✓ Monitore o status das chamadas na console Twilio

## Exemplos de Mensagens

```python
# Alerta de tensão baixa
msg = "Atenção! O pivô apresentou queda de tensão. Verifique a instalação."

# Falha de comunicação
msg = "Comunicação perdida com o monitor. Sistema em alerta."

# Manutenção preventiva
msg = "É hora da manutenção preventiva do seu irrigador."
```

## Segurança

- ✓ Números são validados antes do envio
- ✓ Mensagens truncadas automaticamente
- ✓ Logs de erro detalhados
- ✓ Tratamento de exceções robusto
- ✓ Rate limiting para evitar abuso

## Próximos Passos

1. Configure as variáveis de ambiente
2. Teste com um número pessoal
3. Monitore os logs iniciais
4. Ajuste as mensagens conforme necessário
5. Implemente TwiML customizado se necessário
