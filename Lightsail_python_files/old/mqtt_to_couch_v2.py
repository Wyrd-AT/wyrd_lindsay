from typing import Dict, Any
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import paho.mqtt.client as mqtt
import requests
from dotenv import load_dotenv
from twilio.base.exceptions import TwilioException
from twilio.rest import Client

# ================== CONFIG ==================
load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM = os.getenv("TWILIO_FROM", "whatsapp:+14155238886")

COUCHDB_URL = os.getenv("COUCHDB_URL", "http://admin:wyrd@127.0.0.1:5984")
DATABASE = os.getenv("COUCHDB_DB", "lindsay-data")
MQTT_BROKER = os.getenv("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "#")

# Destinatários padrão do alerta (pode vir de env)
ALERT_TO = [
    os.getenv("ALERT_TO_1", "+5511995480383"),  # Lucas p/ teste
    os.getenv("ALERT_TO_2", "+5519974134215"),  # Cliente
    os.getenv("ALERT_TO_3", "+5511989890203"),  # Henrique
]

BR_TZ = ZoneInfo("America/Sao_Paulo")

# Twilio opcional
client_twilio: Client | None = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        client_twilio = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except Exception as e:
        print(f"[WARN] Twilio não inicializado: {e}")
else:
    print("[INFO] Variáveis do Twilio não definidas. Notificações desabilitadas.")


# ================== UTIL ==================
def fmt_ts(dt: datetime) -> str:
    """Retorna timestamp local (BR) legível: HH:MM:SS dd/mm/yyyy"""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BR_TZ)
    else:
        dt = dt.astimezone(BR_TZ)
    return dt.strftime("%H:%M:%S %d/%m/%Y")


def create_db():
    """Cria o DB caso não exista."""
    try:
        resp = requests.put(f"{COUCHDB_URL}/{DATABASE}", timeout=5)
        if resp.status_code in (201, 412):
            print(f"[OK] DB '{DATABASE}' pronto (status {resp.status_code})")
        else:
            print(f"[WARN] criação do DB retornou {resp.status_code}: {resp.text}")
    except requests.RequestException as e:
        print(f"[ERRO] Não foi possível verificar/criar DB: {e}")


def split_data_hora(ts: str):
    data, hora = ts.split("T", 1)
    return data, hora


def parse_mt(mt_str: str) -> Dict[str, int]:
    # Espera 4 dígitos, ex.: "3333"
    mt_str = mt_str.strip()
    return {
        "fim_de_curso_1": int(mt_str[0]),
        "fim_de_curso_2": int(mt_str[1]),
        "armadilha_tensao": int(mt_str[2]),
        "status_mt": int(mt_str[3]),
    }


def parse_sw(parts: list) -> Dict[str, Any]:
    # parts (19): id, ts, painel1, painel2, status(3 dígitos), mt1..mt14
    irrigador_id, ts, painel_1, painel_2, status, *mts = parts
    data, hora = split_data_hora(ts)
    luz, sirene, manutencao = (int(status[0]), int(status[1]), int(status[2]))
    medidores = {f"mt{i+1}": parse_mt(mt) for i, mt in enumerate(mts)}
    return {
        "type": "sw",
        "irrigadorId": irrigador_id,
        "data": data,
        "hora": hora,
        "painel_1": int(painel_1),
        "painel_2": int(painel_2),
        "status": {"luz": luz, "sirene": sirene, "manutencao": manutencao},
        "medidores": medidores,
    }


def parse_tensao(parts: list) -> Dict[str, Any]:
    # parts (9): idAouB, ts, v1..v7 (ex.: "206.670" -> 206.67 + status 0)
    idAouB, ts, *vals = parts
    irrigador_id, pos = idAouB[:6], idAouB[6]  # 'A' ou 'B'
    data, hora = split_data_hora(ts)

    tensoes = {}
    for i, valor in enumerate(vals, start=1):
        valor = valor.strip()
        status = int(valor[-1])
        voltage = float(valor[:-1]) if valor[:-1] else 0.0
        tensoes[f"va{i}"] = {"voltage": voltage, "status": status}

    return {
        "type": "tensao",
        "irrigadorId": irrigador_id,
        "data": data,
        "hora": hora,
        "tensao": {"posicao": pos, **tensoes},
    }


def parse_alerta(parts: list) -> Dict[str, Any]:
    # parts (4): id, ts, tipo, valor
    irrigador_id, ts, tipo, valor = parts
    data, hora = split_data_hora(ts)
    return {
        "type": "alerta",
        "irrigadorId": irrigador_id,
        "data": data,
        "hora": hora,
        "alerta": {"tipo": tipo, "valor": int(valor)},
    }


