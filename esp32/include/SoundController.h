// التحكم بالـ Piezo Buzzer | Piezo Buzzer Controller
//
// يستخدم وظيفة tone() المدمجة في ESP32/Arduino لتوليد ترددات مختلفة
// تُحاكي أصوات صفّارات الإنذار الحقيقية.
//
#pragma once
#include <Arduino.h>
#include "config.h"

enum AlertPattern {
  ALERT_AIR_RAID,   // صفارة متذبذبة (تردد يصعد وينزل)
  ALERT_GENERAL,    // نغمة ثابتة
  ALERT_PARTIAL,    // نبضات متقطعة
  ALERT_ALL_CLEAR,  // نغمة هادئة طويلة
  ALERT_TEST,       // بيب قصير
};

class SoundController {
 public:
  void begin() {
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW);
    Serial.println("[snd] Piezo Buzzer ready on GPIO " + String(PIN_BUZZER));
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

  // استدعاء في كل دورة loop()
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

  // ========= أنماط البيزو =========
  void applyPattern_() {
    if (millis() < nextTick_) return;
    switch (pattern_) {

      case ALERT_AIR_RAID:
        // صفارة متذبذبة: 800Hz ↔ 1200Hz كل 0.4 ثانية (مثل صفارة الشرطة)
        if (tickPhase_ == 0) { buzzerOn_(800);  nextTick_ = millis() + 400; tickPhase_ = 1; }
        else                  { buzzerOn_(1200); nextTick_ = millis() + 400; tickPhase_ = 0; }
        break;

      case ALERT_GENERAL:
        // نغمة ثابتة 1000Hz طول المدة
        buzzerOn_(1000);
        nextTick_ = millis() + 500;
        break;

      case ALERT_PARTIAL:
        // نبضات: 1 ثانية تشغيل (1000Hz) / 2 ثانية صمت
        if (tickPhase_ == 0) { buzzerOn_(1000); nextTick_ = millis() + 1000; tickPhase_ = 1; }
        else                  { buzzerOff_();   nextTick_ = millis() + 2000; tickPhase_ = 0; }
        break;

      case ALERT_ALL_CLEAR:
        // نغمة هادئة 600Hz لمدة 3 ثوان / صمت 1 ثانية
        if (tickPhase_ == 0) { buzzerOn_(600);  nextTick_ = millis() + 3000; tickPhase_ = 1; }
        else                  { buzzerOff_();   nextTick_ = millis() + 1000; tickPhase_ = 0; }
        break;

      case ALERT_TEST:
      default:
        // بيب 1500Hz لمدة 0.3 ثانية / صمت 0.7 ثانية
        if (tickPhase_ == 0) { buzzerOn_(1500); nextTick_ = millis() + 300;  tickPhase_ = 1; }
        else                  { buzzerOff_();   nextTick_ = millis() + 700;  tickPhase_ = 0; }
        break;
    }
  }
};
