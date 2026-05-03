// نظام التنبيهات المدنية - ESP32 Civil Alert System
// Arduino IDE compatible version
//
// المكتبات المطلوبة (Library Manager → Search → Install):
//   1. ArduinoJson by Benoit Blanchon
//   2. WebSockets by Markus Sattler (links2004)
//
// التوصيل:
//   Piezo Buzzer (+) → GPIO 25
//   Piezo Buzzer (-) → GND
//
// قبل التحميل: غيّر الإعدادات في القسم التالي ↓

#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <SocketIOclient.h>

// ============================================
//   ⚙️ غيّر هذه الإعدادات حسب شبكتك
// ============================================

#define WIFI_SSID       "iPhone"
#define WIFI_PASSWORD   "i1i2i3i4"

#define SERVER_HOST     "172.20.10.2"
#define SERVER_PORT     3000

#define DEVICE_ID       "esp32-001"
#define DEVICE_TOKEN    "c5b7bedbe3015d44b9203858f2623681f83fafb08a661748"

// ============================================
//   📍 GPIO Pins
// ============================================
#define PIN_BUZZER       25
#define PIN_STATUS_LED   2

// ============================================
//   ⏱️ التوقيتات
// ============================================
#define HEARTBEAT_INTERVAL_MS  10000
#define RECONNECT_DELAY_MS     5000
#define FIRMWARE_VERSION       "1.1.0"

// ============================================
//   🎵 أنماط التنبيهات
// ============================================
enum AlertPattern {
  ALERT_AIR_RAID,
  ALERT_GENERAL,
  ALERT_PARTIAL,
  ALERT_ALL_CLEAR,
  ALERT_TEST,
};

// ============================================
//   🔊 SoundController
// ============================================
class SoundController {
public:
  void begin() {
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.printf("[snd] Piezo Buzzer ready on GPIO %d\n", PIN_BUZZER);
  }

  void start(AlertPattern p, uint16_t durationSec, uint8_t repeat) {
    pattern_   = p;
    totalMs_   = (uint32_t)durationSec * 1000UL;
    repeats_   = repeat;
    startedAt_ = millis();
    playing_   = true;
    tickPhase_ = 0;
    nextTick_  = millis();
    currentFreq_ = 0;
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.printf("[snd] start pattern=%d dur=%us repeat=%u\n", p, durationSec, repeat);
  }

  void stop() {
    playing_ = false;
    buzzerOff_();
    Serial.println("[snd] stopped");
  }

  bool isPlaying() const { return playing_; }

  void loop() {
    if (!playing_) return;
    uint32_t elapsed = millis() - startedAt_;
    if (elapsed >= totalMs_) {
      if (--repeats_ > 0) {
        startedAt_ = millis();
        tickPhase_ = 0;
        nextTick_  = millis();
      } else {
        stop();
        return;
      }
    }
    applyPattern_();
  }

  static AlertPattern fromString(const String& s) {
    if (s == "AIR_RAID")  return ALERT_AIR_RAID;
    if (s == "GENERAL")   return ALERT_GENERAL;
    if (s == "PARTIAL")   return ALERT_PARTIAL;
    if (s == "ALL_CLEAR") return ALERT_ALL_CLEAR;
    return ALERT_TEST;
  }

private:
  AlertPattern pattern_   = ALERT_TEST;
  uint32_t     totalMs_   = 0;
  uint32_t     startedAt_ = 0;
  uint32_t     nextTick_  = 0;
  uint32_t     currentFreq_ = 0;
  uint8_t      repeats_   = 0;
  uint8_t      tickPhase_ = 0;
  bool         playing_   = false;

  void buzzerOn_(uint32_t freq) {
    if (currentFreq_ != freq) {
      tone(PIN_BUZZER, freq);
      currentFreq_ = freq;
    }
  }

  void buzzerOff_() {
    noTone(PIN_BUZZER);
    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_STATUS_LED, LOW);
    currentFreq_ = 0;
  }

  void applyPattern_() {
    if (millis() < nextTick_) return;
    switch (pattern_) {
      case ALERT_AIR_RAID:
        if (tickPhase_ == 0) { buzzerOn_(800);  nextTick_ = millis() + 400; tickPhase_ = 1; }
        else                  { buzzerOn_(1200); nextTick_ = millis() + 400; tickPhase_ = 0; }
        break;
      case ALERT_GENERAL:
        buzzerOn_(1000);
        nextTick_ = millis() + 500;
        break;
      case ALERT_PARTIAL:
        if (tickPhase_ == 0) { buzzerOn_(1000); nextTick_ = millis() + 1000; tickPhase_ = 1; }
        else                  { buzzerOff_();   nextTick_ = millis() + 2000; tickPhase_ = 0; }
        break;
      case ALERT_ALL_CLEAR:
        if (tickPhase_ == 0) { buzzerOn_(600);  nextTick_ = millis() + 3000; tickPhase_ = 1; }
        else                  { buzzerOff_();   nextTick_ = millis() + 1000; tickPhase_ = 0; }
        break;
      case ALERT_TEST:
      default:
        if (tickPhase_ == 0) { buzzerOn_(1500); nextTick_ = millis() + 300;  tickPhase_ = 1; }
        else                  { buzzerOff_();   nextTick_ = millis() + 700;  tickPhase_ = 0; }
        break;
    }
  }
};

