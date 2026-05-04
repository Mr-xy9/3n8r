// برنامج جهاز ESP32 | ESP32 firmware
#include <Arduino.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include <SocketIOclient.h>
#include "config.h"
#include "SoundController.h"

SocketIOclient socketIO;
SoundController sound;

uint32_t lastHeartbeat = 0;

void sendJson(const char* event, JsonDocument& doc) {
  String data;
  serializeJson(doc, data);
  String payload = "[\"" + String(event) + "\"," + data + "]";
  socketIO.sendEVENT(payload);
  Serial.println("[ws] sent: " + payload);
}

void onSocketEvent(socketIOmessageType_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case sIOtype_CONNECT:
      Serial.println("[ws] connected");
      // Server uses root namespace for devices — no manual namespace join
      {
        JsonDocument hello;
        hello["type"]     = "REGISTER";
        hello["deviceId"] = DEVICE_ID;
        hello["fw"]       = FIRMWARE_VERSION;
        sendJson("message", hello);
      }
      break;

    case sIOtype_EVENT: {
      String msg = String((char*)payload, length);
      Serial.println("[ws] event: " + msg);

      // استخراج اسم الحدث والبيانات من ["event", {...}]
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

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("\n[boot] %s fw=%s\n", DEVICE_ID, FIRMWARE_VERSION);

  sound.begin();

  // اتصال WiFi
  WiFi.mode(WIFI_STA);
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
  String auth = String("?deviceId=") + DEVICE_ID + "&token=" + DEVICE_TOKEN;
  socketIO.begin(SERVER_HOST, SERVER_PORT, ("/socket.io/?EIO=4&transport=websocket" + auth).c_str());
  socketIO.onEvent(onSocketEvent);
}

void loop() {
  // إعادة اتصال WiFi إذا انقطع
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[wifi] reconnecting...");
    WiFi.reconnect();
    delay(RECONNECT_DELAY_MS);
    return;
  }

  socketIO.loop();
  sound.loop();

  // Heartbeat كل 10 ثوان
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
