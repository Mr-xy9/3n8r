// نموذج التنبيه | Alert model
const mongoose = require('mongoose');

const ALERT_TYPES = ['AIR_RAID', 'GENERAL', 'PARTIAL', 'ALL_CLEAR', 'TEST', 'CUSTOM'];

const alertSchema = new mongoose.Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ALERT_TYPES, required: true },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    audioUrl: { type: String, default: '' },
    duration: { type: Number, default: 30 }, // seconds
    repeat: { type: Number, default: 1 },
    targetDevices: [{ type: String }], // deviceIds, empty = broadcast
    scheduledFor: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    triggeredAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    deviceAcks: [
      {
        deviceId: String,
        status: String,
        at: Date,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
module.exports.ALERT_TYPES = ALERT_TYPES;
