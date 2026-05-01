// منطق التنبيهات | Alert controller
const { v4: uuid } = require('uuid');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const { audit } = require('../utils/audit');
const { getHub } = require('../services/deviceHub');

exports.triggerAlert = async (req, res, next) => {
  try {
    const {
      type,
      title = '',
      message = '',
      audioUrl = '',
      duration = 30,
      repeat = 1,
      targetDevices = [],
    } = req.body || {};

    if (!Alert.ALERT_TYPES.includes(type)) {
      return res.status(400).json({ error: 'invalid alert type' });
    }

    const alert = await Alert.create({
      alertId: uuid(),
      type,
      title,
      message,
      audioUrl,
      duration,
      repeat,
      targetDevices,
      status: 'active',
      triggeredBy: req.user._id,
      triggeredAt: new Date(),
    });

    // تحديد الأجهزة المستهدفة (فارغ = البث للجميع)
    const filter = targetDevices.length
      ? { deviceId: { $in: targetDevices }, enabled: true }
      : { enabled: true };
    const devices = await Device.find(filter).select('deviceId');

    const payload = {
      type: 'ALERT_START',
      alertId: alert.alertId,
      alertType: alert.type,
      duration: alert.duration,
      repeat: alert.repeat,
      audioUrl: alert.audioUrl,
      message: alert.message,
    };

    const hub = getHub();
    let dispatched = 0;
    for (const d of devices) {
      if (hub.sendTo(d.deviceId, payload)) dispatched += 1;
    }

    await audit({
      actor: req.user.username,
      actorType: 'user',
      action: 'alert.trigger',
      resource: alert.alertId,
      details: { type, dispatched, total: devices.length },
      ip: req.ip,
    });

    res.status(201).json({ alert, dispatched, total: devices.length });
  } catch (err) {
    next(err);
  }
};

exports.stopAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const alert = await Alert.findOne({ alertId });
    if (!alert) return res.status(404).json({ error: 'alert not found' });
    alert.status = 'cancelled';
    alert.completedAt = new Date();
    await alert.save();

    const targets = alert.targetDevices.length
      ? alert.targetDevices
      : (await Device.find({ enabled: true }).select('deviceId')).map((d) => d.deviceId);

    const hub = getHub();
    for (const id of targets) {
      hub.sendTo(id, { type: 'ALERT_STOP', alertId });
    }

    await audit({
      actor: req.user.username,
      actorType: 'user',
      action: 'alert.stop',
      resource: alertId,
      ip: req.ip,
    });
    res.json({ alert });
  } catch (err) {
    next(err);
  }
};

exports.listAlerts = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const alerts = await Alert.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('triggeredBy', 'username fullName');
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
};

exports.getAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findOne({ alertId: req.params.alertId }).populate(
      'triggeredBy',
      'username fullName'
    );
    if (!alert) return res.status(404).json({ error: 'not found' });
    res.json({ alert });
  } catch (err) {
    next(err);
  }
};

exports.stats = async (req, res, next) => {
  try {
    const total = await Alert.countDocuments({});
    const byType = await Alert.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const byStatus = await Alert.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const last24h = await Alert.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 86400000) },
    });
    const onlineDevices = await Device.countDocuments({ online: true });
    const totalDevices = await Device.countDocuments({});
    res.json({ total, last24h, byType, byStatus, onlineDevices, totalDevices });
  } catch (err) {
    next(err);
  }
};
