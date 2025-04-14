import couchdb
import paho.mqtt.client as mqtt

COUCHDB_URL = "http://admin:wyrd@127.0.0.1:5984"
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

def listen_changes():
    changes = db.changes(feed='continuous', include_docs=True, heartbeat=1000)
    for change in changes:
        doc = change.get("doc")
        if not doc:
            continue
        if doc.get("origin") == "esp32":
            print("Ignorando documento originado pelo MQTT:", doc.get("_id"))
            continue
        topic = doc.get("topic", DEFAULT_MQTT_TOPIC)
        payload = doc.get("payload")
        qos = doc.get("qos", 0)
        if payload is not None:
            mqtt_client.publish(topic, payload, qos=qos)
            print("Publicado no MQTT -> Tópico: {}, Payload: {}".format(topic, payload))
        else:
            print("Documento {} não possui payload.".format(doc.get("_id")))

listen_changes()