// نقطة دخول الخادم | Server entry point
const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const deviceHub = require('./services/deviceHub');
const dashboardHub = require('./services/dashboardHub');
const User = require('./models/User');

async function bootstrap() {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[db] connected to', config.mongoUri);
  } catch (err) {
    console.error('\n❌ فشل الاتصال بـ MongoDB:', err.message);
    console.error('   تأكد أن MongoDB يعمل على', config.mongoUri);
    console.error('   على Windows: شغّل MongoDB من Services أو "mongod"');
    console.error('   أو استخدم MongoDB Atlas وضع الرابط في .env\n');
    process.exit(1);
  }

  // إنشاء مستخدم admin افتراضي إذا لم يوجد + طباعة بيانات الدخول
  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
  const exists = await User.findOne({ username: 'admin' });
  if (!exists) {
    const passwordHash = await User.hashPassword(defaultPassword);
    await User.create({
      username: 'admin',
      passwordHash,
      role: 'admin',
      fullName: 'System Administrator',
    });
  }
  console.log('\n========================================');
  console.log(' 🔐 بيانات الدخول الافتراضية');
  console.log('----------------------------------------');
  console.log('  username: admin');
  console.log(`  password: ${exists ? '(لم تتغيّر)' : defaultPassword}`);
  console.log('  لإعادة الضبط: node scripts/reset-admin.js كلمة-جديدة');
  console.log('========================================\n');

  const app = express();
  app.set('trust proxy', 1);
  // helmet مع CSP يسمح بـ Socket.io + Leaflet من CDN
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.socket.io', 'https://unpkg.com'],
        styleSrc:  ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        imgSrc:    ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
        connectSrc:["'self'", 'ws:', 'wss:', 'https://overpass-api.de'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({ origin: config.cors.origin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan('combined'));

  app.use('/uploads', express.static(path.resolve(config.uploads.dir)));
  app.use('/api', routes);

  // ملفات الواجهة الأمامية الثابتة
  app.use(express.static(path.resolve(__dirname, '../frontend')));

  app.use(notFound);
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.cors.origin, credentials: true },
  });
  deviceHub.init(io);
  dashboardHub.init(io);

  server.listen(config.port, () => {
    console.log(`[http] listening on :${config.port}`);
  });

  // إيقاف نظيف
  const shutdown = async (sig) => {
    console.log(`[sys] received ${sig}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
