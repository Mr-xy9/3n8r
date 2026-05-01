# هيكل نظام تنبيهات الحرب — Architecture

## نظرة عامة | Overview

نظام تنبيهات مدني (Civil Defense Alert System) للتحكم بمكبرات الصوت
المرتبطة بـ ESP32 في المساجد والأماكن العامة لتحذير المدنيين من
الأخطار (غارات، حرائق، كوارث طبيعية).

A civil-defense alert system that controls ESP32-driven loudspeakers in
mosques and public spaces to warn civilians of imminent dangers (air
raids, fires, natural disasters).

## الطبقات | Layers

### 1) الواجهة الأمامية | Frontend
- HTML/CSS/JS حديث — يعمل في المتصفح وعلى الجوال (Responsive).
- يتصل بالـ Backend عبر REST + Socket.io.
- يدعم تسجيل الدخول، لوحة تحكم، إدارة الأجهزة، السجل.

### 2) الخادم الخلفي | Backend
- Node.js + Express.js + Socket.io.
- MongoDB لتخزين المستخدمين، الأجهزة، التنبيهات، السجل.
- JWT للمصادقة، bcrypt للتشفير، helmet/cors للأمان.
- MQTT broker (اختياري) للاتصال منخفض الكمون مع ESP32.

### 3) العتاد | ESP32
- يتصل بالواي-فاي ويفتح اتصال WebSocket/MQTT دائم مع الخادم.
- يستقبل أوامر التشغيل ويُفعّل DAC/مضخم صوت لإطلاق الصافرة.
- يرسل heartbeat كل 10 ثوانٍ لإثبات الاتصال.

## بروتوكول الرسائل | Message Protocol

```jsonc
// خادم → جهاز
{ "type": "ALERT_START", "alertId": "...", "alertType": "AIR_RAID",
  "duration": 30, "audioUrl": "https://..." }
{ "type": "ALERT_STOP", "alertId": "..." }
{ "type": "PING" }
{ "type": "RESET" }

// جهاز → خادم
{ "type": "REGISTER", "deviceId": "esp32-001", "fw": "1.0.0" }
{ "type": "HEARTBEAT", "deviceId": "...", "rssi": -55, "uptime": 1234 }
{ "type": "ALERT_ACK", "alertId": "...", "status": "playing|stopped|error" }
{ "type": "PONG" }
```

## أنواع التنبيهات | Alert Types

| النوع | الكود | الصوت |
|-------|-------|-------|
| إنذار غارة جوية | AIR_RAID | صفارة متذبذبة |
| إنذار عام | GENERAL | صفارة ثابتة |
| إنذار جزئي | PARTIAL | نبضات قصيرة |
| انتهاء الإنذار | ALL_CLEAR | نغمة طويلة |
| اختبار | TEST | نغمة قصيرة |

## الأمان | Security

- HTTPS فقط في الإنتاج.
- JWT بصلاحية قصيرة + refresh token.
- صلاحيات: `admin`, `operator`, `viewer`.
- كل ESP32 يحمل توكن مخصص (Device Token) يُحقّق منه عند الاتصال.
- Rate limiting على نقاط الإطلاق.
- تسجيل (Audit Log) لكل عملية حساسة.

## مراحل التطوير | Phases

1. **Backend + DB** ✅
2. **Frontend Dashboard** ✅
3. **ESP32 Firmware** ✅
4. **Integration Testing** 🔧
5. **Hardening + Docs** 🔧
