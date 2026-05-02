// نموذج المسجد | Mosque model
const mongoose = require('mongoose');

const mosqueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    nameAr: { type: String, default: '' },
    address: { type: String, default: '' },
    district: { type: String, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    deviceId: { type: String, default: null }, // ربط بجهاز ESP32
    active: { type: Boolean, default: true },
    osmId: { type: String, default: null },    // معرّف OpenStreetMap
  },
  { timestamps: true }
);

mosqueSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model('Mosque', mosqueSchema);
