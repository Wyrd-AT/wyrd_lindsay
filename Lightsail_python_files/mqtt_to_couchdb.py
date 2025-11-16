
import os
import re
import time
import json
from datetime import datetime
from typing import List, Literal, Optional
from zoneinfo import ZoneInfo

import couchdb
import paho.mqtt.client as mqtt
import requests
from couchdb.http import ResourceNotFound
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError
from twilio.base.exceptions import TwilioException
from twilio.rest import Client

# Importações para e-mail via SendGrid (Twilio)
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False
    print("[AVISO] SendGrid não instalado. Execute: pip install sendgrid")

# Carrega variáveis de ambiente
load_dotenv()

# Configurações Twilio (PRODUÇÃO - usar variáveis de ambiente)
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")
TWILIO_SMS_FROM = os.getenv("TWILIO_SMS_FROM")
TWILIO_TEMPLATE_SID = os.getenv("TWILIO_TEMPLATE_SID")

# Configurações SendGrid (Twilio Email)
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "Sistema de Alarmes Lindsay")

# Modo de notificação: whatsapp, sms, email ou combinações (ex: whatsapp,email)
NOTIFICATION_MODE = os.getenv("NOTIFICATION_MODE", "whatsapp").lower()

# Validação de credenciais obrigatórias
if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM]):
    raise ValueError(
        "Credenciais Twilio não configuradas. Defina as variáveis de ambiente:\n"
        "- TWILIO_ACCOUNT_SID\n"
        "- TWILIO_AUTH_TOKEN\n"
        "- TWILIO_WHATSAPP_FROM\n"
        "- TWILIO_TEMPLATE_SID (opcional, para templates)\n"
    )

REMETENTE = TWILIO_WHATSAPP_FROM

# Inicializa cliente Twilio
try:
    client_twilio = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    # Testa conexão
    _ = client_twilio.api.accounts(TWILIO_ACCOUNT_SID).fetch()
    print("[OK] Cliente Twilio inicializado e autenticado com sucesso")
except Exception as e:
    print(f"[ERRO] Falha ao inicializar cliente Twilio: {e}")
    raise



def validate_phone_number(phone: str) -> bool:
    """
    Valida formato de número de telefone.
    Aceita formatos: +5511999999999, 5511999999999, +11999999999
    """
    # Remove espaços e caracteres especiais exceto +
    cleaned = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    # Verifica se tem apenas dígitos (e opcionalmente +)
    pattern = r'^\+?\d{10,15}$'
    return bool(re.match(pattern, cleaned))


def validate_email(email: str) -> bool:
    """
    Valida formato de e-mail.
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip()))


def send_sms(msg: str, to: list[str]) -> dict:
    """
    Envia SMS via Twilio para múltiplos números.
    Implementa rate limiting para evitar throttling.

    Args:
        msg: Corpo da mensagem SMS (máximo 1600 caracteres)
        to: Lista de números no formato internacional (+5511999999999)

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {
        "success": [],
        "failed": [],
        "invalid": []
    }

    if not to:
        print("[AVISO] Nenhum número para enviar SMS")
        return results

    if not TWILIO_SMS_FROM:
        print("[ERRO] TWILIO_SMS_FROM não configurado. Não é possível enviar SMS.")
        return results

    # Limita mensagem SMS a 1600 caracteres
    if len(msg) > 1600:
        msg = msg[:1597] + "..."
        print(f"[AVISO] Mensagem SMS truncada para 1600 caracteres")

    for i, phone in enumerate(to):
        # Valida formato do número
        if not validate_phone_number(phone):
            results["invalid"].append({
                "phone": phone,
                "reason": "Formato inválido"
            })
            print(f"[AVISO] Número inválido ignorado: {phone}")
            continue

        # Rate limiting: aguarda entre mensagens (exceto a primeira)
        if i > 0:
            time.sleep(RATE_LIMIT_DELAY)

        try:
            # Garante que número tem +
            phone_formatted = phone if phone.startswith("+") else f"+{phone}"

            # Envia SMS
            message = client_twilio.messages.create(
                body=msg,
                from_=TWILIO_SMS_FROM,
                to=phone_formatted,
            )

            # Registra sucesso com SID da mensagem
            results["success"].append({
                "phone": phone,
                "message_sid": message.sid,
                "status": message.status,
                "timestamp": fmt_ts(datetime.now()),
                "type": "sms"
            })
            print(f"[OK] SMS enviado para {phone} (SID: {message.sid})")

        except TwilioException as e:
            # Registra falha específica
            error_code = getattr(e, 'code', None)
            results["failed"].append({
                "phone": phone,
                "error": str(e),
                "error_code": error_code,
                "timestamp": fmt_ts(datetime.now()),
                "type": "sms"
            })
            print(f"[ERRO] Falha ao enviar SMS para {phone} [Code: {error_code}]: {str(e)}")

        except Exception as e:
            # Captura erros inesperados
            results["failed"].append({
                "phone": phone,
                "error": f"Erro inesperado: {str(e)}",
                "error_code": None,
                "timestamp": fmt_ts(datetime.now()),
                "type": "sms"
            })
            print(f"[ERRO] Erro inesperado ao enviar SMS para {phone}: {type(e).__name__} - {str(e)}")

    return results


