#include <WiFi.h>
#include <PubSubClient.h>
#include <SoftwareSerial.h>
#include <time.h>
#include <ArduinoQueue.h>

// Configuração do Wi‑Fi
const char* ssid = "RUT200_920F";
const char* password = "Lindsay2025";

// Configuração do Broker MQTT
const char* mqttServer = "54.211.31.145";
const int   mqttPort   = 1883;
const char* topicPub   = "lindsay/pivo01";
const char* topicSub   = "lindsay/comandos";

WiFiClient     espClient;
PubSubClient   client(espClient);
SoftwareSerial mySerial(12, 13);           // RX=12, TX=13
ArduinoQueue<String> messageQueue(300);

bool horaSincronizada = false;

// Timers não‑bloqueantes
unsigned long lastWifiReconnectAttempt   = 0;
const long   wifiReconnectInterval       = 5000;   // 5 s
unsigned long lastMqttReconnectAttempt   = 0;
const long   mqttReconnectInterval       = 5000;   // 5 s

// Verifica se o horário retornado por NTP é plausível
bool horaValida() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return false;
  return (timeinfo.tm_year + 1900 >= 2023);  // Aceita apenas anos válidos
}

// Função para obter data/hora formatada
String getFormattedDateTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Falha ao obter hora.");
    return "";
  }
  char buf[20];
  strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(buf);
}

// Enfileiramento seguro
void enqueueSeguro(const String &msg) {
  if (messageQueue.isFull()) {
    messageQueue.dequeue();
    Serial.println("Fila cheia! Removendo mensagem mais antiga.");
  }
  messageQueue.enqueue(msg);
}

// Callback MQTT
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Mensagem recebida em ");
  Serial.print(topic);
  Serial.print(": ");
  String msg;
  for (unsigned int i = 0; i < length; i++) {
    msg += char(payload[i]);
  }
  Serial.println(msg);
  mySerial.println(msg);
}

// Reconexão MQTT não‑bloqueante
void mqttReconnect() {
  unsigned long now = millis();
  if (client.connected() || now - lastMqttReconnectAttempt < mqttReconnectInterval) {
    return;
  }
  lastMqttReconnectAttempt = now;
  Serial.println("Tentando reconectar ao MQTT...");
  if (client.connect("esp32Client")) {
    Serial.println("Reconectado ao MQTT");
    client.subscribe(topicSub);
  } else {
    Serial.print("Falha MQTT rc=");
    Serial.println(client.state());
  }
}

void setup() {
  Serial.begin(115200);
  mySerial.begin(9600);

  WiFi.begin(ssid, password);
  Serial.println("Inicializando Wi‑Fi...");

  client.setServer(mqttServer, mqttPort); 
  client.setCallback(callback);           

  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov");  
}

void loop() {
  unsigned long now = millis();

  // 1) Garante leitura da serial em todas as iterações
  if (mySerial.available()) {
    String data = mySerial.readString();
    Serial.println("Recebido do Arduino: " + data);

    int start = 0;
    int sep;
    while ((sep = data.indexOf('&', start)) != -1) {
      String msg = data.substring(start, sep);
      msg.trim();
      if (msg.length() > 0) {
        if (horaSincronizada && msg.length() > 7 && msg.charAt(6) == ';') {
          String dt = getFormattedDateTime();
          msg = msg.substring(0,7) + dt + ";" + msg.substring(7);
        }
        enqueueSeguro(msg);
      }
      start = sep + 1;
    }
    // Último fragmento (ou único)
    if (start < data.length()) {
      String msg = data.substring(start);
      msg.trim();
      if (msg.length() > 0) {
        if (horaSincronizada && msg.length() > 7 && msg.charAt(6) == ';') {
          String dt = getFormattedDateTime();
          msg = msg.substring(0,7) + dt + ";" + msg.substring(7);
        }
        enqueueSeguro(msg);
      }
    }
  }

  // 2) Reconectar Wi‑Fi periodicamente (sem bloquear)
  if (WiFi.status() != WL_CONNECTED && now - lastWifiReconnectAttempt >= wifiReconnectInterval) {
    lastWifiReconnectAttempt = now;
    Serial.println("Tentando reconectar Wi‑Fi...");
    WiFi.reconnect();
  }

  // 3) Se o Wi‑Fi estiver OK, gerenciar MQTT e sincronizar horário se necessário
  if (WiFi.status() == WL_CONNECTED) {
    if (!horaSincronizada) {
      if (horaValida()) {
        horaSincronizada = true;
        Serial.println("Horário sincronizado!");
      } else {
        Serial.println("Aguardando horário válido...");
      }
    }

    mqttReconnect();
    if (client.connected()) {
      client.loop();
    }
  }

  // 4) Tentar enviar tudo que está na fila, mas só se mqtt estiver conectado
  while (!messageQueue.isEmpty() && client.connected()) {
    String msg = messageQueue.getHead();
    if (client.publish(topicPub, msg.c_str(), true)) {
      Serial.println("Enviado: " + msg);
      messageQueue.dequeue();
    } else {
      Serial.println("Falha ao enviar, permanece na fila.");
      break;
    }
    delay(50);
  }

  delay(50);
}