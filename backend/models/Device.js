// نموذج جهاز ESP32 | Device model
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    location: { type: String, default: '' },
    firmwareVersion: { type: String, default: '' },
    deviceToken: { type: String, required: true }, // hashed
    online: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    rssi: { type: Number, default: null },
    uptime: { type: Number, default: 0 },
    ipAddress: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
