import random
import time
import threading
import paho.mqtt.client as mqtt

MQTT_BROKER = "54.211.31.145"
MQTT_PORT = 1883
MQTT_TOPIC_PUB = "lindsay/pivo01"

class ArduinoSimulatorMQTT:
    def __init__(self):
        self.activationKey = 3  # começa desativado
        self.lastMinuteEventTime = 0
        self.lastGenericEventTime = 0
        self.lock = threading.Lock()
        self.running = True

        self.client = mqtt.Client("ArduinoSim")
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client_connected = False

        try:
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"Erro conectando MQTT: {e}")

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.client_connected = True
            print("Conectado ao MQTT Broker!")
        else:
            print(f"Falha ao conectar MQTT, código: {rc}")

    def on_disconnect(self, client, userdata, rc):
        self.client_connected = False
        print("Desconectado do MQTT Broker.")

    def generate_minute_event(self):
        code = "333333"
        parts = []
        for _ in range(18):
            intPart = random.randint(100, 999)
            fracPart = random.randint(10, 99)
            dPart = random.randint(0, 1)
            parts.append(f"{intPart}.{fracPart}{dPart}")
        payload = code + ";" + ";".join(parts) + "&"
        return payload

    def generate_five_sec_event(self):
        code = "333333"
        xChar = random.choice(['A', 'E'])
        nnnn = random.randint(1000, 9999)
        payload = f"{code};{xChar}{nnnn}&"
        return payload

    def publish(self, message):
        if self.client_connected:
            result = self.client.publish(MQTT_TOPIC_PUB, message, qos=1, retain=True)
            status = result[0]
            if status == 0:
                print(f"Enviado MQTT: {message}")
            else:
                print("Falha ao enviar MQTT")
        else:
            print("Não conectado ao MQTT, mensagem não enviada.")

    def run_loop(self):
        self.lastMinuteEventTime = time.time()
        self.lastGenericEventTime = time.time()
        print("Simulador rodando. Use 0,1,2,3 para controlar activationKey, 'q' para sair.")

        while self.running:
            now = time.time()
            with self.lock:
                key = self.activationKey

            if key in [1, 2] and now - self.lastMinuteEventTime >= 60:
                self.lastMinuteEventTime = now
                payload = self.generate_minute_event()
                self.publish(payload)

            if key == 1 and now - self.lastGenericEventTime >= 5:
                self.lastGenericEventTime = now
                payload = self.generate_five_sec_event()
                self.publish(payload)

            time.sleep(0.1)

    def input_loop(self):
        while self.running:
            cmd = input().strip()
            if cmd == 'q':
                self.running = False
                break
            try:
                val = int(cmd)
                if val in [0, 1, 2, 3]:
                    with self.lock:
                        if val == 0:
                            print(f"Chave mantida em: {self.activationKey}")
                        else:
                            self.activationKey = val
                            print(f"Chave alterada para: {self.activationKey}")
                else:
                    print("Comando inválido. Use 0,1,2,3 ou 'q' para sair.")
            except:
                print("Entrada inválida. Use 0,1,2,3 ou 'q' para sair.")

if __name__ == "__main__":
    sim = ArduinoSimulatorMQTT()

    thread_run = threading.Thread(target=sim.run_loop)
    thread_input = threading.Thread(target=sim.input_loop)

    thread_run.start()
    thread_input.start()

    thread_input.join()
    sim.running = False  # garante que run_loop termine
    thread_run.join()

    sim.client.loop_stop()
    sim.client.disconnect()

    print("Simulador encerrado.")
