// سجل العمليات | Audit log model
const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema(
  {
    actor: { type: String, default: 'system' }, // username or deviceId
    actorType: { type: String, enum: ['user', 'device', 'system'], default: 'system' },
    action: { type: String, required: true },
    resource: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    success: { type: Boolean, default: true },
  },
  { timestamps: true }
);

auditSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditSchema);
