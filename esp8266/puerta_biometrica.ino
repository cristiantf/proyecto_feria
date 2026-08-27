#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiManager.h>

// ============================================================================
// CONFIGURACIÓN RED LOCAL
// ============================================================================
// IP de tu computadora corriendo el backend Node.js (ej. 192.168.1.100)
const char* HOST_URL = "http://192.168.1.100:3000"; 

// ============================================================================
// PINES DE HARDWARE (RELES)
// ============================================================================
const int PIN_PUERTA = 2;   // D4 (GPIO 2)
const int PIN_LUCES  = 14;  // D5 (GPIO 14)
const int PIN_BOMBA  = 15;  // D8 (GPIO 15)

const unsigned long TIEMPO_PUERTA_MS = 3000; // Puerta se abre por 3 seg
unsigned long msPuertaAbierta = 0;
bool puertaAbierta = false;

unsigned long msCheckCmd = 0;
const unsigned long CHECK_COMANDO_MS = 2000; // Consultar cada 2 segundos

void setup() {
  Serial.begin(115200);
  
  // Configurar pines como salida
  pinMode(PIN_PUERTA, OUTPUT);
  pinMode(PIN_LUCES, OUTPUT);
  pinMode(PIN_BOMBA, OUTPUT);
  
  // Apagar todos los relés al inicio (asumiendo lógica HIGH = encendido)
  // Si tus relés se encienden en LOW, invierte estos valores.
  digitalWrite(PIN_PUERTA, LOW);
  digitalWrite(PIN_LUCES, LOW);
  digitalWrite(PIN_BOMBA, LOW);

  WiFiManager wm;
  wm.setConfigPortalTimeout(180);

  if (!wm.autoConnect("ESP_DOMOTICA")) {
    Serial.println("❌ Timeout WiFi. Reiniciando...");
    delay(3000);
    ESP.restart();
  }

  Serial.println("\n✅ WiFi conectado.");
  Serial.println(WiFi.localIP());
}

void loop() {
  unsigned long now = millis();

  // 1. Temporizador para cerrar la puerta automáticamente
  if (puertaAbierta && (now - msPuertaAbierta >= TIEMPO_PUERTA_MS)) {
    digitalWrite(PIN_PUERTA, LOW);
    puertaAbierta = false;
    Serial.println("🔒 Puerta cerrada automáticamente.");
  }

  // 2. Consultar comandos al servidor cada 2 segundos
  if (WiFi.status() == WL_CONNECTED) {
    if (now - msCheckCmd >= CHECK_COMANDO_MS) {
      revisarComandosNube();
      msCheckCmd = now;
    }
  }
}

void revisarComandosNube() {
  WiFiClient client;
  HTTPClient http;
  
  String url = String(HOST_URL) + "/api/check_comando";
  
  if (http.begin(client, url)) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      String comando = http.getString();
      comando.trim();
      
      if (comando != "NONE" && comando != "") {
        Serial.println("☁️ Comando recibido: " + comando);
        ejecutarComando(comando);
      }
    }
    http.end();
  }
}

void ejecutarComando(String cmd) {
  if (cmd == "ABRIR_PUERTA") {
    digitalWrite(PIN_PUERTA, HIGH);
    puertaAbierta = true;
    msPuertaAbierta = millis();
    Serial.println("🔓 PUERTA ABIERTA");
  } 
  else if (cmd == "LUCES_ON") {
    digitalWrite(PIN_LUCES, HIGH);
    Serial.println("💡 LUCES ENCENDIDAS");
  } 
  else if (cmd == "LUCES_OFF") {
    digitalWrite(PIN_LUCES, LOW);
    Serial.println("💡 LUCES APAGADAS");
  } 
  else if (cmd == "BOMBA_ON") {
    digitalWrite(PIN_BOMBA, HIGH);
    Serial.println("💧 BOMBA ENCENDIDA");
  } 
  else if (cmd == "BOMBA_OFF") {
    digitalWrite(PIN_BOMBA, LOW);
    Serial.println("💧 BOMBA APAGADA");
  }
}
