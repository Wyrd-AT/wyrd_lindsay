#include <SoftwareSerial.h>  // Para comunicação serial via pinos GPIO

#define RX_PIN 10
#define TX_PIN 11

SoftwareSerial mySerial(RX_PIN, TX_PIN);

// Variáveis de controle de tempo
unsigned long lastMinuteEventTime  = 0;
unsigned long lastGenericEventTime = 0;

// Variável de simulação
int activationKey = 3;  // 0 = mantém, 1 ou 2 ativa o envio a cada 5 s

// --- Padrões fixos de sufixo de 5 dígitos ---
const char* suffixes[] = {
  "A0A0A",
  "B1B1B",
  "C2C2C",
  "D3D3D",
  "E4E4E",
  "F5F5F"
};
const int NUM_SUFFIXES = sizeof(suffixes) / sizeof(suffixes[0]);

// Dígitos hex possíveis para o prefixo
const char* hexDigits = "0123456789ABCDEF";

// Gera um código de 6 caracteres: 1 hex aleatório + 5 de um padrão fixo
String generatePatternHex() {
  char prefix = hexDigits[random(0, 16)];
  const char* suffix = suffixes[random(0, NUM_SUFFIXES)];
  return String(prefix) + String(suffix);
}

void setup() {
  mySerial.begin(9600);
  Serial.begin(9600);
  randomSeed(analogRead(0));

  Serial.println("Iniciando o ciclo de comunicação...");
  Serial.setTimeout(100); // Timeout de 100 ms para parseInt()
}

void loop() {
  unsigned long now = millis();

  // 1) Leitura da chave de ativação via USB-Serial
  if (Serial.available()) {
    int cmd = Serial.parseInt();
    if (cmd == 0) {
      Serial.print("Mantendo chave em: ");
      Serial.println(activationKey);
    } else if (cmd == 1 || cmd == 2 || cmd == 3) {
      activationKey = cmd;
      Serial.print("Chave alterada para: ");
      Serial.println(activationKey);
    } else {
      Serial.println("Comando inválido. Use 1, 2 ou 3.");
    }
    Serial.flush();
  }

  // 2) Evento a cada 1 minuto (sempre ativo) — agora com 18 infos
  if ((activationKey == 1 || activationKey == 2) && (now - lastMinuteEventTime >= 60000)) {
    lastMinuteEventTime = now;

    String code = generatePatternHex();
    String payload = code;

    // gera 18 valores aleatórios no formato "NNN.NND" e separa por ';'
    for (int i = 0; i < 18; i++) {
      int intPart = random(100, 1000);      // de 100 a 999
      int fracPart = random(10, 100);       // de 10 a 99
      int dPart    = random(0, 2);          // 0 ou 1
      payload += ";" + String(intPart) + "." + String(fracPart) + String(dPart);
    }

    payload += "&";  // marcando fim de mensagem
    mySerial.println(payload);
    Serial.println("Enviado (1 min): " + payload);
  }

  // 3) Evento a cada 5 s (só se activationKey for 1 ou 2) — sem alteração aqui
  if ((activationKey == 1) && (now - lastGenericEventTime >= 5000)) {
    lastGenericEventTime = now;

    String code = generatePatternHex();
    char xChar = (random(0, 2) == 0) ? 'A' : 'E';
    int  nnnn  = random(1000, 10000);

    String payload = code + ";" + xChar + String(nnnn) + "&";
    mySerial.println(payload);
    Serial.println("Enviado (5 s): " + payload);
  }

  // 4) Leitura de eventual resposta da ESP32 e resposta de alarme — agora com 18 números
  if (mySerial.available()) {
    String response = mySerial.readString();
    response.trim();
    if (response.length() > 0) {
      Serial.println("Resposta da ESP32: " + response);

      int sc = response.indexOf(';');
      if (sc != -1 && response.substring(sc + 1, sc + 7) == "alarme") {
        String code = response.substring(0, 6);
        String nums = "";

        // gera 18 números (0–9) separados por ';'
        for (int i = 0; i < 18; i++) {
          nums += String(random(0, 10));
          if (i < 17) nums += ";";
        }

        String alarmResp = code + ";" + nums + "&";
        mySerial.println(alarmResp);
        Serial.println("Enviado (alarme): " + alarmResp);
      }
    }
  }
}