def send_email(subject: str, body_text: str, body_html: str, to: list[str]) -> dict:
    """
    Envia e-mail via SendGrid (Twilio) para múltiplos destinatários.

    Args:
        subject: Assunto do e-mail
        body_text: Corpo em texto puro
        body_html: Corpo em HTML
        to: Lista de e-mails destinatários

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {
        "success": [],
        "failed": [],
        "invalid": []
    }

    if not to:
        print("[AVISO] Nenhum e-mail para enviar")
        return results

    if not SENDGRID_AVAILABLE:
        print("[ERRO] SendGrid não instalado. Execute: pip install sendgrid")
        return results

    if not SENDGRID_API_KEY or not EMAIL_FROM:
        print("[ERRO] SENDGRID_API_KEY ou EMAIL_FROM não configurados no .env")
        return results

    for i, email_addr in enumerate(to):
        # Valida formato do e-mail
        if not validate_email(email_addr):
            results["invalid"].append({
                "email": email_addr,
                "reason": "Formato inválido"
            })
            print(f"[AVISO] E-mail inválido ignorado: {email_addr}")
            continue

        # Rate limiting
        if i > 0:
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

            # Registra sucesso
            results["success"].append({
                "email": email_addr,
                "status_code": response.status_code,
                "timestamp": fmt_ts(datetime.now()),
                "type": "email"
            })
            print(f"[OK] E-mail enviado para {email_addr} (Status: {response.status_code})")

        except Exception as e:
            # Registra falha
            results["failed"].append({
                "email": email_addr,
                "error": str(e),
                "timestamp": fmt_ts(datetime.now()),
                "type": "email"
            })
            print(f"[ERRO] Falha ao enviar e-mail para {email_addr}: {str(e)}")

    return results


def send_whatsapp(msg: str, to: list[str], template_params: dict = None) -> dict:
    """
    Envia mensagem WhatsApp via Twilio para múltiplos números.
    Implementa rate limiting para evitar throttling.

    Args:
        msg: Corpo da mensagem (usado se não houver template)
        to: Lista de números no formato internacional (+5511999999999)
        template_params: Dict com parâmetros para template aprovado
                        Ex: {"1": "IRRIG01", "2": "A01", "3": "MT01", ...}

    Returns:
        dict com 'success' (list), 'failed' (list), 'invalid' (list)
    """
    results = {
        "success": [],
        "failed": [],
        "invalid": []
    }

    if not to:
        print("[AVISO] Nenhum número para enviar WhatsApp")
        return results

    for i, phone in enumerate(to):
        # Valida formato do número
        if not validate_phone_number(phone):
            results["invalid"].append({
                "phone": phone,
                "reason": "Formato inválido"
            })
            print(f"[AVISO] Número inválido ignorado: {phone}")
            continue

        # Rate limiting: aguarda entre mensagens (exceto a primeira)
        if i > 0:
            time.sleep(RATE_LIMIT_DELAY)

        try:
            # Prepara parâmetros da mensagem
            message_params = {
                "from_": REMETENTE,
                "to": f"whatsapp:{phone}",
            }

            # Usa template se disponível e com parâmetros
            if TWILIO_TEMPLATE_SID and template_params:
                # Formato Content Template do Twilio
                # Limpa valores para evitar quebras de linha, tabs e espaços múltiplos
                cleaned_params = {}
                for key, value in template_params.items():
                    if value is not None:
                        # Remove quebras de linha, tabs e reduz espaços múltiplos
                        cleaned_value = str(value).replace("\n", " ").replace("\t", " ").replace("\r", " ")
                        # Reduz espaços múltiplos para no máximo 1
                        cleaned_value = " ".join(cleaned_value.split())
                        cleaned_params[key] = cleaned_value
                    else:
                        cleaned_params[key] = ""

                message_params["content_sid"] = TWILIO_TEMPLATE_SID
                message_params["content_variables"] = json.dumps(cleaned_params)
                print(f"[INFO] Usando template {TWILIO_TEMPLATE_SID}")
                print(f"[DEBUG] Variáveis: {json.dumps(cleaned_params, ensure_ascii=False)}")
            else:
                # Fallback para texto livre (só funciona em Sandbox ou respostas)
                message_params["body"] = msg

            # Envia mensagem
            message = client_twilio.messages.create(**message_params)

            # Registra sucesso com SID da mensagem
            results["success"].append({
                "phone": phone,
                "message_sid": message.sid,
                "status": message.status,
                "timestamp": fmt_ts(datetime.now()),
                "type": "whatsapp"
            })
            print(f"[OK] WhatsApp enviado para {phone} (SID: {message.sid})")

        except TwilioException as e:
            # Registra falha específica
            error_code = getattr(e, 'code', None)
            results["failed"].append({
                "phone": phone,
                "error": str(e),
                "error_code": error_code,
                "timestamp": fmt_ts(datetime.now()),
                "type": "whatsapp"
            })
            print(f"[ERRO] Falha ao enviar WhatsApp para {phone} [Code: {error_code}]: {str(e)}")

        except Exception as e:
            # Captura erros inesperados
            results["failed"].append({
                "phone": phone,
                "error": f"Erro inesperado: {str(e)}",
                "error_code": None,
                "timestamp": fmt_ts(datetime.now()),
                "type": "whatsapp"
            })
            print(f"[ERRO] Erro inesperado ao enviar WhatsApp para {phone}: {type(e).__name__} - {str(e)}")

    return results


def send_notification(msg: str, contacts: dict, template_params: dict = None, email_subject: str = None, email_html: str = None) -> dict:
    """
    Envia notificação via WhatsApp, SMS e/ou E-mail (tudo via Twilio).

    Args:
        msg: Corpo da mensagem
        contacts: Dict com 'phones' e 'emails'
        template_params: Parâmetros para template WhatsApp (opcional)
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

    if "whatsapp" in modes and phones:
        print(f"[INFO] Enviando via WhatsApp...")
        whatsapp_results = send_whatsapp(msg, phones, template_params)
        all_results["success"].extend(whatsapp_results["success"])
        all_results["failed"].extend(whatsapp_results["failed"])
        all_results["invalid"].extend(whatsapp_results["invalid"])
        all_results["modes_used"].append("whatsapp")

    if "sms" in modes and phones:
        print(f"[INFO] Enviando via SMS...")
        sms_results = send_sms(msg, phones)
        all_results["success"].extend(sms_results["success"])
        all_results["failed"].extend(sms_results["failed"])
        all_results["invalid"].extend(sms_results["invalid"])
        all_results["modes_used"].append("sms")

    if "email" in modes and emails:
        print(f"[INFO] Enviando via E-mail...")
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


