import couchdb
import paho.mqtt.client as mqtt
import threading

COUCHDB_URL = "http://admin:wyrd@54.211.31.145:5984/"
DATABASE_NAME = "mqtt_data"
MQTT_BROKER = "127.0.0.1"
MQTT_PORT = 1883
DEFAULT_MQTT_TOPIC = "default_topic"

server = couchdb.Server(COUCHDB_URL)
try:
    db = server[DATABASE_NAME]
except couchdb.http.ResourceNotFound:
    db = server.create(DATABASE_NAME)

mqtt_client = mqtt.Client()
mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
mqtt_client.loop_start()

# dicionário para guardar timers ativos por doc_id
timers = {}

def publish_mqtt(payload, topic, qos, doc):
    if payload is not None:
        mqtt_client.publish(topic, payload, qos=qos)
        #print(f"Publicado no MQTT -> Tópico: {topic}, Payload: {payload}")
    

def timer_mqtt(payload, topic, qos, doc, delay):
    """
    Cria/atualiza um timer para o doc: cancela o anterior (se houver)
    e agenda um novo publish após 'delay' segundos.
    """
    doc_id = doc.get("_id")

    # cancela timer anterior, se existir
    if doc_id in timers:
        timers[doc_id].cancel()

    def _delayed():
        publish_mqtt(payload, topic, qos, doc)
        # remove do dict para liberar memória
        timers.pop(doc_id, None)

    t = threading.Timer(delay, _delayed)
    t.daemon = True
    t.start()
    timers[doc_id] = t

    #print(f"[TIMER] Agendado doc {doc_id} em {delay}s -> Tópico: {topic}")

def listen_changes():
    print(timers)
    changes = db.changes(feed='continuous', include_docs=True, heartbeat=1000)
    for change in changes:
        doc = change.get("doc")
        if not doc:
            continue

        # ignora origens que não sejam externas
        if doc.get("origin") in ("esp32", "scheduler") or doc.get("scheduled") == True:
            continue

        topic = doc.get("topic", DEFAULT_MQTT_TOPIC)
        payload = doc.get("payload")
        if payload is not None:
            comando = payload[6:13]
            print(f" Comando: {comando}")
        qos = doc.get("qos", 0)
        timer_value = doc.get("timer")

        if timer_value is not None:
            # tenta converter timer para inteiro (segundos)
            try:
                delay = int(timer_value)*60  # converte minutos para segundos
                timer_mqtt(payload, topic, qos, doc, delay)

                # marca o doc como agendado e evita reprocessar
                doc["scheduled"] = True
                db.save(doc)

            except (ValueError, TypeError):
                print(f"[ERRO] Timer inválido no doc {doc.get('_id')}: {timer_value}")
        else:
            publish_mqtt(payload, topic, qos, doc)

if __name__ == "__main__":
    listen_changes()
