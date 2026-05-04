/*
 * ================================================
 *   نظام التنبيهات المدنية — ESP32
 *   Civil Defense Alert System
 * ================================================
 *
 * المكتبات المطلوبة (Tools → Manage Libraries):
 *   1. ArduinoJson   by Benoit Blanchon
 *   2. WebSockets    by Markus Sattler
 *
 * التوصيل:
 *   Piezo (+) ──► GPIO 25
 *   Piezo (−) ──► GND
 * ================================================
 */

#include <WiFi.h>
#include <ArduinoJson.h>
#include <SocketIOclient.h>

// ================================================
//  ⚙️  الإعدادات — عدّل هنا فقط
// ================================================

const char* WIFI_SSID     = "iPhone";
const char* WIFI_PASSWORD = "i1i2i3i4";
const char* SERVER_HOST   = "172.20.10.2";
const int   SERVER_PORT   = 3000;
const char* DEVICE_ID     = "esp32-001";
const char* DEVICE_TOKEN  = "c5b7bedbe3015d44b9203858f2623681f83fafb08a661748";

// ================================================
//  📍 الأطراف
// ================================================
#define PIN_BUZZER     25
#define PIN_LED        2

// ================================================
//  المتغيرات
// ================================================
SocketIOclient socketIO;
bool wsConnected = false;

// أنماط الإنذار
struct Alert {
  bool    active    = false;
  uint8_t phase     = 0;
  uint32_t nextTick = 0;
  uint32_t endsAt   = 0;
  uint8_t  repeat   = 0;
  uint32_t duration = 0;
  String   type     = "";
} alert;

// ================================================
//  دوال الصوت
// ================================================
void buzzerOn(uint32_t freq)  { tone(PIN_BUZZER, freq); }
void buzzerOff()              { noTone(PIN_BUZZER); digitalWrite(PIN_BUZZER, LOW); }

void alertLoop() {
  if (!alert.active) return;
  if (millis() > alert.endsAt) {
    if (alert.repeat > 1) {
      alert.repeat--;
      alert.endsAt = millis() + alert.duration;
      alert.phase  = 0;
    } else {
      alert.active = false;
      buzzerOff();
      digitalWrite(PIN_LED, LOW);
      Serial.println("[snd] done");
      return;
    }
  }
  if (millis() < alert.nextTick) return;

  if (alert.type == "AIR_RAID") {
    if (alert.phase == 0) { buzzerOn(800);  alert.nextTick = millis()+400; alert.phase=1; }
    else                  { buzzerOn(1200); alert.nextTick = millis()+400; alert.phase=0; }
  } else if (alert.type == "GENERAL") {
    buzzerOn(1000); alert.nextTick = millis()+500;
  } else if (alert.type == "PARTIAL") {
    if (alert.phase==0) { buzzerOn(1000); alert.nextTick=millis()+1000; alert.phase=1; }
    else                { buzzerOff();    alert.nextTick=millis()+2000; alert.phase=0; }
  } else if (alert.type == "ALL_CLEAR") {
    if (alert.phase==0) { buzzerOn(600); alert.nextTick=millis()+3000; alert.phase=1; }
    else                { buzzerOff();   alert.nextTick=millis()+1000; alert.phase=0; }
  } else { // TEST
    if (alert.phase==0) { buzzerOn(1500); alert.nextTick=millis()+300; alert.phase=1; }
    else                { buzzerOff();    alert.nextTick=millis()+700; alert.phase=0; }
  }
}

// ================================================
//  Socket.io
// ================================================
void sendEvent(const char* event, JsonDocument& doc) {
  String data; serializeJson(doc, data);
  String msg = "[\"" + String(event) + "\"," + data + "]";
  socketIO.sendEVENT(msg);
}

