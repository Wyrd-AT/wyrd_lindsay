#include <SoftwareSerial.h>  // Para comunicação serial via pinos GPIO

#define RX_PIN 10
#define TX_PIN 11

SoftwareSerial mySerial(RX_PIN, TX_PIN);

// Variáveis de controle de tempo
unsigned long lastMinuteEventTime = 0;
unsigned long lastGenericEventTime = 0;

// Variáveis de simulação
int eventCounter = 0;
int activationKey = 1;  // Inicializa com valor inválido (-1), para garantir que a chave de ativação não seja 0 até ser configurada

String generateRandomHex() {
  String hexString = "";
  for (int i = 0; i < 6; i++) {
    int randomValue = random(0, 16);
    hexString += String(randomValue, HEX);
  }
  hexString.toUpperCase();
  return hexString;
}

void setup() {
  mySerial.begin(9600);
  Serial.begin(9600);
  randomSeed(analogRead(0)); // Garante aleatoriedade melhor
  Serial.println("Iniciando o ciclo de comunicação...");
  Serial.println("Digite 1 ou 2 para ativar a chave de ativação. Digite 0 para manter o valor atual.");
  
  // Define o timeout da leitura serial para 100 ms
  Serial.setTimeout(100); // Timeout de 100ms para a leitura serial
}

void loop() {
  unsigned long currentMillis = millis();

  // Lê o comando de ativação via terminal (chave de ativação) com timeout
  if (Serial.available()) {
    int tempKey = Serial.parseInt();  // Lê o número inteiro do terminal

    // Se a entrada for 1 ou 2, a chave é atualizada. Se for 0, o valor atual é mantido.
    if (tempKey == 0) {
      Serial.print("Valor da chave de ativação mantido como: ");
      Serial.println(activationKey);
    } else if (tempKey == 1 || tempKey == 2) {
      activationKey = tempKey;  // Atualiza a chave de ativação com 1 ou 2
      Serial.print("Chave de ativação definida para: ");
      Serial.println(activationKey);
    } else {
      Serial.println("Comando inválido. Digite 1 ou 2 para definir a chave, ou 0 para mantê-la.");
    }

    Serial.flush();  // Limpa o buffer para garantir que não restem valores errados
  }

  // --- Envio a cada 1 minuto ---
  if (currentMillis - lastMinuteEventTime >= 60000) {
    lastMinuteEventTime = currentMillis;

    String hexCode = generateRandomHex();
    eventCounter++;
    String eventData = hexCode + ";" + String(random(100, 999)) + "." + String(random(10, 99)) + String(random(0, 2)) + ";&";

    mySerial.println(eventData);
    Serial.println("Enviado para a ESP32 (evento 1 min): " + eventData);
  }

  // --- Envio a cada 5 segundos com o formato HHHHHH;XNNNN --- (somente se a chave for 1 ou 2)
  if (activationKey == 1 && currentMillis - lastGenericEventTime >= 5000) {
    lastGenericEventTime = currentMillis;

    String hexCode = generateRandomHex();
    char xChar = (random(0, 2) == 0) ? 'A' : 'E';  // Aleatório entre 'A' ou 'E'
    int nnnn = random(1000, 10000); // 4 dígitos aleatórios

    String formatted = hexCode + ";" + xChar + String(nnnn) + "&";
    mySerial.println(formatted);
    Serial.println("Enviado para a ESP32 (evento 5s): " + formatted);
  }

  // --- Leitura da resposta da ESP32 (caso venha algo) ---
  if (mySerial.available()) {
    String response = mySerial.readString();
    if (response.length() > 0) {
      Serial.println("Resposta recebida da ESP32: " + response);

      // Verifica se o texto após o primeiro ';' tem a palavra "alarme" na oitava posição
      int semicolonPos = response.indexOf(';');
      if (semicolonPos != -1 && response.substring(semicolonPos + 1, semicolonPos + 7) == "alarme") {
        // Se encontrar "alarme", envia a resposta com os números aleatórios
        String randomNumbers = "";
        for (int i = 0; i < 6; i++) {
          randomNumbers += String(random(0, 9)) + ";";  // Gera 6 números aleatórios de 0 a 8
        }
        String hexCode = generateRandomHex();
        String alarmResponse = hexCode + ";" + randomNumbers + "&";  // Cria a resposta no formato solicitado
        mySerial.println(alarmResponse);
        Serial.println("Enviado para a ESP32 (alarme): " + alarmResponse);
      }
    }
  }
}
