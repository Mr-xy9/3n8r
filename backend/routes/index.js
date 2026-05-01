// تجميع المسارات | Route aggregator
const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireRole } = require('../middleware/auth');
const auth = require('../controllers/authController');
const devices = require('../controllers/deviceController');
const alerts = require('../controllers/alertController');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const triggerLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

// Auth
router.post('/auth/login', loginLimiter, auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.post('/auth/users', requireAuth, requireRole('admin'), auth.createUser);
router.get('/auth/users', requireAuth, requireRole('admin'), auth.listUsers);

// Devices
router.get('/devices', requireAuth, devices.listDevices);
router.post('/devices', requireAuth, requireRole('admin'), devices.registerDevice);
router.delete('/devices/:deviceId', requireAuth, requireRole('admin'), devices.deleteDevice);
router.post('/devices/:deviceId/ping', requireAuth, requireRole('admin', 'operator'), devices.pingDevice);
router.post('/devices/:deviceId/reset', requireAuth, requireRole('admin'), devices.resetDevice);

// Alerts
router.get('/alerts', requireAuth, alerts.listAlerts);
router.get('/alerts/stats', requireAuth, alerts.stats);
router.get('/alerts/:alertId', requireAuth, alerts.getAlert);
router.post(
  '/alerts/trigger',
  requireAuth,
  requireRole('admin', 'operator'),
  triggerLimiter,
  alerts.triggerAlert
);
router.post(
  '/alerts/:alertId/stop',
  requireAuth,
  requireRole('admin', 'operator'),
  alerts.stopAlert
);

// Audit log
router.get('/audit', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

// Government API integration webhook (incoming)
// ربط مع الأنظمة الحكومية: تستقبل تنبيه موقّع وتطلقه على الأجهزة.
router.post('/integrations/gov/alert', requireAuth, requireRole('admin'), alerts.triggerAlert);

router.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

module.exports = router;