void onSocket(socketIOmessageType_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case sIOtype_CONNECT:
      wsConnected = true;
      Serial.println("[ws] ✅ connected");
      digitalWrite(PIN_LED, HIGH);
      // Server uses root namespace for devices — no manual namespace join
      { JsonDocument h; h["type"]="REGISTER"; h["deviceId"]=DEVICE_ID; h["fw"]="1.1.0"; sendEvent("message",h); }
      break;

    case sIOtype_DISCONNECT:
      wsConnected = false;
      Serial.println("[ws] ❌ disconnected");
      digitalWrite(PIN_LED, LOW);
      break;

    case sIOtype_EVENT: {
      String msg = String((char*)payload, length);
      int c = msg.indexOf(','); if (c<0) break;
      String body = msg.substring(c+1);
      if (body.endsWith("]")) body=body.substring(0,body.length()-1);
      JsonDocument doc; if (deserializeJson(doc,body)) break;
      const char* t = doc["type"]|"";

      if (strcmp(t,"ALERT_START")==0) {
        alert.active   = true;
        alert.type     = String((const char*)(doc["alertType"]|"TEST"));
        alert.duration = (uint32_t)(doc["duration"]|30) * 1000UL;
        alert.repeat   = doc["repeat"]|1;
        alert.endsAt   = millis() + alert.duration;
        alert.phase    = 0;
        alert.nextTick = millis();
        digitalWrite(PIN_LED, HIGH);
        Serial.printf("[snd] ▶ %s\n", alert.type.c_str());
        JsonDocument ack; ack["alertId"]=doc["alertId"]|""; ack["status"]="playing"; sendEvent("ack",ack);
      }
      else if (strcmp(t,"ALERT_STOP")==0) {
        alert.active=false; buzzerOff(); digitalWrite(PIN_LED,LOW);
        JsonDocument ack; ack["status"]="stopped"; sendEvent("ack",ack);
      }
      else if (strcmp(t,"PING")==0) {
        JsonDocument p; p["type"]="PONG"; p["deviceId"]=DEVICE_ID; sendEvent("message",p);
      }
      else if (strcmp(t,"RESET")==0) { delay(300); ESP.restart(); }
      break;
    }
    default: break;
  }
}

// ================================================
//  اتصال WiFi مع فحص الشبكات
// ================================================
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); delay(200);

  // فحص الشبكات المتاحة
  Serial.println("[wifi] scanning...");
  int n = WiFi.scanNetworks();
  bool found = false;
  for (int i=0; i<n; i++) {
    String ssid = WiFi.SSID(i);
    Serial.printf("  → \"%s\" (%d dBm)\n", ssid.c_str(), WiFi.RSSI(i));
    if (ssid == String(WIFI_SSID)) found = true;
  }

  if (!found) {
    Serial.printf("[wifi] ⚠️  شبكة \"%s\" غير موجودة!\n", WIFI_SSID);
  }

  Serial.printf("[wifi] connecting to \"%s\"...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t t = millis();
  while (WiFi.status()!=WL_CONNECTED && millis()-t<20000) {
    delay(500); Serial.print('.');
  }
  if (WiFi.status()==WL_CONNECTED) {
    Serial.printf("\n[wifi] ✅ connected — ip=%s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.printf("\n[wifi] ❌ failed (check SSID/password)\n");
  }
}

// ================================================
//  Setup & Loop
// ================================================
uint32_t lastHB = 0;

void setup() {
  Serial.begin(115200); delay(300);
  Serial.println("\n\n=============================");
  Serial.printf("  ESP32 Civil Alert v1.1.0\n");
  Serial.println("=============================");

  pinMode(PIN_BUZZER, OUTPUT); digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_LED,    OUTPUT); digitalWrite(PIN_LED,    LOW);

  connectWiFi();

  if (WiFi.status()==WL_CONNECTED) {
    String path = String("/socket.io/?EIO=4&transport=websocket&deviceId=")
                + DEVICE_ID + "&token=" + DEVICE_TOKEN;
    socketIO.begin(SERVER_HOST, SERVER_PORT, path.c_str());
    socketIO.onEvent(onSocket);
    Serial.printf("[ws] connecting to %s:%d\n", SERVER_HOST, SERVER_PORT);
  }
}

void loop() {
  if (WiFi.status()!=WL_CONNECTED) { connectWiFi(); return; }
  socketIO.loop();
  alertLoop();

  if (millis()-lastHB > 10000) {
    lastHB = millis();
    if (wsConnected) {
      JsonDocument hb;
      hb["deviceId"]=DEVICE_ID; hb["rssi"]=WiFi.RSSI();
      hb["uptime"]=millis()/1000; hb["fw"]="1.1.0";
      sendEvent("heartbeat", hb);
    }
  }
}
