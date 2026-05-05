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
cp .env.example .env       # عدّل القيم حسب بيئتك
npm install
npm start
```
- الافتراضي يفتح المنفذ 3000 ويُنشئ مستخدم `admin` بكلمة مرور `admin123`
  (غيّرها فوراً عبر `ADMIN_DEFAULT_PASSWORD`).
- يجب أن يكون **MongoDB** يعمل محلياً (أو ضع رابط Atlas في `MONGO_URI`).

### 2) الواجهة
افتح `http://localhost:3000/index.html` ثم سجّل الدخول
(`admin` / `admin123`).

### 3) ESP32
- سجّل الجهاز من تبويب «الأجهزة» في لوحة التحكم → ستظهر قيمة `deviceToken`
  مرة واحدة فقط، انسخها فوراً.
- حدّث `esp32/platformio.ini` بقيم `DEVICE_ID` / `DEVICE_TOKEN` /
  `SERVER_HOST` (عنوان IP المحلي للخادم وليس `localhost`)، ثم:
  ```bash
  pio run -t upload && pio device monitor
  ```
- بدون PlatformIO يمكن استخدام `arduino/civil_alert_esp32/civil_alert_esp32.ino`
  بعد تعديل ثوابت الشبكة وقيم `DEVICE_ID` / `DEVICE_TOKEN` في أعلى الملف.

## استكشاف الأعطال | Troubleshooting

- **ESP يدخل في حلقة connect/disconnect**:
  - تأكّد أن الجهاز والخادم على نفس الشبكة (LAN).
  - استخدم عنوان IP حقيقي (`192.168.x.x` أو `172.20.10.x` لنقطة اتصال iPhone)،
    لا تستخدم `localhost` في الـ firmware.
  - تم إصلاح بناء URL لـ Socket.IO (كانت توجد علامة `?` مكررة سابقاً تمنع
    وصول `deviceId`/`token` إلى الخادم).
  - مكتبة `links2004/WebSockets` رُفعت إلى `^2.6.1` للتوافق الكامل مع
    Socket.IO v4 (EIO=4).
  - ضُبطت مهل ping على الخادم: `pingInterval=25s`, `pingTimeout=60s`
    لتحمّل شبكات الـ NAT والاتصالات الضعيفة.

- **«تعذّر الاتصال بالخادم» في الواجهة**:
  - تأكّد أن خدمة Node.js تعمل وأن MongoDB متّصل.
  - اضبط `CORS_ORIGIN=*` في `.env` أثناء التطوير.

- **MongoDB لا يعمل**:
  - Linux/macOS: `sudo systemctl start mongod` أو `brew services start mongodb-community`.
  - Windows: شغّل خدمة MongoDB من Services أو `mongod` يدوياً.
  - أو استخدم MongoDB Atlas وضع رابط الاتصال في `MONGO_URI`.

## أنواع التنبيهات
`AIR_RAID`, `GENERAL`, `PARTIAL`, `ALL_CLEAR`, `TEST`, `CUSTOM`.

## الأمان
- JWT + bcrypt + helmet + rate-limit.
- لكل ESP32 توكن مستقل (مُجزّأ في DB).
- صلاحيات: `admin`, `operator`, `viewer`.
- سجل مراجعة كامل (Audit Log).

اقرأ `docs/ARCHITECTURE.md` للتفاصيل الكاملة.
