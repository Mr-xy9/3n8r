// إعدادات الجهاز | Device configuration
#pragma once

// شبكة الواي-فاي | WiFi (override via build_flags)
#ifndef WIFI_SSID
#define WIFI_SSID       "your-ssid"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD   "your-password"
#endif

// عنوان الخادم | Server endpoint
#ifndef SERVER_HOST
#define SERVER_HOST     "192.168.1.10"
#endif
#ifndef SERVER_PORT
#define SERVER_PORT     3000
#endif
#ifndef USE_TLS
#define USE_TLS         0   // 1 = wss/https في الإنتاج
#endif

// هويّة الجهاز | Device identity
#ifndef DEVICE_ID
#define DEVICE_ID       "esp32-001"
#endif
#ifndef DEVICE_TOKEN
#define DEVICE_TOKEN    "set-during-provisioning"
#endif

#define FIRMWARE_VERSION "1.1.0"

// ====== منافذ GPIO | GPIO Pins ======
//
// مكبر الصوت 12V (Horn Speaker)
// يُتحكّم فيه عبر Relay Module 5V:
//   ESP32 GPIO 27 → IN (مدخل الرّيلي)
//   Relay COM ← + مصدر 12V
//   Relay NO  → + المكبّر (Horn)
//   المكبّر - → GND مصدر 12V
//
#define PIN_RELAY        27   // تحكم بالرّيلي → Horn Speaker 12V
#define PIN_STATUS_LED   2    // مؤشر LED داخلي
//
// (اختياري) DAC للنغمات الرقمية المضافة مستقبلاً
#define PIN_DAC          25
#define PIN_AMP_ENABLE   26

// التوقيتات | Timings (ms)
#define HEARTBEAT_INTERVAL_MS  10000
#define RECONNECT_DELAY_MS     5000
