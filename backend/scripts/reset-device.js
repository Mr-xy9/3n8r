// حذف جهاز من قاعدة البيانات | Reset/delete a device
// الاستخدام:  node scripts/reset-device.js [deviceId]
//   مثال:    node scripts/reset-device.js esp32-001
//
// السبب: عند تغيير الـ DEVICE_TOKEN في firmware الـ ESP32،
//        يجب حذف السجل القديم حتى يُعاد التسجيل التلقائي بالـ token الجديد.
const mongoose = require('mongoose');
const config = require('../config');
const Device = require('../models/Device');

(async () => {
  const deviceId = process.argv[2] || 'esp32-001';
  await mongoose.connect(config.mongoUri);
  const result = await Device.deleteOne({ deviceId });
  console.log('\n========================================');
  if (result.deletedCount > 0) {
    console.log(` ✅ تم حذف الجهاز: ${deviceId}`);
    console.log('   سيُسجَّل تلقائياً عند أول اتصال جديد');
  } else {
    console.log(` ℹ️  الجهاز غير موجود: ${deviceId}`);
  }
  console.log('========================================\n');
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
