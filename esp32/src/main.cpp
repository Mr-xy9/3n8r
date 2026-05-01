// برنامج جهاز ESP32 | ESP32 main firmware
// يتصل بالواي-فاي ثم بالخادم عبر Socket.io ويستقبل أوامر الإنذار.
//
// اعتمادات (PlatformIO):
//   lib_deps =
//     links2004/WebSockets@^2.4.1
//     bblanchon/ArduinoJson@^7.1.0
//     gilmaimon/ArduinoWebsockets@^0.5.4
//
#include <Arduino.h>
#include <ArduinoJson.h>
#include <SocketIoClient.h>   // أو WebSocketsClient — حسب توفّر المكتبة
#include "config.h"
#include "WiFiManager.h"
#include "SoundController.h"

WiFiManager wifi;
SoundController sound;
SocketIoClient socketIO;

uint32_t lastHeartbeat = 0;
String currentAlertId = "";

void sendJson(const char* event, const JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  String payload = String("\"") + event + "\"," + out;
  socketIO.emit(event, out.c_str());
}

void onCommand(const char* payload, size_t length) {
  Serial.printf("[ws] command: %.*s\n", (int)length, payload);
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;
  const char* type = doc["type"] | "";

  if (strcmp(type, "ALERT_START") == 0) {
    currentAlertId = String((const char*)(doc["alertId"] | ""));
    String t = String((const char*)(doc["alertType"] | "TEST"));
    uint16_t dur = doc["duration"] | 30;
    uint8_t rep = doc["repeat"] | 1;
    sound.start(SoundController::fromString(t), dur, rep);

    JsonDocument ack;
    ack["alertId"] = currentAlertId;
    ack["status"] = "playing";
    sendJson("ack", ack);
  } else if (strcmp(type, "ALERT_STOP") == 0) {
    sound.stop();
    JsonDocument ack;
    ack["alertId"] = (const char*)(doc["alertId"] | "");
    ack["status"] = "stopped";
    sendJson("ack", ack);
  } else if (strcmp(type, "PING") == 0) {
    JsonDocument pong;
    pong["type"] = "PONG";
    pong["deviceId"] = DEVICE_ID;
    sendJson("message", pong);
  } else if (strcmp(type, "RESET") == 0) {
    Serial.println("[sys] reset requested");
    delay(500);
    ESP.restart();
  }
}

void onConnect(const char* payload, size_t length) {
  Serial.println("[ws] connected to /devices");
  JsonDocument hello;
  hello["type"] = "REGISTER";
  hello["deviceId"] = DEVICE_ID;
  hello["fw"] = FIRMWARE_VERSION;
  sendJson("message", hello);
}

void sendHeartbeat() {
  JsonDocument hb;
  hb["deviceId"] = DEVICE_ID;
  hb["rssi"] = wifi.rssi();
  hb["uptime"] = millis() / 1000;
  hb["fw"] = FIRMWARE_VERSION;
  sendJson("heartbeat", hb);
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.printf("\n[boot] %s fw=%s\n", DEVICE_ID, FIRMWARE_VERSION);

  sound.begin();
  wifi.begin();

  // مصادقة عبر query string لمكتبة Socket.io
  // namespace=/devices, auth=deviceId+token
  String path = String("/socket.io/?EIO=4&transport=websocket&deviceId=")
              + DEVICE_ID + "&token=" + DEVICE_TOKEN;
#if USE_TLS
  socketIO.beginSSL(SERVER_HOST, SERVER_PORT, path.c_str());
#else
  socketIO.begin(SERVER_HOST, SERVER_PORT, path.c_str());
#endif
  socketIO.on("connect", onConnect);
  socketIO.on("command", onCommand);
}

void loop() {
  if (!wifi.ensureConnected()) {
    delay(RECONNECT_DELAY_MS);
    return;
  }
  socketIO.loop();
  sound.loop();

  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = millis();
    sendHeartbeat();
  }
}
