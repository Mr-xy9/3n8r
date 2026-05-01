// إعادة تعيين كلمة مرور admin | Reset admin password
// التشغيل:  node scripts/reset-admin.js [newPassword]
const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');

(async () => {
  const newPassword = process.argv[2] || 'admin123';
  await mongoose.connect(config.mongoUri);
  const passwordHash = await User.hashPassword(newPassword);
  const user = await User.findOneAndUpdate(
    { username: 'admin' },
    { username: 'admin', passwordHash, role: 'admin', active: true, fullName: 'System Administrator' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log('\n========================================');
  console.log(' ✅ تم تعيين كلمة المرور بنجاح');
  console.log('----------------------------------------');
  console.log(`  username: ${user.username}`);
  console.log(`  password: ${newPassword}`);
  console.log('========================================\n');
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('❌ فشل:', err.message);
  process.exit(1);
});
