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
  await mongoose.connect(config.mongoUri);
  console.log('[db] connected');

  // إنشاء مستخدم admin افتراضي إذا لم يوجد
  const exists = await User.findOne({ role: 'admin' });
  if (!exists) {
    const passwordHash = await User.hashPassword(
      process.env.ADMIN_DEFAULT_PASSWORD || 'admin123'
    );
    await User.create({
      username: 'admin',
      passwordHash,
      role: 'admin',
      fullName: 'System Administrator',
    });
    console.log('[db] default admin created — change password immediately');
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
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
