# Civil Alert ESP32 — Arduino IDE

نسخة جاهزة للتشغيل المباشر على Arduino IDE.

---

## 🚀 خطوات سريعة

### 1. حمّل المشروع من GitHub

**الطريقة A — Download ZIP:**
- اضغط `<> Code` ← `Download ZIP`
- فك الضغط

**الطريقة B — Git Clone:**
```bash
git clone <repo-url>
```

---

### 2. ثبّت Arduino IDE
https://www.arduino.cc/en/software

---

### 3. أضف دعم ESP32

في Arduino IDE:
- `File → Preferences`
- في `Additional boards manager URLs` ضع:
  ```
  https://espressif.github.io/arduino-esp32/package_esp32_index.json
  ```
- `Tools → Board → Boards Manager` → ابحث `esp32` → Install

---

### 4. ثبّت المكتبات

`Tools → Manage Libraries` → ابحث وثبّت:
- **ArduinoJson** (by Benoit Blanchon)
- **WebSockets** (by Markus Sattler / links2004)

---

### 5. افتح الملف

`File → Open` → اختر:
```
arduino/civil_alert_esp32/civil_alert_esp32.ino
```

---

### 6. عدّل الإعدادات

في أعلى الملف عدّل:
```cpp
#define WIFI_SSID       "اسم-الواي-فاي"
#define WIFI_PASSWORD   "كلمة-المرور"
#define SERVER_HOST     "IP-السيرفر"
```

---

### 7. ارفع الكود

- `Tools → Board → ESP32 Dev Module`
- `Tools → Port → COMx`
- اضغط زر **Upload** (←)

---

## 🔌 التوصيل

```
Piezo Buzzer (+) ──► GPIO 25
Piezo Buzzer (−) ──► GND
```

---

## 🎵 أنماط الإنذار

| النوع | الصوت |
|---|---|
| AIR_RAID | صفارة شرطة (متذبذبة) |
| GENERAL | نغمة مستمرة |
| PARTIAL | نبضات متقطعة |
| ALL_CLEAR | نغمة هادئة |
| TEST | بيب قصير |