# Configurações CouchDB (PRODUÇÃO - usar variáveis de ambiente)
COUCHDB_URL = os.getenv("COUCHDB_URL", "http://admin:wyrd@3.91.165.0:5984")
DATABASE = os.getenv("COUCHDB_DATABASE", "lindsay-data")

# Configurações MQTT
MQTT_BROKER = os.getenv("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "#")

# Configurações de Rate Limiting (para WhatsApp)
RATE_LIMIT_DELAY = float(os.getenv("RATE_LIMIT_DELAY", "1.0"))  # segundos entre mensagens


BR_TZ = ZoneInfo("America/Sao_Paulo")

STATUS_MAP = {

    "0": "OK",

    "1": "Alarmado",

    "2": "Reconhecido",

    "3": "Resolvido",

    "4": "Desconhecido",

    "5": "Desconhecido",

    "6": "Desconhecido",

    "7": "Desconhecido",

    "8": "Desconhecido",

    "9": "Ausente",

}


MONITOR_TENSAO = {

    "01": "MT01",

    "02": "MT02",

    "03": "MT03",

    "04": "MT04",

    "05": "MT05",

    "06": "MT06",

    "07": "MT07",

    "08": "MT08",

    "09": "MT09",

    "10": "MT10",

    "11": "MT11",

    "12": "MT12",

    "13": "MT13",

    "14": "MT14",

    "15": "-",

    "16": "-",

    "17": "Painel 1",

    "18": "Painel 2",

}


FILENAME_PHONES = "numbers.txt"
FILENAME_EMAILS = "emails.txt"

def fmt_ts(dt: datetime) -> str:
	if dt.tzinfo is None:
		dt= dt.replace(tzinfo=BR_TZ)
	else:
		dt = dt.astimezone(BR_TZ)
	return dt.isoformat(timespec='seconds')

def parse_message_alarme(message: str) -> dict:

    """

    Portado de parseMessage.js:

    - split em ';'

    - parse de timestamp 'YYYY-MM-DD HH:mm:ss'

    - 4 tipos de mensagem

    """

    parts = message.strip().split(";")

    if len(parts) < 2:

        raise ValueError(f"Formato inválido: menos de duas partes ({message!r})")


    irrigador_id = parts[0]
    raw_ts = parts[1]
    ts_iso = raw_ts.replace(" ", "T")

    try:
        timestamp = datetime.fromisoformat(ts_iso)

    except ValueError as e:
        raise ValueError(f"Timestamp inválido: {raw_ts}. Erro: {str(e)}")


    # 1) monitorStatus

    if len(parts) >= 3 and all(re.fullmatch(r"\d", p) for p in parts[2:]):

        status = [

            {"mt": i + 1, "status": STATUS_MAP.get(p, "Desconhecido")}

            for i, p in enumerate(parts[2:])

        ]

        return {

            "type": "monitorStatus",

            "irrigadorId": irrigador_id,

            "timestamp": fmt_ts(timestamp),

            "status": status,

        }

    # 2) event/alarme

    if len(parts) == 3 and re.fullmatch(r"[AE]\d+", parts[2]):

        ev = parts[2]

        return {

            "type": "event",

            "irrigadorId": irrigador_id,

            "timestamp": fmt_ts(timestamp),

            "eventType": "alarme" if ev[0] == "A" else "evento",

            "eventCode": ev[1:],

            "status": "Não resolvido",

            "description": "Sem descrição",

            "responsible": "A definir",

            "notifications": {

                "WhatsApp": False,

                "E-mail": False,

                "SMS": False,

                "Ligação": False,

            },

            "snooze_time": None,

            "snooze_until": None,

        }

    # 3) command simples

    if len(parts) == 2 and re.fullmatch(r"[A-Za-z]+", parts[1]):

        return {

            "type": "command",

            "irrigadorId": irrigador_id,

            "command": parts[1].replace("'", ""),

            "timestamp": fmt_ts(timestamp),

        }


    # 4) mtTension

    if len(parts) >= 3:

        mt_readings = []

        for i, token in enumerate(parts[2:]):

            m = re.fullmatch(r"(\d+\.\d{2})([01])", token)

            if m:

                vol = float(m.group(1))

                st = "ON" if m.group(2) == "0" else "OFF"

            else:

                try:

                    vol = float(token)

                except ValueError:

                    vol = 0.0

                st = "–"

            mt_readings.append({"mt": i + 1, "voltage": vol, "status": st})

        return {

            "type": "mtTension",

            "irrigadorId": irrigador_id,

            "timestamp": fmt_ts(timestamp),

            "mtReadings": mt_readings,

        }


    raise ValueError(f"Formato não reconhecido: {message!r}")



def on_message(client, userdata, msg):

    if msg.topic.startswith("$SYS/"):

        return

    if msg.topic.startswith("lindsay/comandos"):

        return


    payload_str = msg.payload.decode("utf-8", errors="ignore")


    # tenta parsear
    try:
        parsed_alarme = parse_message_alarme(payload_str)
        parsed = {"data": payload_str, "timestamp": fmt_ts(datetime.now())}

    except ValueError as e:
        # fallback de erro
        error_doc = {
            "type": "parse_error",
            "error": str(e),
            "raw_payload": payload_str,
            "timestamp": fmt_ts(datetime.now()),
        }
        parsed = error_doc
        parsed_alarme = error_doc
        print(f"[ERRO] Falha ao parsear mensagem: {str(e)}")


    # document for CouchDB

    doc = {

        "topic": msg.topic,

        "type": "string",

        "origin": "esp32",

        "table": "mqtt_messages",

        **parsed,

    }


    # Lê contatos
    phones = read_file(FILENAME_PHONES) if os.path.exists(FILENAME_PHONES) else []
    emails = read_file(FILENAME_EMAILS) if os.path.exists(FILENAME_EMAILS) else []

    print(f"[DEBUG] Telefones: {len(phones)}, E-mails: {len(emails)}")
    contacts = {"phones": phones, "emails": emails}


    notification = query_notification()


    notify = False


    if notification:

        notify = notification.status

        
        print(f"[AVISO] Usando notify={notify}")
    # envia notificação só se for alarme real

    if (

        parsed_alarme.get("type") == "event"

        and parsed_alarme.get("eventType") == "alarme"

        and notify

    ):
        # Prepara parâmetros do template baseado na imagem fornecida
        # Template tem 7 variáveis: {{1}} a {{7}}
        template_params = {
            "1": parsed_alarme["irrigadorId"],           # ID do Irrigador
            "2": "A" + parsed_alarme["eventCode"],       # ID do evento
            "3": MONITOR_TENSAO.get(parsed_alarme["eventCode"], "-"),  # Monitor
            "4": parsed_alarme["timestamp"],             # Data
            "5": parsed_alarme["status"],                # Status
            "6": parsed_alarme["description"],           # Descrição
            "7": parsed_alarme["responsible"]            # Responsável
        }

        # Mensagem texto
        msg_body = f"""Alarme Acionado

ID do Irrigador: {parsed_alarme["irrigadorId"]}
ID do evento: {"A" + parsed_alarme["eventCode"]}
Evento: {MONITOR_TENSAO.get(parsed_alarme["eventCode"], "-")}
Horário: {parsed_alarme["timestamp"]}
Status: {parsed_alarme["status"]}
Descrição: {parsed_alarme["description"]}
Responsável: {parsed_alarme["responsible"]}"""

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
<div class="field"><span class="label">ID do Irrigador:</span> <span class="value">{parsed_alarme["irrigadorId"]}</span></div>
<div class="field"><span class="label">ID do evento:</span> <span class="value">{"A" + parsed_alarme["eventCode"]}</span></div>
<div class="field"><span class="label">Evento:</span> <span class="value">{MONITOR_TENSAO.get(parsed_alarme["eventCode"], "-")}</span></div>
<div class="field"><span class="label">Horário:</span> <span class="value">{parsed_alarme["timestamp"]}</span></div>
<div class="field"><span class="label">Status:</span> <span class="value">{parsed_alarme["status"]}</span></div>
<div class="field"><span class="label">Descrição:</span> <span class="value">{parsed_alarme["description"]}</span></div>
<div class="field"><span class="label">Responsável:</span> <span class="value">{parsed_alarme["responsible"]}</span></div>
</div></body></html>"""

        try:
            # Envia notificações
            send_results = send_notification(
                msg=msg_body,
                contacts=contacts,
                template_params=template_params,
                email_subject=f"🚨 Alarme {parsed_alarme['irrigadorId']} - {MONITOR_TENSAO.get(parsed_alarme['eventCode'], 'Evento')}",
                email_html=email_html
            )

            # Registra histórico no documento do CouchDB
            parsed_alarme["notification_history"] = {
                "sent_at": fmt_ts(datetime.now()),
                "modes": send_results.get("modes_used", []),
                "notification_mode": NOTIFICATION_MODE,
                "results": {
                    "success": send_results["success"],
                    "failed": send_results["failed"],
                    "invalid": send_results["invalid"]
                },
                "total_contacts": len(contacts.get("phones", [])) + len(contacts.get("emails", [])),
                "success_count": len(send_results["success"]),
                "failed_count": len(send_results["failed"]),
                "invalid_count": len(send_results["invalid"])
            }

            # Log consolidado
            if send_results["success"]:
                print(f"[OK] {len(send_results['success'])} notificação(ões) enviada(s) via {', '.join(send_results.get('modes_used', []))}")
            if send_results["failed"]:
                print(f"[AVISO] {len(send_results['failed'])} falha(s) no envio")
            if send_results["invalid"]:
                print(f"[AVISO] {len(send_results['invalid'])} número(s) inválido(s)")

        except TwilioException as e:
            print(f"[ERRO] Erro de configuração do Twilio: {e}")
            print(
                "\n[ERRO] Certifique-se de que as variáveis de ambiente "
                "TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN estão definidas."
            )
            print("[ERRO] Notificação não enviada")

            # Registra erro no histórico
            parsed_alarme["notification_history"] = {
                "sent_at": fmt_ts(datetime.now()),
                "error": str(e),
                "error_type": "TwilioConfigurationError"
            }

    elif parsed_alarme.get("eventType") == "alarme" and not notify:

        print("[OK] Nenhum número para notificar")


    # grava no CouchDB

    resp = requests.post(f"{COUCHDB_URL}/{DATABASE}", json=doc)

    if resp.status_code not in (201, 202):

        print(f"[ERRO] POST no CouchDB retornou {resp.status_code}: {resp.text}")

    else:

        print(f"[OK] Gravou doc id={resp.json().get('id')}")



def read_file(filename: str) -> List[str]:

    lines = []

    try:

        with open(filename, "r", encoding="utf-8") as file:

            lines = [line.strip() for line in file]

    except FileNotFoundError as e:
        print(f"Erro: O arquivo '{filename}' não foi encontrado. {str(e)}")

    except IOError as e:
        print(f"Erro de leitura do arquivo '{filename}': {str(e)}")

    except Exception as e:
        print(f"Erro inesperado ao ler '{filename}': {type(e).__name__} - {str(e)}")


    return lines



def query_couchdb(query):

    try:

        couch = couchdb.Server(COUCHDB_URL)

        db = couch[DATABASE]


        result = db.find(query)

        return result

    except ResourceNotFound as e:
        print(f"Erro: banco de dados '{DATABASE}' não foi encontrado. {str(e)}")
        return None

    except couchdb.http.Unauthorized as e:
        print(f"Erro de autenticação no CouchDB: {str(e)}")
        return None

    except Exception as e:
        print(f"Erro inesperado ao consultar CouchDB: {type(e).__name__} - {str(e)}")
        return None



class Notification(BaseModel):

    table: Literal["notificacao"]

    status: bool


    class Config:

        extra = "allow"



def query_notification():

    query = {"selector": {"table": {"$eq": "notificacao"}}, "limit": 2000}


    result = query_couchdb(query)

    print(f"[DEBUG] query_notification - result type: {type(result)}")

    if result is None:
        print("[DEBUG] query_notification - result é None, retornando None")
        return None


    item = next(result, None)
    print(f"[DEBUG] query_notification - item recuperado: {item}")

    if not item:

        print("[AVISO] query_notification - Nenhum item encontrado na consulta")

        return None


    try:

        notification = Notification.model_validate(item)
        print(f"[DEBUG] query_notification - notificação validada com sucesso: status={notification.status}")

        return notification

    except ValidationError as e:

        print(f"[ERRO] query_notification - Erro de validação: {e}")
        print(f"[ERRO] query_notification - Item que falhou na validação: {item}")

        return None



if __name__ == "__main__":
    print("=" * 60)
    print("MQTT → CouchDB com notificações (PRODUÇÃO)")
    print("=" * 60)
    print(f"MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"MQTT Topic: {MQTT_TOPIC}")
    print(f"CouchDB: {DATABASE}")
    print(f"Modo de Notificação: {NOTIFICATION_MODE.upper()}")
    modes = [m.strip() for m in NOTIFICATION_MODE.split(",")]
    if "whatsapp" in modes:
        print(f"  WhatsApp: {REMETENTE}")
    if "sms" in modes:
        print(f"  SMS: {TWILIO_SMS_FROM if TWILIO_SMS_FROM else 'NÃO CONFIGURADO'}")
    if "email" in modes:
        print(f"  E-mail: {EMAIL_FROM if EMAIL_FROM else 'NÃO CONFIGURADO'}")
    print(f"Rate Limit: {RATE_LIMIT_DELAY}s entre mensagens")
    print("=" * 60)

    try:
        client = mqtt.Client()
        client.on_message = on_message

        print(f"[INFO] Conectando ao broker MQTT {MQTT_BROKER}:{MQTT_PORT}...")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)

        print(f"[INFO] Inscrito no tópico: {MQTT_TOPIC}")
        client.subscribe(MQTT_TOPIC)

        print("[OK] Sistema iniciado. Aguardando mensagens MQTT...")
        client.loop_forever()

    except KeyboardInterrupt:
        print("\n[INFO] Encerrando sistema...")
        client.disconnect()
        print("[OK] Sistema encerrado com sucesso")

    except Exception as e:
        print(f"[ERRO FATAL] {type(e).__name__}: {str(e)}")
        raise