// ============================================
//   🌐 المتغيرات العامة
// ============================================
SocketIOclient socketIO;
SoundController sound;
uint32_t lastHeartbeat = 0;

// ============================================
//   📤 إرسال JSON للسيرفر
// ============================================
void sendJson(const char* event, JsonDocument& doc) {
  String data;
  serializeJson(doc, data);
  String payload = "[\"" + String(event) + "\"," + data + "]";
  socketIO.sendEVENT(payload);
  Serial.println("[ws] sent: " + payload);
}

// ============================================
//   📥 استقبال أحداث Socket.io
// ============================================
void onSocketEvent(socketIOmessageType_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case sIOtype_CONNECT: {
      Serial.println("[ws] connected");
      socketIO.send(sIOtype_CONNECT, "/devices");
      JsonDocument hello;
      hello["type"]     = "REGISTER";
      hello["deviceId"] = DEVICE_ID;
      hello["fw"]       = FIRMWARE_VERSION;
      sendJson("message", hello);
      break;
    }

    case sIOtype_EVENT: {
      String msg = String((char*)payload, length);
      Serial.println("[ws] event: " + msg);

      int comma = msg.indexOf(',');
      if (comma < 0) break;
      String jsonPart = msg.substring(comma + 1);
      jsonPart.trim();
      if (jsonPart.endsWith("]")) jsonPart = jsonPart.substring(0, jsonPart.length() - 1);

      JsonDocument doc;
      if (deserializeJson(doc, jsonPart)) break;
      const char* t = doc["type"] | "";

      if (strcmp(t, "ALERT_START") == 0) {
        String alertType = String((const char*)(doc["alertType"] | "TEST"));
        uint16_t dur = doc["duration"] | 30;
        uint8_t  rep = doc["repeat"]   | 1;
        sound.start(SoundController::fromString(alertType), dur, rep);
        JsonDocument ack;
        ack["alertId"] = (const char*)(doc["alertId"] | "");
        ack["status"]  = "playing";
        sendJson("ack", ack);
      } else if (strcmp(t, "ALERT_STOP") == 0) {
        sound.stop();
        JsonDocument ack;
        ack["alertId"] = (const char*)(doc["alertId"] | "");
        ack["status"]  = "stopped";
        sendJson("ack", ack);
      } else if (strcmp(t, "PING") == 0) {
        JsonDocument pong;
        pong["type"]     = "PONG";
        pong["deviceId"] = DEVICE_ID;
        sendJson("message", pong);
      } else if (strcmp(t, "RESET") == 0) {
        delay(300);
        ESP.restart();
      }
      break;
    }

    case sIOtype_DISCONNECT:
      Serial.println("[ws] disconnected");
      break;

    default:
      break;
  }
}

// ============================================
//   🚀 Setup
// ============================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("\n[boot] %s fw=%s\n", DEVICE_ID, FIRMWARE_VERSION);

  sound.begin();

  // مسح الشبكات المتاحة
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  Serial.println("\n[wifi] scanning networks...");
  int n = WiFi.scanNetworks();
  if (n == 0) {
    Serial.println("[wifi] no networks found!");
  } else {
    Serial.printf("[wifi] found %d networks:\n", n);
    for (int i = 0; i < n; i++) {
      Serial.printf("  %d: \"%s\" (%d dBm) %s\n", i + 1,
        WiFi.SSID(i).c_str(), WiFi.RSSI(i),
        WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "OPEN" : "SECURED");
    }
  }
  Serial.printf("[wifi] connecting to: \"%s\"\n", WIFI_SSID);

  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[wifi] connecting");
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 30000) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[wifi] connected ip=%s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[wifi] failed — retrying in loop");
  }

  // اتصال Socket.io
  String path = String("/socket.io/?EIO=4&transport=websocket&deviceId=")
              + DEVICE_ID + "&token=" + DEVICE_TOKEN;
  socketIO.begin(SERVER_HOST, SERVER_PORT, path.c_str());
  socketIO.onEvent(onSocketEvent);
}

// ============================================
//   🔁 Loop
// ============================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[wifi] reconnecting...");
    WiFi.reconnect();
    delay(RECONNECT_DELAY_MS);
    return;
  }

  socketIO.loop();
  sound.loop();

  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = millis();
    JsonDocument hb;
    hb["deviceId"] = DEVICE_ID;
    hb["rssi"]     = WiFi.RSSI();
    hb["uptime"]   = millis() / 1000;
    hb["fw"]       = FIRMWARE_VERSION;
    sendJson("heartbeat", hb);
  }
}
