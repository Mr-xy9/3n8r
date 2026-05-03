/*
 * ================================================
 *   نظام التنبيهات المدنية — ESP32
 *   Civil Defense Alert System
 * ================================================
 *
 * المكتبات المطلوبة (Tools → Manage Libraries):
 *   1. ArduinoJson    by Benoit Blanchon
 *   2. WebSockets     by Markus Sattler
 *   3. WiFiManager    by tzapu
 *
 * التوصيل:
 *   Piezo (+) ──► GPIO 25
 *   Piezo (−) ──► GND
 *
 * أول تشغيل:
 *   1. شغّل ESP32
 *   2. تظهر شبكة WiFi اسمها "ESP32-Alert"
 *   3. وصّل جوالك بها
 *   4. افتح 192.168.4.1 في المتصفح
 *   5. اختر الشبكة وأدخل كلمة المرور والسيرفر
 *   6. احفظ — يتصل تلقائياً
 * ================================================
 */

#include <WiFi.h>
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <SocketIOclient.h>
#include <Preferences.h>

// ================================================
//  📍 الأطراف
// ================================================
#define PIN_BUZZER  25
#define PIN_LED     2

// ================================================
//  الإعدادات الثابتة
// ================================================
const char* DEVICE_ID    = "esp32-001";
const char* DEVICE_TOKEN = "c5b7bedbe3015d44b9203858f2623681f83fafb08a661748";
const char* FW_VERSION   = "2.0.0";

// ================================================
//  إعدادات السيرفر (تُحفظ في الذاكرة)
// ================================================
char serverHost[64] = "172.20.10.2";
char serverPort[8]  = "3000";

// ================================================
//  المتغيرات
// ================================================
SocketIOclient socketIO;
Preferences    prefs;
bool wsConnected = false;

struct Alert {
  bool     active    = false;
  uint8_t  phase     = 0;
  uint32_t nextTick  = 0;
  uint32_t endsAt    = 0;
  uint8_t  repeat    = 1;
  uint32_t duration  = 0;
  String   type      = "TEST";
} alert;

// ================================================
//  الصوت
// ================================================
void buzzerOn(uint32_t freq) { tone(PIN_BUZZER, freq); }
void buzzerOff() { noTone(PIN_BUZZER); digitalWrite(PIN_BUZZER, LOW); }

void alertLoop() {
  if (!alert.active) return;
  if (millis() > alert.endsAt) {
    if (alert.repeat > 1) {
      alert.repeat--;
      alert.endsAt  = millis() + alert.duration;
      alert.phase   = 0;
    } else {
      alert.active = false;
      buzzerOff();
      digitalWrite(PIN_LED, LOW);
      return;
    }
  }
  if (millis() < alert.nextTick) return;

  if      (alert.type == "AIR_RAID") {
    if (alert.phase==0) { buzzerOn(800);  alert.nextTick=millis()+400; alert.phase=1; }
    else                { buzzerOn(1200); alert.nextTick=millis()+400; alert.phase=0; }
  }
  else if (alert.type == "GENERAL")  { buzzerOn(1000); alert.nextTick=millis()+500; }
  else if (alert.type == "PARTIAL")  {
    if (alert.phase==0) { buzzerOn(1000); alert.nextTick=millis()+1000; alert.phase=1; }
    else                { buzzerOff();    alert.nextTick=millis()+2000; alert.phase=0; }
  }
  else if (alert.type == "ALL_CLEAR") {
    if (alert.phase==0) { buzzerOn(600);  alert.nextTick=millis()+3000; alert.phase=1; }
    else                { buzzerOff();    alert.nextTick=millis()+1000; alert.phase=0; }
  }
  else {
    if (alert.phase==0) { buzzerOn(1500); alert.nextTick=millis()+300;  alert.phase=1; }
    else                { buzzerOff();    alert.nextTick=millis()+700;  alert.phase=0; }
  }
}

// ================================================
//  Socket.io
// ================================================
void sendEvent(const char* ev, JsonDocument& doc) {
  String data; serializeJson(doc, data);
  socketIO.sendEVENT("[\"" + String(ev) + "\"," + data + "]");
}

