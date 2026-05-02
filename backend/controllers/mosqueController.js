// منطق إدارة المساجد | Mosque controller
const Mosque = require('../models/Mosque');
const { audit } = require('../utils/audit');

exports.list = async (req, res, next) => {
  try {
    const mosques = await Mosque.find({ active: true }).sort({ name: 1 });
    res.json({ mosques });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, nameAr = '', address = '', district = '', lat, lng, deviceId = null } = req.body || {};
    if (!name || lat == null || lng == null) {
      return res.status(400).json({ error: 'name, lat, lng required' });
    }
    const mosque = await Mosque.create({ name, nameAr, address, district, lat, lng, deviceId });
    await audit({
      actor: req.user.username, actorType: 'user',
      action: 'mosque.create', resource: mosque._id.toString(), ip: req.ip,
    });
    res.status(201).json({ mosque });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const mosque = await Mosque.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!mosque) return res.status(404).json({ error: 'not found' });
    await audit({
      actor: req.user.username, actorType: 'user',
      action: 'mosque.update', resource: req.params.id, ip: req.ip,
    });
    res.json({ mosque });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Mosque.findByIdAndUpdate(req.params.id, { active: false });
    await audit({
      actor: req.user.username, actorType: 'user',
      action: 'mosque.delete', resource: req.params.id, ip: req.ip,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
};
