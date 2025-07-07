import paho.mqtt.client as mqtt
import requests
import re
from datetime import datetime
from zoneinfo import ZoneInfo

COUCHDB_URL = "http://admin:wyrd@127.0.0.1:5984"
DATABASE = "mqtt_data"
MQTT_BROKER = "127.0.0.1"
MQTT_TOPIC = "#"

BR_TZ = ZoneInfo("America/Sao_Paulo")

# --- mapa de status usado em monitorStatus ---
STATUS_MAP = {
    '0': 'OK',
    '1': 'Alarmado',
    '2': 'Reconhecido',
    '3': 'Resolvido',
    '4': 'Desconhecido',
    '5': 'Desconhecido',
    '6': 'Desconhecido',
    '7': 'Desconhecido',
    '8': 'Desconhecido',
    '9': 'Ausente',
}


def fmt_ts(dt: datetime) -> str:
    """
    Converte um datetime (naive ou aware) para fuso de Brasília,
    remove microssegundos e retorna ISO-format até os segundos.
    """
    # se for naive, assumimos que já veio em horário local de SP
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BR_TZ)
    else:
        dt = dt.astimezone(BR_TZ)
    return dt.replace(microsecond=0).isoformat(timespec='seconds')


def create_db():
    """Cria o DB caso não exista."""
    resp = requests.put(f"{COUCHDB_URL}/{DATABASE}")
    if resp.status_code not in (201, 412):
        print(f"[WARN] criação do DB retornou {resp.status_code}")
    else:
        print(f"[OK] DB '{DATABASE}' pronto (status {resp.status_code})")


def on_message(client, userdata, msg):
    if msg.topic.startswith("$SYS/"):
        return

    payload_str = msg.payload.decode('utf-8', errors='ignore')
    if msg.topic.startswith("lindsay/comandos"):
        return

    try:
        parsed = {
            'data': payload_str,
            'timestamp': fmt_ts(datetime.now())
        }

    except ValueError as e:
        # fallback: envia o payload cru + erro
        parsed = {
            'type': 'error',
            'error': str(e),
            'string_error':payload_str,
            'timestamp': fmt_ts(datetime.now())
        }

    doc = {
        'topic': msg.topic,
        'type': 'string',
        'origin': 'esp32',
        'table': 'mqtt_messages',
        **parsed
    }

    # grava no CouchDB
    resp = requests.post(f"{COUCHDB_URL}/{DATABASE}", json=doc)
    if resp.status_code not in (201, 202):
        print(f"[ERRO] POST no CouchDB retornou {resp.status_code}: {resp.text}")
    else:
        print(f"[OK] Gravou doc id={resp.json().get('id')}")


if __name__ == "__main__":
    print("Inicializando MQTT → CouchDB…")
    create_db()

    client = mqtt.Client()
    client.on_message = on_message
    client.connect(MQTT_BROKER, 1883, 60)
    client.subscribe(MQTT_TOPIC)
    client.loop_forever()