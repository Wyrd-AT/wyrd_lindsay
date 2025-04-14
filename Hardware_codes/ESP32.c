#include <WiFi.h>
#include <PubSubClient.h>
#include <SoftwareSerial.h>
#include <time.h>
#include <ArduinoQueue.h>

// Configuração do Wi-Fi
const char* ssid = "RUT200_920F";
const char* password = "Lindsay2025";

// Configuração do Broker MQTT
const char* mqttServer = "54.211.31.145";
const int mqttPort = 1883;
const char* topicPub = "lindsay/pivo01";
const char* topicSub = "lindsay/comandos";

WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastMsgTime = 0;
const long interval = 60000;

// Comunicação Serial Fake (SoftwareSerial)
#define RX_PIN 12
#define TX_PIN 13
SoftwareSerial mySerial(RX_PIN, TX_PIN);

// Fila com capacidade de 300 mensagens
ArduinoQueue<String> messageQueue(300);

// Função para obter a data e hora atuais
String getFormattedDateTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Falha ao obter hora.");
    return "";
  }

  char timeString[20];
  strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
  return String(timeString);
}

// Função de enqueue segura
void enqueueSeguro(String novaMensagem) {
  if (messageQueue.isFull()) {
    messageQueue.dequeue();
    Serial.println("Fila cheia! Substituindo a mensagem mais antiga.");
  }
  messageQueue.enqueue(novaMensagem);
}

// Callback para receber mensagens
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Mensagem recebida no tópico: ");
  Serial.println(topic);
  Serial.print("Mensagem: ");

  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  mySerial.println(message);
}

unsigned long lastReconnectAttempt = 0;
const long reconnectInterval = 5000;

void reconnect() {
  if (!client.connected()) {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > reconnectInterval) {
      lastReconnectAttempt = now;
      Serial.println("Tentando reconectar ao MQTT...");

      if (client.connect("esp32Client")) {
        Serial.println("Reconectado ao MQTT!");
        client.subscribe(topicSub);
      } else {
        Serial.print("Falha na reconexão MQTT, rc=");
        Serial.println(client.state());
      }
    }
  }
}

void sendMessageWithQoS(String message) {
  if (client.publish(topicPub, message.c_str(), true)) {
    Serial.println("Mensagem enviada com sucesso com QoS 1");
  } else {
    Serial.println("Falha ao enviar mensagem, colocando na fila...");
    enqueueSeguro(message);
  }
}

void setup() {
  Serial.begin(115200);
  mySerial.begin(9600);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Conectando ao Wi-Fi...");
  }

  Serial.println("Conectado ao Wi-Fi!");
  client.setServer(mqttServer, mqttPort);
  client.setCallback(callback);
  reconnect();

  configTime(-3*3600, 0, "pool.ntp.org");
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  if (mySerial.available()) {
    String dataFromArduino = mySerial.readString();
    Serial.println("Recebido do Arduino: " + dataFromArduino);

    int startIdx = 0;
    int separatorIdx = dataFromArduino.indexOf('&');

    while (separatorIdx != -1) {
      String singleMessage = dataFromArduino.substring(startIdx, separatorIdx);
      singleMessage.trim();

      if (singleMessage.length() > 0) {
        if (singleMessage.length() > 7) {
          char letterAfterSemicolon = singleMessage.charAt(7);
          if (letterAfterSemicolon == 'A' || letterAfterSemicolon == 'E') {
            String dateTime = getFormattedDateTime();
            singleMessage = singleMessage.substring(0, 7) + dateTime + ";" + singleMessage.substring(7);
          }
        }
        enqueueSeguro(singleMessage);
      }

      startIdx = separatorIdx + 1;
      separatorIdx = dataFromArduino.indexOf('&', startIdx);
    }

    if (startIdx < dataFromArduino.length()) {
      String singleMessage = dataFromArduino.substring(startIdx);
      singleMessage.trim();

      if (singleMessage.length() > 0) {
        if (singleMessage.length() > 7) {
          char letterAfterSemicolon = singleMessage.charAt(7);
          if (letterAfterSemicolon == 'A' || letterAfterSemicolon == 'E') {
            String dateTime = getFormattedDateTime();
            singleMessage = singleMessage.substring(0, 7) + dateTime + ";" + singleMessage.substring(7);
          }
        }
        enqueueSeguro(singleMessage);
      }
    }
  }

  while (!messageQueue.isEmpty()) {
    String message = messageQueue.getHead();
    if (client.connected()) {
      sendMessageWithQoS(message);
      messageQueue.dequeue();
      delay(50);
    } else {
      break;
    }
  }

  delay(50);
}