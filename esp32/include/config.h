// إعدادات الجهاز | Device configuration
#pragma once

// شبكة الواي-فاي | WiFi (override at flash time)
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
#define USE_TLS         0          // 1 = wss/https في الإنتاج
#endif

// هويّة الجهاز | Device identity
#ifndef DEVICE_ID
#define DEVICE_ID       "esp32-001"
#endif
#ifndef DEVICE_TOKEN
#define DEVICE_TOKEN    "set-during-provisioning"
#endif

#define FIRMWARE_VERSION "1.0.0"

// منافذ الصوت | Audio pins
#define PIN_DAC          25       // مخرج DAC داخلي
#define PIN_AMP_ENABLE   26       // تفعيل المضخّم
#define PIN_STATUS_LED   2

// التوقيتات | Timings (ms)
#define HEARTBEAT_INTERVAL_MS  10000
#define RECONNECT_DELAY_MS     5000
