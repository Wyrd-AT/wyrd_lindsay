import os
import re
import sys
import signal
import threading
from queue import Queue, Full, Empty
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Tuple, Set  # >>> WS ADD: Set
from zoneinfo import ZoneInfo

import couchdb
import paho.mqtt.client as mqtt
import requests
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError
from twilio.rest import Client
from twilio.base.exceptions import TwilioException

# Importações para e-mail via SendGrid (Twilio)
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False
    print("[AVISO] SendGrid não instalado. Execute: pip install sendgrid")

# >>> WS ADD: imports WebSocket/asyncio/util
import asyncio
import json
from urllib.parse import urlparse, parse_qs
import websockets
from websockets.server import WebSocketServerProtocol

# Importa módulo de push notifications
from push_notifications import (
    ensure_device_tokens_index,
    get_device_tokens,
    send_expo_push_notification,
    save_notification_log,
    should_notify,
)

# =============================================================================
# Config & Constantes
# =============================================================================
load_dotenv()

BR_TZ = ZoneInfo("America/Sao_Paulo")

COUCHDB_URL = os.getenv("COUCHDB_URL")
DATABASE = os.getenv("COUCHDB_DB")

MQTT_BROKER = os.getenv("MQTT_BROKER" )
MQTT_PORT = int(os.getenv("MQTT_PORT"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC")
MQTT_QOS = int(os.getenv("MQTT_QOS"))  # 0/1/2
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID")
MQTT_USERNAME = os.getenv("MQTT_USERNAME") or None
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD") or None

# Fila/worker
WORKER_COUNT = int(os.getenv("WORKER_COUNT", "2"))
QUEUE_MAXSIZE = int(os.getenv("QUEUE_MAXSIZE", "1000"))
QUEUE_PUT_TIMEOUT = float(os.getenv("QUEUE_PUT_TIMEOUT", "0.01"))  # seg; 0.0 ~ try-nowait
ON_QUEUE_FULL = os.getenv("ON_QUEUE_FULL", "drop")  # "drop" | "block"

FILENAME_PHONES = os.getenv("WHATSAPP_NUMBERS_FILE", "numbers.txt")
FILENAME_EMAILS = os.getenv("EMAIL_FILE", "emails.txt")

# Configurações Twilio
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")
TWILIO_SMS_FROM = os.getenv("TWILIO_SMS_FROM")
TWILIO_VOICE_FROM = os.getenv("TWILIO_VOICE_FROM")  # Número para chamadas de voz
TWILIO_TEMPLATE_SID = os.getenv("TWILIO_TEMPLATE_SID")
TWILIO_TWIML_URL = os.getenv("TWILIO_TWIML_URL")  # URL do TwiML para mensagem de voz

# Configurações SendGrid (Email)
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Sistema de Alarmes Lindsay")

# Configurações Z-API (WhatsApp)
ZAPI_INSTANCE = os.getenv("ZAPI_INSTANCE")
ZAPI_TOKEN = os.getenv("ZAPI_TOKEN")
ZAPI_CLIENT_TOKEN = os.getenv("ZAPI_CLIENT_TOKEN")
ZAPI_BASE_URL = os.getenv("ZAPI_BASE_URL")

# Modo de notificação: whatsapp, whatsapp_twilio, whatsapp_zapi, sms, email ou combinações
# Exemplos:
#   - "whatsapp,sms" (usa Z-API se configurado, senão Twilio)
#   - "whatsapp_twilio,sms" (força uso do Twilio)
#   - "whatsapp_zapi,email" (força uso do Z-API)
#   - "whatsapp_twilio,whatsapp_zapi,sms" (envia por ambos)
NOTIFICATION_MODE = os.getenv("NOTIFICATION_MODE")

# Rate limiting
RATE_LIMIT_DELAY = float(os.getenv("RATE_LIMIT_DELAY"))

# >>> WS ADD: Config WebSocket
WS_HOST = os.getenv("WS_HOST")
WS_PORT = int(os.getenv("WS_PORT"))
WS_PATH = os.getenv("WS_PATH")
WS_PING_INTERVAL = int(os.getenv("WS_PING_INTERVAL"))

# =============================================================================
# Logging simples
# =============================================================================
def log(level: str, msg: str):
    ts = datetime.now(BR_TZ).strftime("%Y-%m-%d %H:%M:%S")
    print(f"{ts} [{level.upper()}] {msg}", flush=True)

# =============================================================================
# Twilio (opcional)
# =============================================================================
twilio_client: Optional[Client] = None
mqtt_publisher_client: Optional[mqtt.Client] = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        log("ok", "Twilio configurado.")
    except Exception as e:
        log("warn", f"Falha ao inicializar Twilio: {e}")
else:
    log("warn", "Twilio não configurado. Notificações WhatsApp desativadas.")

STATUS_MAP = {
    "0": "OK",
    "1": "Alarmado",
    "2": "Reconhecido",
    "3": "Resolvido",
    "9": "Ausente",
}
MONITOR_TENSAO = {
    "01": "MT01", "02": "MT02", "03": "MT03", "04": "MT04",
    "05": "MT05", "06": "MT06", "07": "MT07", "08": "MT08",
    "09": "MT09", "10": "MT10", "11": "MT11", "12": "MT12",
    "13": "MT13", "14": "MT14", "17": "Painel 1", "18": "Painel 2",
}

# =============================================================================
# Helpers de tempo / formatação
# =============================================================================
def fmt_ts(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BR_TZ)
    else:
        dt = dt.astimezone(BR_TZ)
    return dt.strftime("%H:%M:%S %d/%m/%Y")

def fmt_ts_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BR_TZ)
    else:
        dt = dt.astimezone(BR_TZ)
    return dt.isoformat()

def get_month_key() -> str:
    return datetime.now(BR_TZ).strftime("%Y-%m")

def read_file(filename: str) -> List[str]:
    try:
        with open(filename, "r", encoding="utf-8") as f:
            return [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        return []
    except Exception as e:
        log("error", f"Falha ao ler '{filename}': {e}")
        return []

# =============================================================================
# Validação de contatos
# =============================================================================
def validate_phone_number(phone: str) -> bool:
    """
    Valida formato de número de telefone.
    Aceita formatos: +5511999999999, 5511999999999, +11999999999
    """
    cleaned = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    pattern = r'^\+?\d{10,15}$'
    return bool(re.match(pattern, cleaned))

def validate_email(email: str) -> bool:
    """Valida formato de e-mail."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip()))

# =============================================================================
# Funções de envio de notificações (SMS, WhatsApp, Email)
# =============================================================================
def send_sms(msg: str, to: List[str], irrigador_nome: Optional[str] = None) -> Dict[str, Any]:
    """
    Envia SMS via Twilio para múltiplos números.

    Args:
        msg: Corpo da mensagem SMS (máximo 1600 caracteres)
        to: Lista de números no formato internacional (+5511999999999)
        irrigador_nome: Nome do irrigador para incluir na mensagem (opcional)

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {"success": [], "failed": [], "invalid": []}

    if not to:
        log("warn", "Nenhum número para enviar SMS")
        return results

    equipamento_info = f" ({irrigador_nome})" if irrigador_nome else ""
    log("info", f"Iniciando envio de SMS{equipamento_info} para {len(to)} número(s)")

    if not TWILIO_SMS_FROM:
        log("error", "TWILIO_SMS_FROM não configurado. Não é possível enviar SMS.")
        return results
    else:
        log("info", f"Usando remetente SMS: {TWILIO_SMS_FROM}")

    if not twilio_client:
        log("error", "Cliente Twilio não inicializado")
        return results
    else:
        log("info", "Cliente Twilio inicializado para SMS")

    # Adiciona nome do irrigador à mensagem se fornecido
    if irrigador_nome:
        msg = f"[{irrigador_nome}] {msg}"

    # Limita mensagem SMS a 1600 caracteres
    if len(msg) > 1600:
        msg = msg[:1597] + "..."
        log("warn", "Mensagem SMS truncada para 1600 caracteres")
    else:
        log("info", f"Mensagem SMS com {len(msg)} caracteres")

    for i, phone in enumerate(to):
        # Valida formato do número
        if not validate_phone_number(phone):
            results["invalid"].append({"phone": phone, "reason": "Formato inválido"})
            log("warn", f"Número inválido ignorado: {phone}")
            continue
        else:
            log("info", f"Número válido para SMS: {phone}")

        # Rate limiting
        if i > 0:
            import time
            time.sleep(RATE_LIMIT_DELAY)

        try:
            # Garante que número tem +
            phone_formatted = phone if phone.startswith("+") else f"+{phone}"

            # Envia SMS
            message = twilio_client.messages.create(
                body=msg,
                from_=TWILIO_SMS_FROM,
                to=phone_formatted,
            )

            results["success"].append({
                "phone": phone,
                "message_sid": message.sid,
                "status": message.status,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "sms"
            })
            log("ok", f"SMS enviado para {phone} (SID: {message.sid})")

        except TwilioException as e:
            error_code = getattr(e, 'code', None)
            results["failed"].append({
                "phone": phone,
                "error": str(e),
                "error_code": error_code,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "sms"
            })
            log("error", f"Falha ao enviar SMS para {phone} [Code: {error_code}]: {str(e)}")

        except Exception as e:
            results["failed"].append({
                "phone": phone,
                "error": f"Erro inesperado: {str(e)}",
                "error_code": None,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "sms"
            })
            log("error", f"Erro inesperado ao enviar SMS para {phone}: {type(e).__name__} - {str(e)}")

    return results

def send_voice_call(msg: str, to: List[str], irrigador_nome: Optional[str] = None, twiml_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Envia chamada de voz via Twilio para múltiplos números.

    Args:
        msg: Corpo da mensagem de voz (será convertido em TwiML com síntese de voz)
        to: Lista de números no formato internacional (+5511999999999)
        irrigador_nome: Nome do irrigador para incluir na mensagem (opcional)
        twiml_url: URL do TwiML customizado para a chamada (opcional)

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {"success": [], "failed": [], "invalid": []}

    if not to:
        log("warn", "Nenhum número para enviar chamada de voz")
        return results

    equipamento_info = f" ({irrigador_nome})" if irrigador_nome else ""
    log("info", f"Iniciando envio de chamadas de voz{equipamento_info} para {len(to)} número(s)")

    if not TWILIO_VOICE_FROM:
        log("error", "TWILIO_VOICE_FROM não configurado. Não é possível enviar chamadas de voz.")
        return results
    else:
        log("info", f"Usando remetente de voz: {TWILIO_VOICE_FROM}")

    if not twilio_client:
        log("error", "Cliente Twilio não inicializado")
        return results
    else:
        log("info", "Cliente Twilio inicializado para chamadas de voz")

    # Prepara URL do TwiML
    if twiml_url is None:
        twiml_url = TWILIO_TWIML_URL

    if not twiml_url:
        # Se não houver URL customizado, cria TwiML inline com síntese de voz
        # Adiciona nome do irrigador à mensagem se fornecido
        if irrigador_nome:
            msg = f"Alerta do {irrigador_nome}. {msg}"

        # Limita mensagem a 1000 caracteres para síntese de voz
        if len(msg) > 1000:
            msg = msg[:997] + "..."
            log("warn", "Mensagem de voz truncada para 1000 caracteres")
        else:
            log("info", f"Mensagem de voz com {len(msg)} caracteres")

    for i, phone in enumerate(to):
        # Valida formato do número
        if not validate_phone_number(phone):
            results["invalid"].append({"phone": phone, "reason": "Formato inválido"})
            log("warn", f"Número inválido ignorado: {phone}")
            continue
        else:
            log("info", f"Número válido para chamada de voz: {phone}")

        # Rate limiting
        if i > 0:
            import time
            time.sleep(RATE_LIMIT_DELAY)

        try:
            # Garante que número tem +
            phone_formatted = phone if phone.startswith("+") else f"+{phone}"

            # Se houver URL customizado, usa direto
            if twiml_url:
                log("debug", f"Usando TwiML URL customizado: {twiml_url}")
                call = twilio_client.calls.create(
                    from_=TWILIO_VOICE_FROM,
                    to=phone_formatted,
                    url=twiml_url
                )
            else:
                # Cria TwiML com síntese de voz (texto-para-fala)
                twiml_body = f'<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="woman" language="pt-BR">{msg}</Say><Gather numDigits="1" timeout="5"><Say voice="woman" language="pt-BR">Pressione 1 para confirmar, ou aguarde para encerrar.</Say></Gather></Response>'

                log("debug", f"Enviando chamada com síntese de voz para {phone}")
                call = twilio_client.calls.create(
                    from_=TWILIO_VOICE_FROM,
                    to=phone_formatted,
                    twiml=twiml_body
                )

            results["success"].append({
                "phone": phone,
                "call_sid": call.sid,
                "status": call.status,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "voice_call",
                "direction": call.direction,
                "duration": call.duration
            })
            log("ok", f"Chamada de voz enviada para {phone} (SID: {call.sid})")

        except TwilioException as e:
            error_code = getattr(e, 'code', None)
            results["failed"].append({
                "phone": phone,
                "error": str(e),
                "error_code": error_code,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "voice_call"
            })
            log("error", f"Falha ao enviar chamada de voz para {phone} [Code: {error_code}]: {str(e)}")

        except Exception as e:
            results["failed"].append({
                "phone": phone,
                "error": f"Erro inesperado: {str(e)}",
                "error_code": None,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "voice_call"
            })
            log("error", f"Erro inesperado ao enviar chamada de voz para {phone}: {type(e).__name__} - {str(e)}")

    return results

def send_email(subject: str, body_text: str, body_html: str, to: List[str]) -> Dict[str, Any]:
    """
    Envia e-mail via SendGrid para múltiplos destinatários.

    Args:
        subject: Assunto do e-mail
        body_text: Corpo em texto puro
        body_html: Corpo em HTML
        to: Lista de e-mails destinatários

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {"success": [], "failed": [], "invalid": []}

    if not to:
        log("warn", "Nenhum e-mail para enviar")
        return results

    if not SENDGRID_AVAILABLE:
        log("error", "SendGrid não instalado. Execute: pip install sendgrid")
        return results

    if not SENDGRID_API_KEY or not EMAIL_FROM:
        log("error", "SENDGRID_API_KEY ou EMAIL_FROM não configurados no .env")
        return results

    for i, email_addr in enumerate(to):
        # Valida formato do e-mail
        if not validate_email(email_addr):
            results["invalid"].append({"email": email_addr, "reason": "Formato inválido"})
            log("warn", f"E-mail inválido ignorado: {email_addr}")
            continue

        # Rate limiting
        if i > 0:
            import time
            time.sleep(RATE_LIMIT_DELAY)

        try:
            # Cria mensagem
            message = Mail(
                from_email=Email(EMAIL_FROM, EMAIL_FROM_NAME),
                to_emails=To(email_addr),
                subject=subject,
                plain_text_content=Content("text/plain", body_text),
                html_content=Content("text/html", body_html)
            )

            # Envia via SendGrid
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            response = sg.send(message)

            results["success"].append({
                "email": email_addr,
                "status_code": response.status_code,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "email"
            })
            log("ok", f"E-mail enviado para {email_addr} (Status: {response.status_code})")

        except Exception as e:
            results["failed"].append({
                "email": email_addr,
                "error": str(e),
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "email"
            })
            log("error", f"Falha ao enviar e-mail para {email_addr}: {str(e)}")

    return results

def send_whatsapp_zapi(msg: str, to: List[str]) -> Dict[str, Any]:
    """
    Envia mensagem WhatsApp via Z-API para múltiplos números.

    Args:
        msg: Corpo da mensagem
        to: Lista de números no formato internacional (5511999999999 - sem + ou espaços)

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {"success": [], "failed": [], "invalid": []}

    if not to:
        log("warn", "Nenhum número para enviar WhatsApp")
        return results

    if not ZAPI_INSTANCE or not ZAPI_TOKEN or not ZAPI_CLIENT_TOKEN:
        log("error", "Z-API não configurado (ZAPI_INSTANCE, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN)")
        return results

    # Monta URL da API
    url = f"{ZAPI_BASE_URL}/instances/{ZAPI_INSTANCE}/token/{ZAPI_TOKEN}/send-text"

    # Headers
    headers = {
        "Client-Token": ZAPI_CLIENT_TOKEN,
        "Content-Type": "application/json"
    }

    for i, phone in enumerate(to):
        # Valida formato do número
        if not validate_phone_number(phone):
            results["invalid"].append({"phone": phone, "reason": "Formato inválido"})
            log("warn", f"Número inválido ignorado: {phone}")
            continue

        # Rate limiting
        if i > 0:
            import time
            time.sleep(RATE_LIMIT_DELAY)

        try:
            # Remove caracteres não numéricos (+ - espaços parênteses)
            phone_clean = re.sub(r'[^\d]', '', phone)

            # Z-API espera números sem o +
            if phone_clean.startswith('+'):
                phone_clean = phone_clean[1:]

            # Payload da requisição
            payload = {
                "phone": phone_clean,
                "message": msg
            }

            # Envia requisição
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code == 200:
                response_data = response.json()
                results["success"].append({
                    "phone": phone,
                    "zaapId": response_data.get("zaapId"),
                    "messageId": response_data.get("messageId"),
                    "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                    "type": "whatsapp"
                })
                log("ok", f"WhatsApp enviado via Z-API para {phone} (messageId: {response_data.get('messageId')})")
            else:
                error_msg = f"HTTP {response.status_code}: {response.text}"
                results["failed"].append({
                    "phone": phone,
                    "error": error_msg,
                    "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                    "type": "whatsapp"
                })
                log("error", f"Falha ao enviar WhatsApp via Z-API para {phone}: {error_msg}")

        except requests.exceptions.Timeout:
            results["failed"].append({
                "phone": phone,
                "error": "Timeout na requisição (30s)",
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp"
            })
            log("error", f"Timeout ao enviar WhatsApp via Z-API para {phone}")

        except requests.exceptions.RequestException as e:
            results["failed"].append({
                "phone": phone,
                "error": f"Erro de conexão: {str(e)}",
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp"
            })
            log("error", f"Erro de conexão ao enviar WhatsApp via Z-API para {phone}: {str(e)}")

        except Exception as e:
            results["failed"].append({
                "phone": phone,
                "error": f"Erro inesperado: {str(e)}",
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp"
            })
            log("error", f"Erro inesperado ao enviar WhatsApp via Z-API para {phone}: {type(e).__name__} - {str(e)}")

    return results

def send_whatsapp_twilio_template(to: List[str], irrigador_nome: Optional[str] = None) -> Dict[str, Any]:
    """
    Envia mensagem WhatsApp via Twilio usando template aprovado pela Meta.
    Template: "Olá, O pivô apresentou falhas. Por gentileza abra seu aplicativo ou site e confira."

    Args:
        to: Lista de números no formato internacional (+5511999999999)
        irrigador_nome: Nome do irrigador para incluir nos logs (opcional)

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {"success": [], "failed": [], "invalid": []}

    if not to:
        log("warn", "Nenhum número para enviar WhatsApp")
        return results

    if not twilio_client:
        log("error", "Cliente Twilio não inicializado")
        return results

    if not TWILIO_TEMPLATE_SID:
        log("error", "TWILIO_TEMPLATE_SID não configurado - necessário para template aprovado")
        return results

    # Template aprovado pela Meta (mensagem fixa)
    template_message = "Olá,\nO pivô apresentou falhas.\nPor gentileza abra seu aplicativo ou site e confira."

    equipamento_info = f" ({irrigador_nome})" if irrigador_nome else ""
    log("info", f"Enviando WhatsApp template{equipamento_info} para {len(to)} número(s)")

    for i, phone in enumerate(to):
        # Valida formato do número
        if not validate_phone_number(phone):
            results["invalid"].append({"phone": phone, "reason": "Formato inválido"})
            log("warn", f"Número inválido ignorado: {phone}")
            continue

        # Rate limiting
        if i > 0:
            import time
            time.sleep(RATE_LIMIT_DELAY)

        try:
            # Garante formato whatsapp:+5511999999999
            phone_formatted = phone if phone.startswith("+") else f"+{phone}"

            # Envia usando Content Template API (template aprovado)
            message = twilio_client.messages.create(
                from_=TWILIO_WHATSAPP_FROM,
                content_sid=TWILIO_TEMPLATE_SID,
                to=f"whatsapp:{phone_formatted}"
            )

            results["success"].append({
                "phone": phone,
                "message_sid": message.sid,
                "status": message.status,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp_template",
                "template_used": TWILIO_TEMPLATE_SID,
                "irrigador_nome": irrigador_nome
            })
            log("ok", f"WhatsApp (template Meta){equipamento_info} enviado para {phone} (SID: {message.sid})")

        except TwilioException as e:
            error_code = getattr(e, 'code', None)
            results["failed"].append({
                "phone": phone,
                "error": str(e),
                "error_code": error_code,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp_template"
            })
            log("error", f"Falha ao enviar WhatsApp template{equipamento_info} para {phone} [Code: {error_code}]: {str(e)}")

        except Exception as e:
            results["failed"].append({
                "phone": phone,
                "error": f"Erro inesperado: {str(e)}",
                "error_code": None,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp_template"
            })
            log("error", f"Erro inesperado ao enviar WhatsApp template{equipamento_info} para {phone}: {type(e).__name__} - {str(e)}")

    return results

def send_whatsapp(msg: str, to: List[str], template_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Envia mensagem WhatsApp via Twilio para múltiplos números.

    Args:
        msg: Corpo da mensagem (usado se não houver template)
        to: Lista de números no formato internacional (+5511999999999)
        template_params: Dict com parâmetros para template aprovado

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {"success": [], "failed": [], "invalid": []}

    if not to:
        log("warn", "Nenhum número para enviar WhatsApp")
        return results

    if not twilio_client:
        log("error", "Cliente Twilio não inicializado")
        return results

    for i, phone in enumerate(to):
        # Valida formato do número
        if not validate_phone_number(phone):
            results["invalid"].append({"phone": phone, "reason": "Formato inválido"})
            log("warn", f"Número inválido ignorado: {phone}")
            continue

        # Rate limiting
        if i > 0:
            import time
            time.sleep(RATE_LIMIT_DELAY)

        try:
            # Prepara parâmetros da mensagem
            message_params = {
                "from_": TWILIO_WHATSAPP_FROM,
                "to": f"whatsapp:{phone}",
            }

            # Usa template se disponível
            if TWILIO_TEMPLATE_SID and template_params:
                cleaned_params = {}
                for key, value in template_params.items():
                    if value is not None:
                        cleaned_value = str(value).replace("\n", " ").replace("\t", " ").replace("\r", " ")
                        cleaned_value = " ".join(cleaned_value.split())
                        cleaned_params[key] = cleaned_value
                    else:
                        cleaned_params[key] = ""

                message_params["content_sid"] = TWILIO_TEMPLATE_SID
                message_params["content_variables"] = json.dumps(cleaned_params)
            else:
                message_params["body"] = msg

            # Envia mensagem
            message = twilio_client.messages.create(**message_params)

            results["success"].append({
                "phone": phone,
                "message_sid": message.sid,
                "status": message.status,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp"
            })
            log("ok", f"WhatsApp enviado para {phone} (SID: {message.sid})")

        except TwilioException as e:
            error_code = getattr(e, 'code', None)
            results["failed"].append({
                "phone": phone,
                "error": str(e),
                "error_code": error_code,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp"
            })
            log("error", f"Falha ao enviar WhatsApp para {phone} [Code: {error_code}]: {str(e)}")

        except Exception as e:
            results["failed"].append({
                "phone": phone,
                "error": f"Erro inesperado: {str(e)}",
                "error_code": None,
                "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
                "type": "whatsapp"
            })
            log("error", f"Erro inesperado ao enviar WhatsApp para {phone}: {type(e).__name__} - {str(e)}")

    return results

def send_notification(msg: str, contacts: Dict[str, List[str]], template_params: Optional[Dict[str, Any]] = None,
                     email_subject: Optional[str] = None, email_html: Optional[str] = None,
                     irrigador_nome: Optional[str] = None) -> Dict[str, Any]:
    """
    Envia notificação via WhatsApp, SMS e/ou E-mail.

    Args:
        msg: Corpo da mensagem
        contacts: Dict com 'phones' e 'emails'
        template_params: Parâmetros para template WhatsApp
        email_subject: Assunto do e-mail
        email_html: Corpo HTML do e-mail

    Returns:
        dict agregado com resultados de todos os envios
    """
    all_results = {
        "success": [],
        "failed": [],
        "invalid": [],
        "modes_used": []
    }

    phones = contacts.get("phones", [])
    emails = contacts.get("emails", [])
    modes = [m.strip() for m in NOTIFICATION_MODE.split(",")]
    log("info", f"Modos de notificação configurados: {modes}")

    # WhatsApp genérico (usa Z-API se configurado, senão Twilio)
    if "whatsapp" in modes and phones:
        log("info", "Enviando via WhatsApp (modo automático)...")
        # Usa Z-API se configurado, senão usa Twilio (fallback)
        if ZAPI_INSTANCE and ZAPI_TOKEN and ZAPI_CLIENT_TOKEN:
            log("info", "Usando Z-API para WhatsApp (auto)")
            # Remove + dos números para Z-API (formato: 5511999999999)
            phones_cleaned = [phone.lstrip('+') if phone.startswith('+') else phone for phone in phones]
            log("debug", f"Números formatados para Z-API: {phones_cleaned}")
            whatsapp_results = send_whatsapp_zapi(msg, phones_cleaned)
        else:
            log("info", "Usando Twilio para WhatsApp com template aprovado pela Meta (auto)")
            # Usa template aprovado pela Meta (mensagem fixa)
            whatsapp_results = send_whatsapp_twilio_template(phones, irrigador_nome)
        all_results["success"].extend(whatsapp_results["success"])
        all_results["failed"].extend(whatsapp_results["failed"])
        all_results["invalid"].extend(whatsapp_results["invalid"])
        all_results["modes_used"].append("whatsapp")

    # WhatsApp via Twilio (forçado)
    if "whatsapp_twilio" in modes and phones:
        log("info", "Enviando via WhatsApp Twilio (forçado)...")
        if not twilio_client:
            log("error", "Cliente Twilio não configurado - pulando whatsapp_twilio")
        else:
            whatsapp_results = send_whatsapp_twilio_template(phones, irrigador_nome)
            all_results["success"].extend(whatsapp_results["success"])
            all_results["failed"].extend(whatsapp_results["failed"])
            all_results["invalid"].extend(whatsapp_results["invalid"])
            all_results["modes_used"].append("whatsapp_twilio")

    # WhatsApp via Z-API (forçado)
    if "whatsapp_zapi" in modes and phones:
        log("info", "Enviando via WhatsApp Z-API (forçado)...")
        if not (ZAPI_INSTANCE and ZAPI_TOKEN and ZAPI_CLIENT_TOKEN):
            log("error", "Z-API não configurado - pulando whatsapp_zapi")
        else:
            # Remove + dos números para Z-API (formato: 5511999999999)
            phones_cleaned = [phone.lstrip('+') if phone.startswith('+') else phone for phone in phones]
            log("debug", f"Números formatados para Z-API: {phones_cleaned}")
            whatsapp_results = send_whatsapp_zapi(msg, phones_cleaned)
            all_results["success"].extend(whatsapp_results["success"])
            all_results["failed"].extend(whatsapp_results["failed"])
            all_results["invalid"].extend(whatsapp_results["invalid"])
            all_results["modes_used"].append("whatsapp_zapi")

    if "sms" in modes and phones:
        log("info", "Enviando via SMS...")
        sms_results = send_sms(msg, phones, irrigador_nome)
        all_results["success"].extend(sms_results["success"])
        all_results["failed"].extend(sms_results["failed"])
        all_results["invalid"].extend(sms_results["invalid"])
        all_results["modes_used"].append("sms")

    if "voice" in modes and phones:
        log("info", "Enviando via Chamada de Voz...")
        voice_results = send_voice_call(msg, phones, irrigador_nome)
        all_results["success"].extend(voice_results["success"])
        all_results["failed"].extend(voice_results["failed"])
        all_results["invalid"].extend(voice_results["invalid"])
        all_results["modes_used"].append("voice")

    if "email" in modes and emails:
        log("info", "Enviando via E-mail...")
        email_results = send_email(
            subject=email_subject or "Alarme Acionado",
            body_text=msg,
            body_html=email_html or f"<pre>{msg}</pre>",
            to=emails
        )
        all_results["success"].extend(email_results["success"])
        all_results["failed"].extend(email_results["failed"])
        all_results["invalid"].extend(email_results["invalid"])
        all_results["modes_used"].append("email")

    return all_results

# =============================================================================
# CouchDB (lib couchdb)
# =============================================================================
def get_couch_server() -> Optional[couchdb.Server]:
    try:
        return couchdb.Server(COUCHDB_URL)
    except Exception as e:
        log("error", f"Erro ao conectar ao CouchDB: {e}")
        return None

def ensure_db(server: couchdb.Server, dbname: str):
    try:
        return server[dbname]
    except couchdb.http.ResourceNotFound:
        try:
            server.create(dbname)
            log("ok", f"DB '{dbname}' criado")
            return server[dbname]
        except Exception as e:
            log("error", f"Falha ao criar DB '{dbname}': {e}")
            return None
    except Exception as e:
        log("error", f"Falha ao acessar DB '{dbname}': {e}")
        return None

def get_couch_db():
    server = get_couch_server()
    if not server:
        return None
    return ensure_db(server, DATABASE)

def query_couchdb(query: Dict[str, Any]):
    db = get_couch_db()
    if db is None:
        return None
    try:
        return db.find(query)
    except Exception as e:
        log("error", f"Erro ao executar query: {e}")
        return None

def upsert_doc(doc_id: str, doc_data: Dict[str, Any]) -> Optional[str]:
    db = get_couch_db()
    if db is None:
        return None
    try:
        existing = db.get(doc_id)
        if existing is None:
            to_save = {**doc_data, "_id": doc_id}
            _id, _rev = db.save(to_save)
            return _id
        else:
            merged = {**existing, **doc_data}
            merged["_id"] = doc_id
            merged["_rev"] = existing["_rev"]
            _id, _rev = db.save(merged)
            return _id
    except couchdb.http.ResourceConflict:
        try:
            fresh = db.get(doc_id)
            if fresh is None:
                to_save = {**doc_data, "_id": doc_id}
                _id, _rev = db.save(to_save)
            else:
                merged = {**fresh, **doc_data}
                merged["_id"] = doc_id
                merged["_rev"] = fresh["_rev"]
                _id, _rev = db.save(merged)
            return _id
        except Exception as e2:
            log("error", f"Upsert conflitou novamente para {doc_id}: {e2}")
            return None
    except Exception as e:
        log("error", f"Falha no upsert de {doc_id}: {e}")
        return None

def insert_doc(doc_data: Dict[str, Any]) -> Optional[str]:
    db = get_couch_db()
    if db is None:
        return None
    try:
        _id, _rev = db.save(doc_data)
        return _id
    except couchdb.http.ResourceConflict:
        log("error", "Insert conflitou (id duplicado). Use upsert_doc se precisar id fixo.")
        return None
    except Exception as e:
        log("error", f"Falha no insert: {e}")
        return None

def update_monthly_history(irrigador_id: str, data_type: str, doc_id: str) -> None:
    db = get_couch_db()
    if db is None:
        return
    month_key = get_month_key()
    history_id = f"history::{irrigador_id}::{data_type}::{month_key}"
    try:
        history_doc = db.get(history_id)
        now_iso = fmt_ts_iso(datetime.now(BR_TZ))
        if history_doc is None:
            history_doc = {
                "_id": history_id,
                "table": "monthly_history",
                "irrigadorId": irrigador_id,
                "dataType": data_type,
                "month": month_key,
                "created_at": now_iso,
                "records": [],
            }
        history_doc.setdefault("records", []).append({"doc_id": doc_id, "timestamp": now_iso})
        history_doc["updated_at"] = now_iso
        history_doc["count"] = len(history_doc["records"])
        upsert_doc(history_id, history_doc)
    except Exception as e:
        log("error", f"Falha ao atualizar histórico: {e}")

# =============================================================================
# Modelo e config de notificação
# =============================================================================
class Notification(BaseModel):
    table: Literal["notificacao"]
    status: bool
    class Config:
        extra = "allow"

def query_notification() -> Optional[Notification]:
    query = {"selector": {"table": {"$regex": "notificacao"}}, "limit": 1}
    result = query_couchdb(query)
    if result is None:
        return None
    item = next(result, None)
    if not item:
        return None
    try:
        return Notification.model_validate(item)
    except ValidationError as e:
        log("error", f"Validação Notification: {e}")
        return None

def is_whatsapp_enabled_for_irrigador(irrigador_id: str) -> bool:
    """
    Verifica se as notificações WhatsApp/SMS estão ativadas para um irrigador específico.

    Args:
        irrigador_id: ID do irrigador (ex: LIND01)

    Returns:
        True se ativado (ou se não existir configuração), False se desativado
    """
    try:
        db = get_couch_db()
        if db is None:
            log("warn", "CouchDB não disponível - assumindo WhatsApp ativado")
            return True

        doc_id = f"whatsapp_config:{irrigador_id}"
        config_doc = db.get(doc_id)

        if config_doc is None:
            # Não existe configuração - padrão é ativado
            return True

        # Retorna o valor configurado (padrão True se campo não existir)
        return config_doc.get("whatsapp_enabled", True)

    except Exception as e:
        log("warn", f"Erro ao verificar config WhatsApp para {irrigador_id}: {e} - assumindo ativado")
        return True


def get_irrigador_info(irrigador_id: str) -> Dict[str, Any]:
    """
    Busca informações completas do irrigador no CouchDB.

    Args:
        irrigador_id: ID do irrigador (ex: LIND01)

    Returns:
        Dict com 'nome', 'phones', 'emails', 'equipamentos' (array de nomes) e outros dados do irrigador
    """
    info = {"nome": None, "phones": [], "emails": [], "codigo": irrigador_id, "equipamentos": []}

    try:
        query = {
            "selector": {
                "table": "irrigadores",
                "codigo": irrigador_id
            },
            "limit": 1
        }

        result = query_couchdb(query)
        if result is None:
            log("warn", f"Nenhum irrigador encontrado para {irrigador_id}")
            return info

        irrigador_doc = next(result, None)
        if not irrigador_doc:
            log("warn", f"Documento do irrigador {irrigador_id} não encontrado")
            return info

        # Extrai nome do irrigador
        info["nome"] = irrigador_doc.get("nome") or irrigador_doc.get("name") or irrigador_id

        # Extrai array de nomes dos equipamentos/monitores
        equipamentos = irrigador_doc.get("equipamentos", [])
        if isinstance(equipamentos, list):
            info["equipamentos"] = equipamentos

        # Extrai contatos do documento
        irrigador_contacts = irrigador_doc.get("contacts", {})

        # WhatsApp
        whatsapp = irrigador_contacts.get("whatsapp")
        if whatsapp and validate_phone_number(whatsapp):
            info["phones"].append(whatsapp)
        elif whatsapp:
            log("warn", f"WhatsApp inválido para {irrigador_id}: {whatsapp}")

        # SMS (número diferente do WhatsApp)
        sms = irrigador_contacts.get("sms")
        if sms and validate_phone_number(sms):
            # Só adiciona se for diferente do WhatsApp
            if sms not in info["phones"]:
                info["phones"].append(sms)
        elif sms:
            log("warn", f"SMS inválido para {irrigador_id}: {sms}")

        # Email
        email = irrigador_contacts.get("email")
        if email and validate_email(email):
            info["emails"].append(email)
        elif email:
            log("warn", f"Email inválido para {irrigador_id}: {email}")

        log("info", f"Info do irrigador {irrigador_id} ('{info['nome']}'): {len(info['equipamentos'])} equipamento(s), {len(info['phones'])} telefone(s), {len(info['emails'])} email(s)")

    except Exception as e:
        log("error", f"Erro ao buscar info do irrigador {irrigador_id}: {e}")

    return info

def get_irrigador_contacts(irrigador_id: str) -> Dict[str, List[str]]:
    """
    Busca os contatos cadastrados para um irrigador específico no CouchDB.

    Args:
        irrigador_id: ID do irrigador (ex: LIND01)

    Returns:
        Dict com 'phones' (lista de WhatsApp/SMS) e 'emails' (lista de emails)
    """
    info = get_irrigador_info(irrigador_id)
    return {"phones": info["phones"], "emails": info["emails"]}

def get_equipment_name_from_monitor(monitor: str, equipamentos: List[str]) -> str:
    """
    Mapeia o número do monitor para o nome do equipamento.

    Lógica de mapeamento:
    - Monitor 17 → equipamentos[0] (primeiro equipamento - Painel 1)
    - Monitor 18 → equipamentos[1] (segundo equipamento - Painel 2)
    - Monitor 01 → equipamentos[2] (terceiro equipamento)
    - Monitor 02 → equipamentos[3] (quarto equipamento)
    - Monitor 03 → equipamentos[4] (quinto equipamento)
    - E assim por diante: Monitor XX → equipamentos[XX + 1]

    Args:
        monitor: Número do monitor como string (ex: "01", "17", "18")
        equipamentos: Lista de nomes dos equipamentos

    Returns:
        Nome do equipamento ou "Monitor {monitor}" se não encontrado
    """
    try:
        monitor_num = int(monitor)

        # Calcula índice no array de equipamentos
        if monitor_num == 17:
            idx = 0
        elif monitor_num == 18:
            idx = 1
        else:
            idx = monitor_num + 1

        # Verifica se índice é válido
        if idx < 0 or idx >= len(equipamentos):
            return f"Monitor {monitor}"

        # Retorna nome do equipamento
        equipamento = equipamentos[idx]

        # Se equipamento é dict, extrai nome
        if isinstance(equipamento, dict):
            return equipamento.get("nome") or equipamento.get("name") or f"Monitor {monitor}"

        # Se equipamento é string, retorna diretamente
        if isinstance(equipamento, str):
            return equipamento

        return f"Monitor {monitor}"

    except (ValueError, IndexError) as e:
        log("warn", f"Erro ao mapear monitor {monitor}: {e}")
        return f"Monitor {monitor}"

# =============================================================================
# Parsers
# =============================================================================
def parse_vetor_tensao(payload: str) -> Dict[str, Any]:
    parts = payload.strip().split(";")
    if len(parts) < 3:
        raise ValueError("Vetor tensão inválido: menos de 3 partes")
    pivo_tipo = parts[0]
    if len(pivo_tipo) < 2:
        raise ValueError(f"Identificação inválida: {pivo_tipo}")
    irrigador_id = pivo_tipo[:-1]
    tipo = pivo_tipo[-1]
    if tipo not in ['A', 'B', 'C', 'D']:
        raise ValueError(f"Tipo de vetor inválido: {tipo}")
    timestamp_str = parts[1]
    try:
        dt = datetime.fromisoformat(timestamp_str)
    except ValueError:
        raise ValueError(f"Timestamp inválido: {timestamp_str}")

    monitor_ranges = {'A': (1, 7), 'B': (8, 14), 'C': (15, 21), 'D': (22, 28)}
    start, end = monitor_ranges[tipo]
    base_offset = {'A': 0, 'B': 7, 'C': 14, 'D': 21}

    monitores: Dict[str, Any] = {}
    readings = parts[2:]
    for idx, reading in enumerate(readings, start=1):
        reading = reading.strip()
        if len(reading) < 5:
            continue
        try:
            tension_str = reading[:-1]
            status_char = reading[-1]
            voltage = float(tension_str)
            status = int(status_char)
            monitor_num = base_offset[tipo] + idx
            if start <= monitor_num <= end:
                monitores[f"monitor_{monitor_num:02d}"] = {"voltage": voltage, "status": status}
        except (ValueError, IndexError) as e:
            log("warn", f"Falha ao parsear leitura '{reading}': {e}")
            continue

    return {
        "type": "vetor_tensao",
        "subtype": tipo,
        "irrigadorId": irrigador_id,
        "timestamp": fmt_ts_iso(dt),
        "timestamp_formatted": fmt_ts(dt),
        "monitores": monitores,
        "monitor_range": f"{start:02d}-{end:02d}",
        "payload": payload
    }

def parse_vetor_sw(payload: str) -> Dict[str, Any]:
    parts = [p.strip() for p in payload.strip().split(";") if p.strip() != ""]
    if len(parts) < 5:
        raise ValueError("Vetor SW inválido: esperado ao menos id;ts;P1;P2;LSM;...")
    irrigador_id = parts[0]
    timestamp_str = parts[1]
    try:
        dt = datetime.fromisoformat(timestamp_str)
    except ValueError:
        raise ValueError(f"Timestamp inválido no vetor SW: {timestamp_str}")

    if len(parts) >= 7 and all(len(f) == 1 and f.isdigit() and int(f) in (0, 1) for f in parts[2:7]):
        painel_1 = int(parts[2]); painel_2 = int(parts[3])
        lampada = int(parts[4]); sirene = int(parts[5]); manutencao = int(parts[6])
        monitor_tokens = parts[7:]
    elif (
        len(parts) >= 5
        and len(parts[2]) == 1 and parts[2].isdigit() and int(parts[2]) in (0, 1)
        and len(parts[3]) == 1 and parts[3].isdigit() and int(parts[3]) in (0, 1)
        and len(parts[4]) == 3 and parts[4].isdigit() and set(parts[4]).issubset({"0", "1"})
    ):
        painel_1 = int(parts[2]); painel_2 = int(parts[3])
        lsm = parts[4]
        lampada = int(lsm[0]); sirene = int(lsm[1]); manutencao = int(lsm[2])
        monitor_tokens = parts[5:]
    else:
        raise ValueError("Flags inválidas no vetor SW (nem 5 flags 0/1, nem formato compacto LSM).")

    monitores: Dict[str, Any] = {}
    for idx, token in enumerate(monitor_tokens, start=1):
        if not token.isdigit() or len(token) != 4:
            log("warn", f"Monitor {idx} inválido: '{token}' (esperado 4 dígitos)")
            continue
        monitores[f"monitor_{idx:02d}"] = {
            "fim_de_curso_1": int(token[0]),
            "fim_de_curso_2": int(token[1]),
            "armadilha": int(token[2]),
            "status": int(token[3]),
        }

    return {
        "type": "vetor_sw",
        "irrigadorId": irrigador_id,
        "timestamp": fmt_ts_iso(dt),
        "timestamp_formatted": fmt_ts(dt),
        "painel_1": painel_1,
        "painel_2": painel_2,
        "lampada": lampada,
        "sirene": sirene,
        "manutencao": manutencao,
        "monitores": monitores,
        "payload": payload
    }

def identify_and_parse(payload: str) -> Dict[str, Any]:
    parts = [p.strip() for p in payload.strip().split(";")]
    if len(parts) < 2:
        raise ValueError("Formato inválido: menos de 2 partes")

    first_part = parts[0]
    if len(first_part) > 1 and first_part[-1] in ['A', 'B', 'C', 'D']:
        return parse_vetor_tensao(payload)

    is_sw_5flags = (
        len(parts) >= 8
        and all(len(f) == 1 and f.isdigit() and int(f) in (0, 1) for f in parts[2:7])
        and any(len(tok) == 4 and tok.isdigit() for tok in parts[7:])
    )
    is_sw_compacto = (
        len(parts) >= 5
        and len(parts[2]) == 1 and parts[2].isdigit() and int(parts[2]) in (0, 1)
        and len(parts[3]) == 1 and parts[3].isdigit() and int(parts[3]) in (0, 1)
        and len(parts[4]) == 3 and parts[4].isdigit() and set(parts[4]).issubset({"0", "1"})
        and any(len(tok) == 4 and tok.isdigit() for tok in parts[5:])
    )
    if is_sw_5flags or is_sw_compacto:
        return parse_vetor_sw(payload)

    if len(parts) == 3 and re.fullmatch(r"[AE]\d+", parts[2] or ""):
        log("parts:", parts)
        evento = parts[2]
        tipo = evento[0]
        monitor = evento[1:3]
        estado = evento[3] if len(evento) > 3 else ""
        armadilha = evento[4] if len(evento) > 4 else ""
        timestamp_str = parts[1]
        log("debug", f"Parseando evento: irrigador={parts[0]}, tipo={tipo}, monitor={monitor}, estado={estado}, armadilha={armadilha}, ts={timestamp_str}")
        try:
            dt = datetime.fromisoformat(timestamp_str)
        except ValueError:
            raise ValueError(f"Timestamp inválido no evento: {timestamp_str}")
        return {
            "type": "event",
            "irrigadorId": parts[0],
            "timestamp": fmt_ts_iso(dt),
            "timestamp_formatted": fmt_ts(dt),
            "eventType": tipo,
            "monitor": monitor,
            "estado": estado,
            "armadilha": armadilha,
            "status": "Não resolvido",
            "description": "Sem descrição",
            "responsible": "A definir",
            "payload": payload
        }

    raise ValueError(f"Formato não reconhecido: {payload}")

# =============================================================================
# >>> WS ADD: Hub WebSocket (conexões + broadcast)
# =============================================================================
class WSClient:
    def __init__(self, ws: WebSocketServerProtocol, company_id: Optional[str], ids: Optional[Set[str]]):
        self.ws = ws
        self.company_id = company_id
        self.ids = ids or set()

_ws_clients: "set[WSClient]" = set()
_ws_queue: "asyncio.Queue[dict]" = asyncio.Queue()
_ws_loop: Optional[asyncio.AbstractEventLoop] = None
_ws_clients_lock = threading.Lock()

def _extract_filters_from_path(path: str) -> Tuple[Optional[str], Optional[Set[str]]]:
    try:
        qs = parse_qs(urlparse(path).query)
        company_id = qs.get("companyId", [None])[0]
        ids = qs.get("ids", [None])[0]
        id_set: Optional[Set[str]] = set(i.strip() for i in ids.split(",")) if ids else None
        return company_id, id_set
    except Exception:
        return None, None

async def _ws_handler(websocket: WebSocketServerProtocol):
    if not websocket.path.startswith(WS_PATH):
        await websocket.close(code=1008, reason="Invalid path")
        return

    company_id, ids = _extract_filters_from_path(websocket.path)
    client = WSClient(websocket, company_id, ids)

    with _ws_clients_lock:
        _ws_clients.add(client)
    log("info", f"WS conectado (company={company_id}, ids={ids}) - total={len(_ws_clients)}")

    try:
        async for _ in websocket:
            # opcional: aceitar comandos do cliente
            pass
    except websockets.ConnectionClosed:
        pass
    finally:
        with _ws_clients_lock:
            _ws_clients.discard(client)
        log("info", f"WS desconectado - total={len(_ws_clients)}")

async def _ws_broadcast_loop():
    while True:
        msg = await _ws_queue.get()
        data = json.dumps(msg, ensure_ascii=False)
        stale: List[WSClient] = []
        with _ws_clients_lock:
            targets = list(_ws_clients)
        for c in targets:
            try:
                ok_company = (c.company_id is None) or (msg.get("companyId") == c.company_id)
                msg_id = str(msg.get("irrigadorId") or "")
                ok_ids = (not c.ids) or (msg_id in c.ids)
                if ok_company and ok_ids:
                    await c.ws.send(data)
            except Exception:
                stale.append(c)
        if stale:
            with _ws_clients_lock:
                for s in stale:
                    _ws_clients.discard(s)
        _ws_queue.task_done()

async def _ws_keepalive_loop():
    while True:
        await asyncio.sleep(WS_PING_INTERVAL)
        with _ws_clients_lock:
            targets = list(_ws_clients)
        for c in targets:
            try:
                pong_waiter = await c.ws.ping()
                await asyncio.wait_for(pong_waiter, timeout=10)
            except Exception:
                try:
                    await c.ws.close()
                except Exception:
                    pass

def start_ws_server_in_thread():
    async def _async_runner():
        """Função assíncrona que roda o servidor WebSocket"""
        async with websockets.serve(
            _ws_handler, WS_HOST, WS_PORT, ping_interval=None, ping_timeout=None, max_queue=32
        ):
            log("ok", f"WebSocket em ws://{WS_HOST}:{WS_PORT}{WS_PATH}")

            # Cria tasks de broadcast e keepalive
            broadcast_task = asyncio.create_task(_ws_broadcast_loop())
            keepalive_task = asyncio.create_task(_ws_keepalive_loop())

            # Aguarda indefinidamente (até o event loop ser cancelado)
            try:
                await asyncio.Future()  # Roda para sempre
            finally:
                broadcast_task.cancel()
                keepalive_task.cancel()

    def _runner():
        global _ws_loop
        _ws_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_ws_loop)

        try:
            _ws_loop.run_until_complete(_async_runner())
        except asyncio.CancelledError:
            pass
        finally:
            _ws_loop.close()

    t = threading.Thread(target=_runner, daemon=True, name="WS-Server")
    t.start()

def ws_publish(message: dict):
    """Chame de QUALQUER thread para publicar no WS."""
    if _ws_loop is None:
        return
    try:
        _ws_loop.call_soon_threadsafe(_ws_queue.put_nowait, message)
    except Exception as e:
        log("warn", f"WS publish falhou: {e}")

# =============================================================================
# Processamento e armazenamento (para workers)
# =============================================================================
def process_vetor_tensao(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    irrigador_id = parsed["irrigadorId"]
    tipo = parsed["subtype"]

    doc_individual = {
        "table": "tensao_raw",
        "irrigadorId": irrigador_id,
        "tipo": tipo,
        "timestamp": parsed["timestamp"],
        "timestamp_formatted": parsed["timestamp_formatted"],
        "monitor_range": parsed["monitor_range"],
        "data": {"monitores": parsed["monitores"]},
    }

    doc_recente = {
        "_id": f"recente_tensao::{irrigador_id}::{tipo}",
        "table": "tensao_recente",
        "name": "Tensao",
        "type": tipo,
        "irrigadorId": irrigador_id,
        "monitor_range": parsed["monitor_range"],
        "updated_at": fmt_ts_iso(datetime.now(BR_TZ)),
        "data": {"timestamp": parsed["timestamp"], "monitores": parsed["monitores"]},
    }
    return [doc_individual, doc_recente]

def process_vetor_sw(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    irrigador_id = parsed["irrigadorId"]

    doc_individual = {
        "table": "sw_raw",
        "irrigadorId": irrigador_id,
        "timestamp": parsed["timestamp"],
        "timestamp_formatted": parsed["timestamp_formatted"],
        "data": {
            "painel_1": parsed["painel_1"],
            "painel_2": parsed["painel_2"],
            "lampada": parsed["lampada"],
            "sirene": parsed["sirene"],
            "manutencao": parsed["manutencao"],
            "monitores": parsed["monitores"],
        },
    }

    doc_recente = {
        "_id": f"recente_sw::{irrigador_id}",
        "table": "sw_recente",
        "name": "Status",
        "irrigadorId": irrigador_id,
        "updated_at": fmt_ts_iso(datetime.now(BR_TZ)),
        "data": {
            "timestamp": parsed["timestamp"],
            "painel_1": parsed["painel_1"],
            "painel_2": parsed["painel_2"],
            "lampada": parsed["lampada"],
            "sirene": parsed["sirene"],
            "manutencao": parsed["manutencao"],
            "monitores": parsed["monitores"],
        },
    }
    return [doc_individual, doc_recente]

def process_event(parsed: Dict[str, Any]) -> List[Dict[str, Any]]:
    doc = {
        "table": "events",
        "irrigadorId": parsed["irrigadorId"],
        "timestamp": parsed["timestamp"],
        "timestamp_formatted": parsed["timestamp_formatted"],
        "eventType": parsed["eventType"],
        "monitor": parsed["monitor"],
        "estado": parsed["estado"],
        "armadilha": parsed["armadilha"],
        "status": parsed["status"],
        "description": parsed["description"],
        "responsible": parsed["responsible"],
    }
    return [doc]

def process_payload(topic: str, payload_str: str):
    """
    Função executada pelo(s) worker(s).
    Faz parse, persiste e dispara notificações quando aplicável.
    """
    # Lê contatos globais (fallback)
    global_phones = read_file(FILENAME_PHONES)
    global_emails = read_file(FILENAME_EMAILS)
    notification = query_notification()
    notify = bool(notification and notification.status)

    try:
        parsed = identify_and_parse(payload_str)

        if parsed["type"] == "vetor_tensao":
            docs = process_vetor_tensao(parsed)
            data_type = f"tensao_{parsed['subtype'].lower()}"
        elif parsed["type"] == "vetor_sw":
            docs = process_vetor_sw(parsed)
            data_type = "sw"
        elif parsed["type"] == "event":
            docs = process_event(parsed)
            data_type = "event"
        else:
            log("warn", f"Tipo não reconhecido: {parsed['type']}")
            return

        irrigador_id = parsed.get("irrigadorId")

        if len(docs) > 0 and docs[0]:
            individual_id = insert_doc(docs[0])
            if individual_id:
                log("ok", f"Doc individual: {individual_id}")
                if irrigador_id:
                    update_monthly_history(irrigador_id, data_type, individual_id)

                # Push (evento alarmado)
                if (
                    parsed["type"] == "event"
                    and parsed.get("estado") == "1"
                    and should_notify(individual_id)
                ):
                    log("info", "Alerta detectado! Enviando notificações...")

                    alert_data = {
                        "alertId": individual_id,
                        "irrigadorId": irrigador_id,
                        "eventType": parsed.get("eventType", "A"),
                        "monitor": parsed.get("monitor", "00"),
                        "timestamp": parsed.get("timestamp_formatted", ""),
                    }

                    # 1. Publica no MQTT para apps conectados em tempo real
                    mqtt_published = publish_alert_to_mqtt(irrigador_id, alert_data)
                    if mqtt_published:
                        log("ok", f"Alerta publicado no MQTT: lindsay/{irrigador_id}/alerts")

                    # 2. Envia push notifications (fallback para apps em background)
                    tokens = get_device_tokens(irrigador_id)
                    if tokens:
                        success = send_expo_push_notification(tokens, alert_data)
                        save_notification_log(
                            individual_id, tokens, success, None if success else "Falha ao enviar"
                        )
                        if success:
                            log("ok", f"Push enviado para {len(tokens)} dispositivo(s)")
                        else:
                            log("error", "Falha ao enviar push")
                    else:
                        log("info", f"Nenhum dispositivo registrado para notificações locais do {irrigador_id}")

                    # 3. Envia notificações SMS/WhatsApp/Email (se notify estiver ativo)
                    # Verifica se WhatsApp está ativado para este irrigador
                    whatsapp_enabled = is_whatsapp_enabled_for_irrigador(irrigador_id)
                    log("info", f"WhatsApp/SMS para {irrigador_id}: {'ATIVADO' if whatsapp_enabled else 'DESATIVADO'}")

                    # Busca informações completas do irrigador (nome + contatos + equipamentos)
                    irrigador_info = get_irrigador_info(irrigador_id)
                    irrigador_nome = irrigador_info.get("nome") or irrigador_id
                    equipamentos = irrigador_info.get("equipamentos", [])

                    # Mapeia monitor para nome do equipamento
                    monitor = parsed.get("monitor", "00")
                    equipamento_nome = get_equipment_name_from_monitor(monitor, equipamentos)

                    log("info", f"Irrigador: {irrigador_id} - Nome: '{irrigador_nome}'")
                    log("info", f"Monitor: {monitor} → Equipamento: '{equipamento_nome}'")

                    phones = irrigador_info.get("phones", [])
                    emails = irrigador_info.get("emails", [])
                    log("info", f"Contatos específicos para {irrigador_id}: phones={len(phones)}, emails={len(emails)}")

                    # Se não houver contatos específicos, usa os globais como fallback
                    if not phones and global_phones:
                        phones = global_phones
                        log("info", f"Usando contatos globais (fallback) para {irrigador_id}")
                    else:
                        log("info", f"Usando contatos específicos para para telefone {irrigador_id}")
                    if not emails and global_emails:
                        emails = global_emails
                    else:
                        log("info", f"Usando contatos específicos para email{irrigador_id}")

                    # Só envia se notify estiver ativo E whatsapp_enabled for True
                    log("notfy", f"notify={notify}, whatsapp_enabled={whatsapp_enabled}, phones={phones}, emails={emails}")
                    if notify and whatsapp_enabled and (phones or emails):
                        event_type = parsed.get("eventType", "A")
                        monitor = parsed.get("monitor", "00")
                        timestamp = parsed.get("timestamp_formatted", "")

                        # Prepara parâmetros do template
                        template_params = {
                            "1": irrigador_id,  # ID do Irrigador
                            "2": f"{event_type}{monitor}",  # ID do evento
                            "3": MONITOR_TENSAO.get(monitor, "-"),  # Monitor
                            "4": timestamp,  # Data
                            "5": parsed.get("status", "Não resolvido"),  # Status
                            "6": parsed.get("description", "Sem descrição"),  # Descrição
                            "7": parsed.get("responsible", "A definir")  # Responsável
                        }

                        # Mensagem texto
                        msg_body = f"""Alarme Acionado

ID do Irrigador: {irrigador_id}
ID do evento: {event_type}{monitor}
Evento: {MONITOR_TENSAO.get(monitor, "-")}
Horário: {timestamp}
Status: {parsed.get("status", "Não resolvido")}
Descrição: {parsed.get("description", "Sem descrição")}
Responsável: {parsed.get("responsible", "A definir")}"""

                        # E-mail HTML
                        email_html = f"""<!DOCTYPE html>
<html><head><style>
body {{font-family: Arial, sans-serif; background:#f4f4f4; padding:20px;}}
.container {{background:white; padding:30px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);}}
.header {{background:#d32f2f; color:white; padding:15px; border-radius:4px; margin-bottom:20px;}}
.field {{margin:10px 0; padding:10px; background:#f9f9f9; border-left:4px solid #d32f2f;}}
.label {{font-weight:bold; color:#333;}}
.value {{color:#666;}}
</style></head><body>
<div class="container">
<div class="header"><h2>⚠️ Alarme Acionado</h2></div>
<div class="field"><span class="label">ID do Irrigador:</span> <span class="value">{irrigador_id}</span></div>
<div class="field"><span class="label">ID do evento:</span> <span class="value">{event_type}{monitor}</span></div>
<div class="field"><span class="label">Evento:</span> <span class="value">{MONITOR_TENSAO.get(monitor, "-")}</span></div>
<div class="field"><span class="label">Horário:</span> <span class="value">{timestamp}</span></div>
<div class="field"><span class="label">Status:</span> <span class="value">{parsed.get("status", "Não resolvido")}</span></div>
<div class="field"><span class="label">Descrição:</span> <span class="value">{parsed.get("description", "Sem descrição")}</span></div>
<div class="field"><span class="label">Responsável:</span> <span class="value">{parsed.get("responsible", "A definir")}</span></div>
</div></body></html>"""

                        try:
                            # Envia notificações
                            contacts = {"phones": phones, "emails": emails}
                            send_results = send_notification(
                                msg=msg_body,
                                contacts=contacts,
                                template_params=template_params,
                                email_subject=f"🚨 Alarme {equipamento_nome} ({irrigador_nome}) - {MONITOR_TENSAO.get(monitor, 'Evento')}",
                                email_html=email_html,
                                irrigador_nome=equipamento_nome
                            )

                            # Registra histórico no documento
                            docs[0]["notification_history"] = {
                                "sent_at": fmt_ts_iso(datetime.now(BR_TZ)),
                                "modes": send_results.get("modes_used", []),
                                "notification_mode": NOTIFICATION_MODE,
                                "results": {
                                    "success": send_results["success"],
                                    "failed": send_results["failed"],
                                    "invalid": send_results["invalid"]
                                },
                                "total_contacts": len(phones) + len(emails),
                                "success_count": len(send_results["success"]),
                                "failed_count": len(send_results["failed"]),
                                "invalid_count": len(send_results["invalid"])
                            }

                            # Atualiza documento com histórico
                            if individual_id:
                                upsert_doc(individual_id, docs[0])

                            # Log consolidado
                            if send_results["success"]:
                                log("ok", f"{len(send_results['success'])} notificação(ões) enviada(s) via {', '.join(send_results.get('modes_used', []))}")
                            if send_results["failed"]:
                                log("warn", f"{len(send_results['failed'])} falha(s) no envio")
                            if send_results["invalid"]:
                                log("warn", f"{len(send_results['invalid'])} contato(s) inválido(s)")

                        except TwilioException as e:
                            log("error", f"Erro ao enviar notificações Twilio: {e}")
                        except Exception as e:
                            log("error", f"Erro inesperado ao enviar notificações: {e}")
                    elif notify and not whatsapp_enabled:
                        log("info", f"Notificações WhatsApp/SMS DESATIVADAS para {irrigador_id} - nenhuma mensagem será enviada")
                    elif notify:
                        log("info", "Nenhum contato para notificar")
                else:
                    log("info", "Notificações desativadas ou evento não alarmado.")
                    log("info", f"Evento status: {parsed.get('status')}")
                    log("info", f"Evento estado: {parsed.get('estado')}")
                    log("info", f"Should notify: {should_notify(individual_id)}")
        if len(docs) > 1 and docs[1]:
            recente_id = upsert_doc(docs[1]["_id"], docs[1])
            if recente_id:
                log("ok", f"Doc recente: {recente_id}")
                # >>> WS ADD: broadcast para apps conectados (SW, tensao, event)
                payload_type = parsed["type"]  # "vetor_sw" | "vetor_tensao" | "event"
                msg = {
                    "kind": "update",
                    "subkind": payload_type,
                    "irrigadorId": parsed.get("irrigadorId"),
                    # ajuste se tiver companyId explícito:
                    "companyId": (parsed.get("irrigadorId") or "").split("-")[0] if parsed.get("irrigadorId") else None,
                    "updated_at": fmt_ts_iso(datetime.now(BR_TZ)),
                }
                if payload_type == "vetor_sw":
                    msg["sw"] = docs[1]  # doc_recente de SW
                elif payload_type == "vetor_tensao":
                    msg["tensao"] = docs[1]
                elif payload_type == "event":
                    msg["event"] = docs[0]
                ws_publish(msg)

    except ValueError as e:
        error_doc = {
            "table": "parse_errors",
            "topic": topic,
            "raw_data": payload_str[:4096],
            "error": str(e),
            "timestamp": fmt_ts_iso(datetime.now(BR_TZ)),
        }
        insert_doc(error_doc)
        log("error", f"Parse: {e}")
    except Exception as e:
        log("error", f"Inesperado no worker: {e}")

# =============================================================================
# MQTT Publisher (para alertas em tempo real)
# =============================================================================
mqtt_publisher_client: Optional[mqtt.Client] = None

def publish_alert_to_mqtt(irrigador_id: str, alert_data: Dict[str, Any]) -> bool:
    """
    Publica um alerta diretamente no MQTT para apps escutarem em tempo real.

    Args:
        irrigador_id: ID do irrigador (ex: LIND01)
        alert_data: Dados do alerta (alertId, eventType, monitor, timestamp, etc.)

    Returns:
        True se publicado com sucesso, False caso contrário
    """
    global mqtt_publisher_client

    if not mqtt_publisher_client:
        log("warn", "MQTT publisher não inicializado - pulando publicação de alerta")
        return False

    try:
        # Determina severidade baseado no tipo de evento
        event_type = alert_data.get("eventType", "A")
        severity_map = {
            "A": "critical",  # Tensão < 50V
            "E": "critical",  # Torre ausente
            "B": "high",      # Fim-de-curso 1
            "C": "high",      # Fim-de-curso 2
            "D": "medium",    # Memória tensão baixa
        }
        severity = severity_map.get(event_type, "medium")

        # Monta mensagem MQTT
        mqtt_message = {
            "alertId": alert_data.get("alertId"),
            "irrigadorId": irrigador_id,
            "tipo": event_type,
            "mensagem": get_alarm_description(event_type),
            "monitor": alert_data.get("monitor", "00"),
            "timestamp": alert_data.get("timestamp", ""),
            "severity": severity,
        }

        # Publica no tópico específico do irrigador com QoS 1 e retain=True
        topic = f"lindsay/{irrigador_id}/alerts"
        payload = json.dumps(mqtt_message)

        result = mqtt_publisher_client.publish(
            topic=topic,
            payload=payload,
            qos=1,  # At-least-once delivery
            retain=True  # Última mensagem fica retida para novos clientes
        )

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            log("ok", f"Alerta publicado no MQTT: {topic}")
            return True
        else:
            log("error", f"Erro ao publicar no MQTT: rc={result.rc}")
            return False

    except Exception as e:
        log("error", f"Exceção ao publicar alerta no MQTT: {e}")
        return False

def get_alarm_description(event_type: str) -> str:
    """Retorna descrição do tipo de alarme"""
    descriptions = {
        "A": "Tensão abaixo de 50V",
        "B": "Fim-de-curso 1 acionado (SW1)",
        "C": "Fim-de-curso 2 acionado (SW2)",
        "D": "Memória de tensão baixa detectada",
        "E": "Torre ausente - comunicação perdida",
    }
    return descriptions.get(event_type, f"Alerta tipo {event_type}")

# =============================================================================
# MQTT Publisher (para alertas em tempo real)
# =============================================================================
mqtt_publisher_client: Optional[mqtt.Client] = None

def publish_alert_to_mqtt(irrigador_id: str, alert_data: Dict[str, Any]) -> bool:
    """
    Publica um alerta diretamente no MQTT para apps escutarem em tempo real.

    Args:
        irrigador_id: ID do irrigador (ex: LIND01)
        alert_data: Dados do alerta (alertId, eventType, monitor, timestamp, etc.)

    Returns:
        True se publicado com sucesso, False caso contrário
    """
    global mqtt_publisher_client

    if not mqtt_publisher_client:
        log("warn", "MQTT publisher não inicializado - pulando publicação de alerta")
        return False

    try:
        # Determina severidade baseado no tipo de evento
        event_type = alert_data.get("eventType", "A")
        severity_map = {
            "A": "critical",  # Tensão < 50V
            "E": "critical",  # Torre ausente
            "B": "high",      # Fim-de-curso 1
            "C": "high",      # Fim-de-curso 2
            "D": "medium",    # Memória tensão baixa
        }
        severity = severity_map.get(event_type, "medium")

        # Monta mensagem MQTT
        mqtt_message = {
            "alertId": alert_data.get("alertId"),
            "irrigadorId": irrigador_id,
            "tipo": event_type,
            "mensagem": get_alarm_description(event_type),
            "monitor": alert_data.get("monitor", "00"),
            "timestamp": alert_data.get("timestamp", ""),
            "severity": severity,
        }

        # Publica no tópico específico do irrigador com QoS 1 e retain=True
        topic = f"lindsay/{irrigador_id}/alerts"
        payload = json.dumps(mqtt_message)

        result = mqtt_publisher_client.publish(
            topic=topic,
            payload=payload,
            qos=1,  # At-least-once delivery
            retain=True  # Última mensagem fica retida para novos clientes
        )

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            log("ok", f"Alerta publicado no MQTT: {topic}")
            return True
        else:
            log("error", f"Erro ao publicar no MQTT: rc={result.rc}")
            return False

    except Exception as e:
        log("error", f"Exceção ao publicar alerta no MQTT: {e}")
        return False

def get_alarm_description(event_type: str) -> str:
    """Retorna descrição do tipo de alarme"""
    descriptions = {
        "A": "Tensão abaixo de 50V",
        "B": "Fim-de-curso 1 acionado (SW1)",
        "C": "Fim-de-curso 2 acionado (SW2)",
        "D": "Memória de tensão baixa detectada",
        "E": "Torre ausente - comunicação perdida",
    }
    return descriptions.get(event_type, f"Alerta tipo {event_type}")

# =============================================================================
# Fila + Workers
# =============================================================================
work_q: "Queue[Tuple[str, str]]" = Queue(maxsize=QUEUE_MAXSIZE)
stop_event = threading.Event()

def worker_loop(worker_id: int):
    log("info", f"Worker-{worker_id} iniciado")
    while not stop_event.is_set():
        try:
            topic, payload = work_q.get(timeout=0.25)
        except Empty:
            continue
        try:
            process_payload(topic, payload)
        finally:
            work_q.task_done()
    log("info", f"Worker-{worker_id} finalizado")

# =============================================================================
# MQTT callbacks (robustez)
# =============================================================================
def on_connect(client: mqtt.Client, userdata, flags, reason_code, properties=None):
    if getattr(reason_code, "value", reason_code) == 0:
        log("ok", "Conectado ao broker MQTT")
        res = client.subscribe(MQTT_TOPIC, qos=MQTT_QOS)
        log("info", f"Subscribed '{MQTT_TOPIC}' QoS={MQTT_QOS} -> {res}")
    else:
        log("error", f"Falha ao conectar MQTT: {reason_code}")

def on_disconnect(client: mqtt.Client, userdata, reason_code, properties=None):
    log("warn", f"Desconectado do MQTT: {reason_code}. Paho tentará reconectar.")

def on_subscribe(client, userdata, mid, granted_qos, properties=None):
    log("info", f"Subscription ok: mid={mid}, qos={granted_qos}")

def on_message(client, userdata, msg: mqtt.MQTTMessage):
    if msg.topic.startswith("$SYS/") or msg.topic.startswith("lindsay/comandos"):
        return
    payload_str = msg.payload.decode("utf-8", errors="ignore")
    try:
        if ON_QUEUE_FULL == "block":
            work_q.put((msg.topic, payload_str), timeout=QUEUE_PUT_TIMEOUT)
        else:
            work_q.put_nowait((msg.topic, payload_str))
    except Full:
        log("warn", "Fila cheia - descartando mensagem (ON_QUEUE_FULL=drop)")

# =============================================================================
# Main
# =============================================================================
def main():
    print("=" * 60)
    print("Sistema MQTT → CouchDB (workers + reconexão robusta)")
    print("Suporta: Vetores Tensão (A/B/C/D) + Vetores SW (5 flags ou LSM) + Eventos")
    print("=" * 60)

    # Prepara DB
    server = get_couch_server()
    if not server:
        log("error", "Não foi possível conectar ao CouchDB.")
        return
    if not ensure_db(server, DATABASE):
        log("error", "Não foi possível preparar o DB.")
        return

    # >>> WS ADD: iniciar servidor WebSocket (thread separada)
    start_ws_server_in_thread()

    # Cria índice para otimizar queries de device_tokens
    log("info", "Criando índice para device_tokens...")
    ensure_device_tokens_index()

    # Inicia workers
    threads: List[threading.Thread] = []
    for i in range(max(1, WORKER_COUNT)):
        t = threading.Thread(target=worker_loop, args=(i+1,), daemon=True)
        t.start()
        threads.append(t)

    # Configura cliente MQTT
    client = mqtt.Client(client_id=MQTT_CLIENT_ID, clean_session=True, protocol=mqtt.MQTTv311)
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_subscribe = on_subscribe
    client.on_message = on_message

    client.reconnect_delay_set(min_delay=1, max_delay=120)
    try:
        client.max_inflight_messages_set(20)
        client.max_queued_messages_set(0)
    except Exception:
        pass

    log("info", f"Conectando ao broker {MQTT_BROKER}:{MQTT_PORT}")
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_start()
    client.subscribe(MQTT_TOPIC, qos=MQTT_QOS)

    def handle_sigterm(signum, frame):
        log("info", f"Sinal {signum} recebido. Encerrando...")
        stop_event.set()

    signal.signal(signal.SIGINT, handle_sigterm)
    signal.signal(signal.SIGTERM, handle_sigterm)

    try:
        while not stop_event.is_set():
            stop_event.wait(timeout=0.5)
    finally:
        try:
            client.loop_stop()
        except Exception:
            pass
        try:
            client.disconnect()
        except Exception:
            pass
        try:
            work_q.join()
        except Exception:
            pass
        log("ok", "Encerrado com sucesso.")

if __name__ == "__main__":
    main()

