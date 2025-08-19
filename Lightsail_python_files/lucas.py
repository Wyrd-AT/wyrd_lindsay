import os
import re
from datetime import datetime
from typing import List, Literal
from zoneinfo import ZoneInfo

import couchdb
import paho.mqtt.client as mqtt
import requests
from couchdb.http import ResourceNotFound
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError
from twilio.base.exceptions import TwilioException
from twilio.rest import Client

load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")

client_twilio = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def send_message(msg: str, to: list[str]):
    for t in to:
        _ = client_twilio.messages.create(
            body=msg,
            from_="whatsapp:+14155238886",
            to=f"whatsapp:{t}",
        )


COUCHDB_URL = "http://admin:wyrd@127.0.0.1:5984"
DATABASE = "mqtt_data"
MQTT_BROKER = "127.0.0.1"
MQTT_TOPIC = "#"

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

FILENAME = "numbers.txt"


def fmt_ts(dt: datetime) -> str:
    """
    Converte um datetime (naive ou aware) para fuso de Brasília,
    remove microssegundos e retorna ISO-format até os segundos.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BR_TZ)
    else:
        dt = dt.astimezone(BR_TZ)
    return dt.strftime("%H:%M:%S %d/%m/%Y")


def create_db():
    """Cria o DB caso não exista."""
    resp = requests.put(f"{COUCHDB_URL}/{DATABASE}")
    if resp.status_code not in (201, 412):
        print(f"[WARN] criação do DB retornou {resp.status_code}")
    else:
        print(f"[OK] DB '{DATABASE}' pronto (status {resp.status_code})")


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
    except ValueError:
        raise ValueError(f"Timestamp inválido: {raw_ts}")

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
        parsed = {"data": payload_str, "timestamp": fmt_ts(datetime.now())}
        parsed_alarme = parse_message_alarme(payload_str)
    except ValueError as e:
        # fallback de erro
        parsed = {
            "type": "error",
            "error": str(e),
            "string_error": payload_str,
            "timestamp": fmt_ts(datetime.now()),
        }
        parsed_alarme = {
            "type": "error",
            "error": str(e),
            "string_error": payload_str,
            "timestamp": fmt_ts(datetime.now()),
        }

    # document for CouchDB
    doc = {
        "topic": msg.topic,
        "type": "string",
        "origin": "esp32",
        "table": "mqtt_messages",
        **parsed,
    }

    try:
        numbers = read_file(FILENAME)
    except FileNotFoundError:
        numbers = []

    notification = query_notification()

    notify = False

    if notification:
        notify = notification.status

    # envia notificação só se for alarme real
    if (
        parsed_alarme.get("type") == "event"
        and parsed_alarme.get("eventType") == "alarme"
        and notify
    ):
        msg_body = f"""
Alarme Acionado

ID do Irrigador: {parsed_alarme["irrigadorId"]}
ID do evento: {"A" + parsed_alarme["eventCode"]}
Evento: {MONITOR_TENSAO.get(parsed_alarme["eventCode"], "-")}
Horário: {parsed_alarme["timestamp"]}
Status: {parsed_alarme["status"]}
Descrição: {parsed_alarme["description"]}
Responsável: {parsed_alarme["responsible"]}
"""
        try:
            send_message(msg_body, numbers)
            print("[OK] Notificação enviada")
        except TwilioException as e:
            print(f"[ERRO] Erro de configuração do Twilio: {e}")
            print(
                "\n[ERRO] Certifique-se de que as variáveis de ambiente "
                "TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN estão definidas."
            )
            print("[ERRO] Notificação não enviada")
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
    except FileNotFoundError:
        print(f"Erro: O arquivo '{filename}' não foi encontrado.")
    except Exception as e:
        print(f"Ocorreu um erro inesperado: {e}")

    return lines


def query_couchdb(query):
    try:
        couch = couchdb.Server(COUCHDB_URL)
        db = couch[DATABASE]

        result = db.find(query)
        return result
    except ResourceNotFound:
        print(f"Erro: banco de dados '{DATABASE}' não foi encontrado")
        return None
    except Exception as e:
        print(f"Ocorreu um erro inesperado: {e}")
        return None


class Notification(BaseModel):
    table: Literal["notificacao"]
    status: bool

    class Config:
        extra = "allow"


def query_notification():
    query = {"selector": {"table": {"$regex": "notificacao"}}, "limit": 2000}

    result = query_couchdb(query)

    if result is None:
        return None

    item = next(result, None)

    if not item:
        print("Nenhum item encontrado")
        return None

    try:
        notification = Notification.model_validate(item)
        return notification
    except ValidationError as e:
        print(f"Erro de validação: {e}")
        return None


if _name_ == "_main_":
    print("Inicializando MQTT → CouchDB…")
    create_db()

    client = mqtt.Client()
    client.on_message = on_message
    client.connect(MQTT_BROKER, 1883, 60)
    client.subscribe(MQTT_TOPIC)
    client.loop_forever()