def identificar_e_parse(linha: str) -> Dict[str, Any]:
    """
    Retorna um dicionário estruturado com a chave 'type' ∈ {'sw','tensao','alerta','desconhecido'}.
    """
    if not linha or ";" not in linha:
        return {"type": "desconhecido", "raw": linha, "error": "sem separador ';'"}

    parts = [p.strip() for p in linha.split(";")]
    n = len(parts)

    try:
        # TENSÃO A/B: 9 campos e primeiro token termina em A ou B
        if n == 9 and len(parts[0]) >= 7 and parts[0][-1] in ("A", "B"):
            return parse_tensao(parts)

        # SW: 19 campos, segundo token com 'T' separando data/hora
        if n == 19 and "T" in parts[1]:
            return parse_sw(parts)

        # ALERTA: 4 campos
        if n == 4 and "T" in parts[1]:
            return parse_alerta(parts)

        return {"type": "desconhecido", "raw": linha, "error": f"formato não reconhecido (campos={n})"}
    except Exception as e:
        return {"type": "desconhecido", "raw": linha, "error": str(e)}


def send_message(msg: str, to: list[str]):
    if not client_twilio:
        print("[INFO] Twilio desabilitado. Mensagem NÃO enviada.")
        return
    for t in to:
        try:
            _ = client_twilio.messages.create(
                body=msg,
                from_=TWILIO_FROM,
                to=f"whatsapp:{t}",
            )
        except TwilioException as e:
            print(f"[ERRO] Falha ao enviar p/ {t}: {e}")


# ================== MQTT CALLBACK ==================
def on_message(client, userdata, msg):
    # Ignora tópicos de sistema/comando
    if msg.topic.startswith("$SYS/") or msg.topic.startswith("lindsay/comandos"):
        return

    payload_str = msg.payload.decode("utf-8", errors="ignore").strip()
    now = datetime.now(BR_TZ)

    # Faz o parsing real da linha recebida
    parsed = identificar_e_parse(payload_str)

    # Documento a ser salvo no CouchDB
    doc = {
        "topic": msg.topic,
        "origin": "esp32",
        "received_at_iso": now.isoformat(),
        "received_at_br": fmt_ts(now),
        "raw": payload_str,
        **parsed,  # inclui type, irrigadorId, etc.
    }

    # Notificação somente para ALERTA com valor == 1
    if parsed.get("type") == "alerta":
        try:
            alerta = parsed["alerta"]
            if int(alerta.get("valor", 0)) == 1:
                body = (
                    "*Alarme Acionado*\n\n"
                    f"*Irrigador:* {parsed.get('irrigadorId','')}\n"
                    f"*Tipo:* {alerta.get('tipo','')}\n"
                    f"*Valor:* {alerta.get('valor')}\n"
                    f"*Data:* {parsed.get('data','')} {parsed.get('hora','')}\n"
                    f"*Recebido:* {fmt_ts(now)}\n"
                )
                send_message(body, ALERT_TO)
                print("[OK] Notificação de alerta enviada")
        except Exception as e:
            print(f"[WARN] Falha ao processar notificação: {e}")

    # Grava no CouchDB
    try:
        resp = requests.post(f"{COUCHDB_URL}/{DATABASE}", json=doc, timeout=5)
        if resp.status_code in (201, 202):
            print(f"[OK] Gravou doc id={resp.json().get('id')}")
        else:
            print(f"[ERRO] CouchDB {resp.status_code}: {resp.text}")
    except requests.RequestException as e:
        print(f"[ERRO] Falha HTTP ao gravar no CouchDB: {e}")


# ================== MAIN ==================
if __name__ == "__main__":
    print("Inicializando MQTT → CouchDB…")
    create_db()

    client = mqtt.Client()
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.subscribe(MQTT_TOPIC)
    print(f"[OK] Conectado em {MQTT_BROKER}:{MQTT_PORT} | tópico '{MQTT_TOPIC}'")
    client.loop_forever()


