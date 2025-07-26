import random
import time
import threading
import paho.mqtt.client as mqtt
from datetime import datetime

BROKER = "54.211.31.145"
PORT = 1883
TOPIC = "lindsay/pivo01"

class ArduinoSim:
    def _init_(self):
        self.activationKey = 3
        self.lock = threading.Lock()
        self.running = True
        self.client = mqtt.Client(client_id="ArduinoSim")
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.connect(BROKER, PORT)
        self.client.loop_start()
        self.last_minute = time.time()
        self.last_five_sec = time.time()
        self.connected = False

    def on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            print("Conectado ao MQTT Broker!")
            self.connected = True
        else:
            print(f"Falha MQTT, código: {reason_code}")

    def on_disconnect(self, client, userdata, reason_code, properties=None):
        print("Desconectado do MQTT Broker.")
        self.connected = False

    def get_timestamp(self):
        # Retorna timestamp formatado igual ESP: YYYY-MM-DD HH:MM:SS
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def generate_minute_msg(self):
        code = "333333"
        timestamp = self.get_timestamp()
        parts = [f"{random.randint(100,999)}.{random.randint(10,99)}{random.randint(0,1)}" for _ in range(18)]
        # Monta mensagem: <code>;<timestamp>;<valores separados por ;>&
        payload = code + ";" + timestamp + ";" + ";".join(parts)
        return payload

    def generate_five_sec_msg(self):
        code = "333333"
        timestamp = self.get_timestamp()
        xchar = random.choice(['A', 'E'])
        nnnn = random.randint(1000, 9999)
        # Monta mensagem: <code>;<timestamp>;<xchar><nnnn>&
        payload = f"{code};{timestamp};{xchar}{nnnn}"
        return payload

    def publish(self, msg):
        if self.connected:
            self.client.publish(TOPIC, msg, qos=1, retain=True)
            print(f"Enviado: {msg}")
        else:
            print("MQTT desconectado.")

    def run_loop(self):
        print("Rodando. Digite 0,1,2,3 para ativar, q para sair.")
        while self.running:
            now = time.time()
            with self.lock:
                key = self.activationKey

            if key in [1,2] and now - self.last_minute >= 60:
                self.last_minute = now
                self.publish(self.generate_minute_msg())

            if key == 1 and now - self.last_five_sec >= 5:
                self.last_five_sec = now
                self.publish(self.generate_five_sec_msg())

            time.sleep(0.1)

    def input_loop(self):
        while self.running:
            cmd = input().strip()
            if cmd == 'q':
                self.running = False
                break
            if cmd in ['0','1','2','3']:
                with self.lock:
                    if cmd == '0':
                        print(f"Chave mantida em: {self.activationKey}")
                    else:
                        self.activationKey = int(cmd)
                        print(f"Chave alterada para: {self.activationKey}")
            else:
                print("Comando inválido. Use 0,1,2,3 ou q.")

if _name_ == "_main_":
    sim = ArduinoSim()
    threading.Thread(target=sim.run_loop, daemon=True).start()
    sim.input_loop()
    sim.client.loop_stop()
    sim.client.disconnect()
    print("Simulador finalizado.")