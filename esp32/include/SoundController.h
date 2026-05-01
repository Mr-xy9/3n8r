// التحكم بمكبر الصوت | Sound controller
// يولّد نغمات الصافرة عبر DAC الداخلي للـ ESP32 ويفعّل المضخّم.
// يمكن استبدال هذا لاحقاً بمكتبة I2S لقراءة ملفات MP3/WAV من الإنترنت.
#pragma once
#include <Arduino.h>
#include "config.h"

enum AlertPattern {
  ALERT_AIR_RAID,    // صفارة متذبذبة (warble)
  ALERT_GENERAL,     // صفارة ثابتة
  ALERT_PARTIAL,     // نبضات قصيرة
  ALERT_ALL_CLEAR,   // نغمة طويلة
  ALERT_TEST,        // نغمة قصيرة
};

class SoundController {
 public:
  void begin() {
    pinMode(PIN_AMP_ENABLE, OUTPUT);
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_AMP_ENABLE, LOW);
    digitalWrite(PIN_STATUS_LED, LOW);
  }

  void start(AlertPattern p, uint16_t durationSec, uint8_t repeat) {
    pattern_ = p;
    endAt_ = millis() + (uint32_t)durationSec * 1000UL;
    repeats_ = repeat;
    playing_ = true;
    digitalWrite(PIN_AMP_ENABLE, HIGH);
    digitalWrite(PIN_STATUS_LED, HIGH);
    Serial.printf("[snd] start pattern=%d dur=%us\n", p, durationSec);
  }

  void stop() {
    playing_ = false;
    digitalWrite(PIN_AMP_ENABLE, LOW);
    digitalWrite(PIN_STATUS_LED, LOW);
    dacWrite(PIN_DAC, 0);
    Serial.println("[snd] stop");
  }

  bool isPlaying() const { return playing_; }

  void loop() {
    if (!playing_) return;
    if ((int32_t)(millis() - endAt_) >= 0) {
      if (--repeats_ > 0) {
        endAt_ = millis() + 5000;  // فاصل 5 ثوانٍ ثم إعادة
      } else {
        stop();
        return;
      }
    }
    tick_();
  }

  static AlertPattern fromString(const String& s) {
    if (s == "AIR_RAID") return ALERT_AIR_RAID;
    if (s == "GENERAL") return ALERT_GENERAL;
    if (s == "PARTIAL") return ALERT_PARTIAL;
    if (s == "ALL_CLEAR") return ALERT_ALL_CLEAR;
    return ALERT_TEST;
  }

 private:
  AlertPattern pattern_ = ALERT_TEST;
  uint32_t endAt_ = 0;
  uint8_t repeats_ = 0;
  bool playing_ = false;

  // توليد إشارة جيبية تقريبية عبر DAC بزاوية تتغير مع الزمن
  void tick_() {
    uint32_t t = millis();
    uint16_t freq = 600;
    switch (pattern_) {
      case ALERT_AIR_RAID:
        // تذبذب 400-1200Hz كل ثانيتين
        freq = 800 + 400 * sinf((t % 4000) * (2 * PI / 4000.0f));
        break;
      case ALERT_GENERAL:    freq = 1000; break;
      case ALERT_PARTIAL:    freq = (t / 250) % 2 ? 800 : 0; break;
      case ALERT_ALL_CLEAR:  freq = 600; break;
      case ALERT_TEST:       freq = 440; break;
    }
    if (freq == 0) { dacWrite(PIN_DAC, 0); return; }
    float phase = (t * freq) / 1000.0f;
    uint8_t sample = 128 + 110 * sinf(phase * 2 * PI);
    dacWrite(PIN_DAC, sample);
  }
};
