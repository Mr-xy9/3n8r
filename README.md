# 🛡️ نظام تنبيهات مدنية | ESP32 Civil Defense Alert System

نظام كامل (ويب + خادم + جهاز ESP32) للتحكم بمكبرات الصوت في المساجد
والأماكن العامة لإطلاق صفّارات الإنذار عند الطوارئ.

A full-stack civil-defense alert system: web dashboard, Node.js backend
with realtime WebSocket control, and ESP32 firmware that drives mosque
loudspeakers.

## البنية | Layout

```
backend/    Node.js + Express + Socket.io + MongoDB
frontend/   لوحة تحكم HTML/CSS/JS (RTL، responsive)
esp32/      Firmware (PlatformIO/Arduino)
docs/       التوثيق المعماري
```

## التشغيل السريع | Quick start

### 1) الخادم
```bash
cd backend
cp .env.example .env   # عدّل القيم
npm install
npm start
```
- الافتراضي يفتح المنفذ 3000 ويُنشئ مستخدم `admin` بكلمة مرور `admin123`
  (غيّرها فوراً عبر `ADMIN_DEFAULT_PASSWORD`).

### 2) الواجهة
افتح `http://localhost:3000/index.html`.

### 3) ESP32
- سجّل الجهاز من لوحة التحكم → احصل على `deviceToken` (يُعرض مرّة واحدة).
- حدّث `esp32/platformio.ini` بقيم `DEVICE_ID` / `DEVICE_TOKEN` /
  `SERVER_HOST` ثم: `pio run -t upload`.

## أنواع التنبيهات
`AIR_RAID`, `GENERAL`, `PARTIAL`, `ALL_CLEAR`, `TEST`, `CUSTOM`.

## الأمان
- JWT + bcrypt + helmet + rate-limit.
- لكل ESP32 توكن مستقل (مُجزّأ في DB).
- صلاحيات: `admin`, `operator`, `viewer`.
- سجل مراجعة كامل (Audit Log).

اقرأ `docs/ARCHITECTURE.md` للتفاصيل الكاملة.