"""

{
  "topic": "teste/lind",
  "origin": "esp32",
  "received_at_iso": "2025-09-04T14:05:12-03:00",
  "received_at_br": "14:05:12 04/09/2025",
  "raw": "777777;2025-08-25T09:23:28;0;0;303;0000;0000;0000;0000;0000;0000;3333;0002;3333;3333;3333;3333;3333;3333",
  "type": "sw",
  "irrigadorId": "777777",
  "data": "2025-08-25",
  "hora": "09:23:28",
  "painel_1": 0,
  "painel_2": 0,
  "status": { "luz": 3, "sirene": 0, "manutencao": 3 },
  "medidores": {
    "mt1":  { "fim_de_curso_1": 0, "fim_de_curso_2": 0, "armadilha_tensao": 0, "status_mt": 0 },
    "mt2":  { "fim_de_curso_1": 0, "fim_de_curso_2": 0, "armadilha_tensao": 0, "status_mt": 0 },
    "mt3":  { "fim_de_curso_1": 0, "fim_de_curso_2": 0, "armadilha_tensao": 0, "status_mt": 0 },
    "mt4":  { "fim_de_curso_1": 0, "fim_de_curso_2": 0, "armadilha_tensao": 0, "status_mt": 0 },
    "mt5":  { "fim_de_curso_1": 0, "fim_de_curso_2": 0, "armadilha_tensao": 0, "status_mt": 0 },
    "mt6":  { "fim_de_curso_1": 0, "fim_de_curso_2": 0, "armadilha_tensao": 0, "status_mt": 0 },
    "mt7":  { "fim_de_curso_1": 3, "fim_de_curso_2": 3, "armadilha_tensao": 3, "status_mt": 3 },
    "mt8":  { "fim_de_curso_1": 0, "fim_de_curso_2": 0, "armadilha_tensao": 0, "status_mt": 2 },
    "mt9":  { "fim_de_curso_1": 3, "fim_de_curso_2": 3, "armadilha_tensao": 3, "status_mt": 3 },
    "mt10": { "fim_de_curso_1": 3, "fim_de_curso_2": 3, "armadilha_tensao": 3, "status_mt": 3 },
    "mt11": { "fim_de_curso_1": 3, "fim_de_curso_2": 3, "armadilha_tensao": 3, "status_mt": 3 },
    "mt12": { "fim_de_curso_1": 3, "fim_de_curso_2": 3, "armadilha_tensao": 3, "status_mt": 3 },
    "mt13": { "fim_de_curso_1": 3, "fim_de_curso_2": 3, "armadilha_tensao": 3, "status_mt": 3 },
    "mt14": { "fim_de_curso_1": 3, "fim_de_curso_2": 3, "armadilha_tensao": 3, "status_mt": 3 }
  }
}


{
  "topic": "teste/lind",
  "origin": "esp32",
  "received_at_iso": "2025-09-04T14:05:15-03:00",
  "received_at_br": "14:05:15 04/09/2025",
  "raw": "777777A;2025-08-25T09:28:28;206.670;201.240;201.400;202.740;198.280;199.720;0.073",
  "type": "tensao",
  "irrigadorId": "777777",
  "data": "2025-08-25",
  "hora": "09:28:28",
  "tensao": {
    "posicao": "A",
    "va1": { "voltage": 206.67, "status": 0 },
    "va2": { "voltage": 201.24, "status": 0 },
    "va3": { "voltage": 201.4,  "status": 0 },
    "va4": { "voltage": 202.74, "status": 0 },
    "va5": { "voltage": 198.28, "status": 0 },
    "va6": { "voltage": 199.72, "status": 0 },
    "va7": { "voltage": 0.07,   "status": 3 }
  }
}

{
  "topic": "teste/lind",
  "origin": "esp32",
  "received_at_iso": "2025-09-04T14:05:18-03:00",
  "received_at_br": "14:05:18 04/09/2025",
  "raw": "777777B;2025-08-25T09:28:28;0.082;0.093;0.103;0.113;0.123;0.133;0.143",
  "type": "tensao",
  "irrigadorId": "777777",
  "data": "2025-08-25",
  "hora": "09:28:28",
  "tensao": {
    "posicao": "B",
    "va1": { "voltage": 0.08, "status": 2 },
    "va2": { "voltage": 0.09, "status": 3 },
    "va3": { "voltage": 0.1,  "status": 3 },
    "va4": { "voltage": 0.11, "status": 3 },
    "va5": { "voltage": 0.12, "status": 3 },
    "va6": { "voltage": 0.13, "status": 3 },
    "va7": { "voltage": 0.14, "status": 3 }
  }
}


{
  "topic": "teste/lind",
  "origin": "esp32",
  "received_at_iso": "2025-09-04T14:05:21-03:00",
  "received_at_br": "14:05:21 04/09/2025",
  "raw": "777777;2025-08-25T11:27:29;man;1",
  "type": "alerta",
  "irrigadorId": "777777",
  "data": "2025-08-25",
  "hora": "11:27:29",
  "alerta": { "tipo": "man", "valor": 1 }
}

{
  "topic": "teste/lind",
  "origin": "esp32",
  "received_at_iso": "2025-09-04T14:05:25-03:00",
  "received_at_br": "14:05:25 04/09/2025",
  "raw": "777777;payload-invalido",
  "type": "desconhecido",
  "error": "formato não reconhecido (campos=2)"
}


"""