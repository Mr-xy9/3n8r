// التحكم بمكبر الصوت | Sound controller
//
// يدعم نوعين:
//   1) Horn Speaker 12V عبر Relay (الرئيسي)
//      - الأنماط AIR_RAID/GENERAL/PARTIAL مدعومة بتشغيل/إيقاف Relay
//   2) DAC داخلي (اختياري للاختبار بدون Horn)
//
#pragma once
#include <Arduino.h>
#include "config.h"

enum AlertPattern {
  ALERT_AIR_RAID,   // صفارة متذبذبة — Relay يُشغَّل/يُوقَف بسرعة
  ALERT_GENERAL,    // صفارة ثابتة  — Relay مفتوح طوال المدة
  ALERT_PARTIAL,    // نبضات 1 ثانية كل 3 ثوان
  ALERT_ALL_CLEAR,  // نبضة واحدة طويلة 3 ثوان
  ALERT_TEST,       // نبضة قصيرة 1 ثانية
};

class SoundController {
 public:
  void begin() {
    pinMode(PIN_RELAY, OUTPUT);
    digitalWrite(PIN_RELAY, LOW);   // Relay مغلق (Horn صامت)
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("[snd] SoundController ready (Relay on GPIO " + String(PIN_RELAY) + ")");
  }

  void start(AlertPattern p, uint16_t durationSec, uint8_t repeat) {
    pattern_   = p;
    totalMs_   = (uint32_t)durationSec * 1000UL;
    repeats_   = repeat;
    startedAt_ = millis();
    playing_   = true;
    tickPhase_ = 0;
    nextTick_  = millis();
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.printf("[snd] start pattern=%d dur=%us repeat=%u\n", p, durationSec, repeat);
  }

  void stop() {
    playing_ = false;
    relayOff_();
    Serial.println("[snd] stopped");
  }

  bool isPlaying() const { return playing_; }

  // استدعاء في كل دورة loop()
  void loop() {
    if (!playing_) return;

    uint32_t elapsed = millis() - startedAt_;
    if (elapsed >= totalMs_) {
      if (--repeats_ > 0) {
        startedAt_ = millis(); // إعادة الدورة
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
    if (s == "AIR_RAID") return ALERT_AIR_RAID;
    if (s == "GENERAL")  return ALERT_GENERAL;
    if (s == "PARTIAL")  return ALERT_PARTIAL;
    if (s == "ALL_CLEAR") return ALERT_ALL_CLEAR;
    return ALERT_TEST;
  }

 private:
  AlertPattern pattern_   = ALERT_TEST;
  uint32_t     totalMs_   = 0;
  uint32_t     startedAt_ = 0;
  uint32_t     nextTick_  = 0;
  uint8_t      repeats_   = 0;
  uint8_t      tickPhase_ = 0;
  bool         playing_   = false;

  void relayOn_()  { digitalWrite(PIN_RELAY, HIGH); }
  void relayOff_() { digitalWrite(PIN_RELAY, LOW); digitalWrite(PIN_STATUS_LED, LOW); }

  // ========= أنماط الـ Relay =========
  // كل نمط يتحكم بالتوقيت وعدد النبضات
  void applyPattern_() {
    if (millis() < nextTick_) return;
    switch (pattern_) {

      case ALERT_GENERAL:
        // صافرة ثابتة — Horn يعمل طوال المدة
        relayOn_();
        nextTick_ = millis() + 500;
        break;

      case ALERT_AIR_RAID:
        // تذبذب: 0.8 ثانية تشغيل / 0.4 ثانية إيقاف
        if (tickPhase_ == 0) { relayOn_();  nextTick_ = millis() + 800; tickPhase_ = 1; }
        else                  { relayOff_(); nextTick_ = millis() + 400; tickPhase_ = 0; }
        break;

      case ALERT_PARTIAL:
        // نبضة 1 ثانية / توقف 2 ثانية
        if (tickPhase_ == 0) { relayOn_();  nextTick_ = millis() + 1000; tickPhase_ = 1; }
        else                  { relayOff_(); nextTick_ = millis() + 2000; tickPhase_ = 0; }
        break;

      case ALERT_ALL_CLEAR:
        // نبضة طويلة 3 ثوان / توقف 1 ثانية
        if (tickPhase_ == 0) { relayOn_();  nextTick_ = millis() + 3000; tickPhase_ = 1; }
        else                  { relayOff_(); nextTick_ = millis() + 1000; tickPhase_ = 0; }
        break;

      case ALERT_TEST:
      default:
        // نبضة واحدة 1 ثانية
        if (tickPhase_ == 0) { relayOn_();  nextTick_ = millis() + 1000; tickPhase_ = 1; }
        else                  { relayOff_(); nextTick_ = millis() + 500;  tickPhase_ = 0; }
        break;
    }
  }
};
