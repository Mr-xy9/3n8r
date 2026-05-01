// إعدادات الخادم | Server configuration
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/alert_system',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  device: {
    // توكن مشترك لتسجيل أجهزة ESP32 الجديدة
    enrollmentToken: process.env.DEVICE_ENROLL_TOKEN || 'enroll-secret',
    heartbeatTimeoutMs: 30_000,
  },
  uploads: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxBytes: 10 * 1024 * 1024,
  },
  cors: {
    origin: (process.env.CORS_ORIGIN || '*').split(','),
  },
};
