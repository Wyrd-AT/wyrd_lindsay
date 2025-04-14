import paho.mqtt.client as mqtt
import requests
import json

COUCHDB_URL = "http://admin:wyrd@127.0.0.1:5984"
DATABASE = "mqtt_data"
MQTT_BROKER = "127.0.0.1"
MQTT_TOPIC = "#"

def create_db():
    response = requests.put(f"{COUCHDB_URL}/{DATABASE}")
    print(response.status_code)

def on_message(client, userdata, msg):
    print(msg)
    if msg.topic == "lindsay/comandos":
        print("Topic 'comandos' detectado, ignorando envio para CouchDB.")
        return
    data = {
        "topic": msg.topic,
        "payload": msg.payload.decode("utf-8"),
        "qos": msg.qos,
        "origin": "esp32"
    }
    requests.post(f"{COUCHDB_URL}/{DATABASE}", json=data)

client = mqtt.Client()
client.on_message = on_message
print("mqtt conn")
create_db()

print("db created")
client.connect(MQTT_BROKER, 1883, 60)
client.subscribe(MQTT_TOPIC)
client.loop_forever()