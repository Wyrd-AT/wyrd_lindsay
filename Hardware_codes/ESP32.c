/* 
  ESP REDE
    Efetua a comunicação do Arduino com o banco de dados (MQTT)
    Gera WDT para o Arduino efetuar o ENABLE quando reiniciado ou reenergizado o sistema

  DA VERSÃO
    Ajustada a comunicação pela UART do Arduino
    Somente envia ao MQTT se a String enviada pelo Arduino iniciar pelo myID
    Envia comandos escritos ao Arduino pelo Monitor Serial
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <SoftwareSerial.h>
#include <time.h>
#include <ArduinoQueue.h>

// Acrescido para conversar com Arduino via hwrdware até solução definitiva para Comunicação Serial
  int WDT = 0;            // WDT
  int t0 = 0;             // auxiliar WDT
  String myID("222222");  // para selecionar o que deve ser transmitido para Arduino e/ou Wifi

// Configuração do Wi‑Fi
// const char* ssid = "RUT200_6911"; 
// const char* password = "Fy17PkQa"; 
const char* ssid = "TPLINK_B7F8F6";
const char* password = "tomodashi";

// Configuração do Broker MQTT
const char* mqttServer = "54.211.31.145";
const int   mqttPort   = 1883;
const char* topicPub   = "lindsay/pivo01";
const char* topicSub   = "lindsay/comandos/111111";

WiFiClient     espClient;
PubSubClient   client(espClient);
SoftwareSerial mySerial(16, 17);           // RX=12->2(led)->16, TX=13->4->17
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
  if (msg.substring(0, 6) == myID) { mySerial.println(msg); }
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
  Serial.begin(57600);
  Serial.setTimeout(500);
  mySerial.begin(57600);

  WiFi.mode(WIFI_STA);

  Serial.print("Conectando a rede Wi-Fi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int tentativas = 0;
  const int maxTentativas = 20;

// Aguarda conexão
  while (WiFi.status() != WL_CONNECTED && tentativas < maxTentativas) {
    delay(500);
    Serial.print(".");
    tentativas++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConectado com sucesso!");
    Serial.print("Endereço IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFalha ao conectar na rede Wi-Fi.");
  }

  client.setServer(mqttServer, mqttPort);
  client.setCallback(callback);

  configTime(-3 * 3600, 0, "pool.ntp.org", "time.nist.gov"); 

  pinMode(27, OUTPUT);    // saida WDT 
  digitalWrite(27, LOW);  // WDT -> inicia em zero 
}

void loop() {
  unsigned long now = millis();

  // 1) Garante leitura da serial em todas as iterações
  if (mySerial.available()) {
    String data = mySerial.readString();
    Serial.println("Recebido do Arduino: " + data);
    if (data.substring(0, 6) == "222222") {  // envia somente mensagem identificada ao BD
      // Serial.println("rotina para enviar");
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
  }

  // 2) Reconectar Wi‑Fi periodicamente (sem bloquear)
  if (WiFi.status() != WL_CONNECTED && now - lastWifiReconnectAttempt >= wifiReconnectInterval) {
    lastWifiReconnectAttempt = now;
    Serial.println("Tentando reconectar Wi‑Fi...");
    WiFi.disconnect();
    delay(100);
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
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

  // 5) WDT para Arduino via Hardware e comandos via monitor serial
    t0++; if (t0 > 25) { WDT = 1 - WDT; t0 = 0; } // ciclo WDT ~5s
    if (WDT == 1) { digitalWrite(27, HIGH); } else { digitalWrite(27, LOW); }
    if (Serial.available()) {
      String cmd = Serial.readString();
      Serial.println(cmd);
      mySerial.println(cmd);
    }

  delay(50);
}