void onSocket(socketIOmessageType_t type, uint8_t* payload, size_t len) {
  switch (type) {

    case sIOtype_CONNECT:
      wsConnected = true;
      Serial.println("[ws] ✅ متصل");
      digitalWrite(PIN_LED, HIGH);
      socketIO.send(sIOtype_CONNECT, "/devices");
      {
        JsonDocument h;
        h["type"]="REGISTER"; h["deviceId"]=DEVICE_ID; h["fw"]=FW_VERSION;
        sendEvent("message", h);
      }
      break;

    case sIOtype_DISCONNECT:
      wsConnected = false;
      Serial.println("[ws] ❌ انقطع");
      if (!alert.active) digitalWrite(PIN_LED, LOW);
      break;

    case sIOtype_EVENT: {
      String msg = String((char*)payload, len);
      int c = msg.indexOf(','); if (c<0) break;
      String body = msg.substring(c+1);
      if (body.endsWith("]")) body = body.substring(0, body.length()-1);
      JsonDocument doc; if (deserializeJson(doc, body)) break;
      const char* t = doc["type"] | "";

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
        JsonDocument ack;
        ack["alertId"] = doc["alertId"]|"";
        ack["status"]  = "playing";
        sendEvent("ack", ack);
      }
      else if (strcmp(t,"ALERT_STOP")==0) {
        alert.active = false; buzzerOff();
        if (!wsConnected) digitalWrite(PIN_LED, LOW);
        JsonDocument ack; ack["status"]="stopped"; sendEvent("ack",ack);
      }
      else if (strcmp(t,"PING")==0) {
        JsonDocument p; p["type"]="PONG"; p["deviceId"]=DEVICE_ID;
        sendEvent("message", p);
      }
      else if (strcmp(t,"RESET")==0) { delay(300); ESP.restart(); }
      break;
    }
    default: break;
  }
}

// ================================================
//  Setup
// ================================================
uint32_t lastHB = 0;

void setup() {
  Serial.begin(115200); delay(300);
  Serial.println("\n============================");
  Serial.printf("  ESP32 Alert System v%s\n", FW_VERSION);
  Serial.println("============================");

  pinMode(PIN_BUZZER, OUTPUT); digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_LED,    OUTPUT); digitalWrite(PIN_LED,    LOW);

  // تحميل إعدادات السيرفر المحفوظة
  prefs.begin("alert", false);
  String savedHost = prefs.getString("host", serverHost);
  String savedPort = prefs.getString("port", serverPort);
  savedHost.toCharArray(serverHost, 64);
  savedPort.toCharArray(serverPort, 8);

  // WiFiManager — إعداد بصفحة ويب
  WiFiManager wm;
  WiFiManagerParameter hostParam("host", "Server IP", serverHost, 64);
  WiFiManagerParameter portParam("port", "Server Port", serverPort, 8);
  wm.addParameter(&hostParam);
  wm.addParameter(&portParam);

  wm.setAPName("ESP32-Alert");
  wm.setAPCallback([](WiFiManager* wm) {
    Serial.println("[wifi] 📡 فتح نقطة إعداد: ESP32-Alert");
    Serial.println("[wifi] وصّل جوالك وافتح: 192.168.4.1");
  });

  Serial.println("[wifi] جاري الاتصال...");
  bool connected = wm.autoConnect("ESP32-Alert");

  if (!connected) {
    Serial.println("[wifi] ❌ فشل — إعادة التشغيل...");
    delay(3000); ESP.restart();
  }

  Serial.printf("[wifi] ✅ متصل — ip=%s\n", WiFi.localIP().toString().c_str());

  // حفظ الإعدادات الجديدة
  strncpy(serverHost, hostParam.getValue(), 64);
  strncpy(serverPort, portParam.getValue(), 8);
  prefs.putString("host", serverHost);
  prefs.putString("port", serverPort);
  prefs.end();

  int port = atoi(serverPort);
  String path = String("/socket.io/?EIO=4&transport=websocket&deviceId=")
              + DEVICE_ID + "&token=" + DEVICE_TOKEN;
  socketIO.begin(serverHost, port, path.c_str());
  socketIO.onEvent(onSocket);

  Serial.printf("[ws] جاري الاتصال بـ %s:%d\n", serverHost, port);
}

// ================================================
//  Loop
// ================================================
void loop() {
  socketIO.loop();
  alertLoop();

  if (millis() - lastHB > 10000) {
    lastHB = millis();
    if (wsConnected) {
      JsonDocument hb;
      hb["deviceId"] = DEVICE_ID;
      hb["rssi"]     = WiFi.RSSI();
      hb["uptime"]   = millis()/1000;
      hb["fw"]       = FW_VERSION;
      sendEvent("heartbeat", hb);
    }
  }
}
