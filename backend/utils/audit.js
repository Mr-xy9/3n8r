// أداة تسجيل المراجعة | Audit helper
const AuditLog = require('../models/AuditLog');

async function audit(entry) {
  try {
    await AuditLog.create(entry);
  } catch (err) {
    // لا نُسقط الطلب إن فشل تسجيل المراجعة، فقط نسجّل في الكونسول
    console.error('[audit] failed to write:', err.message);
  }
}

module.exports = { audit };
