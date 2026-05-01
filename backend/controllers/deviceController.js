// منطق إدارة الأجهزة | Device controller
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Device = require('../models/Device');
const { audit } = require('../utils/audit');
const { getHub } = require('../services/deviceHub');

exports.listDevices = async (req, res, next) => {
  try {
    const devices = await Device.find({}).sort({ createdAt: -1 }).lean();
    // إخفاء التوكن المُجزّأ
    devices.forEach((d) => delete d.deviceToken);
    res.json({ devices });
  } catch (err) {
    next(err);
  }
};

exports.registerDevice = async (req, res, next) => {
  try {
    const { deviceId, name = '', location = '' } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    const plainToken = crypto.randomBytes(24).toString('hex');
    const deviceToken = await bcrypt.hash(plainToken, 10);
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { deviceId, name, location, deviceToken },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await audit({
      actor: req.user.username,
      actorType: 'user',
      action: 'device.register',
      resource: deviceId,
      ip: req.ip,
    });
    res.status(201).json({
      device: { id: device._id, deviceId, name, location },
      // التوكن يُعرض مرّة واحدة فقط
      deviceToken: plainToken,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    await Device.deleteOne({ deviceId });
    getHub().disconnect(deviceId);
    await audit({
      actor: req.user.username,
      actorType: 'user',
      action: 'device.delete',
      resource: deviceId,
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.pingDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const ok = getHub().sendTo(deviceId, { type: 'PING' });
    res.json({ ok });
  } catch (err) {
    next(err);
  }
};

exports.resetDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const ok = getHub().sendTo(deviceId, { type: 'RESET' });
    await audit({
      actor: req.user.username,
      actorType: 'user',
      action: 'device.reset',
      resource: deviceId,
      ip: req.ip,
    });
    res.json({ ok });
  } catch (err) {
    next(err);
  }
};
