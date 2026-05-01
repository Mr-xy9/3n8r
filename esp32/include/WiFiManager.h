// إدارة الواي-فاي | WiFi manager
#pragma once
#include <WiFi.h>
#include "config.h"

class WiFiManager {
 public:
  void begin() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.print("[wifi] connecting");
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
      delay(500);
      Serial.print('.');
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("\n[wifi] connected, ip=%s rssi=%d\n",
                    WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
      Serial.println("\n[wifi] failed — will retry in loop");
    }
  }

  bool ensureConnected() {
    if (WiFi.status() == WL_CONNECTED) return true;
    Serial.println("[wifi] reconnecting...");
    WiFi.reconnect();
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) delay(200);
    return WiFi.status() == WL_CONNECTED;
  }

  int rssi() const { return WiFi.RSSI(); }
  String ip() const { return WiFi.localIP().toString(); }
};
