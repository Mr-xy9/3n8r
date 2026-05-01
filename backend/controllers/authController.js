// منطق المصادقة | Auth controller
const User = require('../models/User');
const { signAccessToken, signRefreshToken } = require('../middleware/auth');
const { audit } = require('../utils/audit');

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }
    const user = await User.findOne({ username });
    const ok = user && user.active && (await user.verifyPassword(password));
    if (!ok) {
      await audit({
        actor: username,
        actorType: 'user',
        action: 'login',
        success: false,
        ip: req.ip,
      });
      return res.status(401).json({ error: 'invalid credentials' });
    }
    user.lastLoginAt = new Date();
    await user.save();
    await audit({
      actor: user.username,
      actorType: 'user',
      action: 'login',
      success: true,
      ip: req.ip,
    });
    res.json({
      user: user.toSafeJSON(),
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
    });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
};

exports.createUser = async (req, res, next) => {
  try {
    const { username, password, role = 'viewer', fullName = '' } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ username, passwordHash, role, fullName });
    await audit({
      actor: req.user.username,
      actorType: 'user',
      action: 'user.create',
      resource: user._id.toString(),
      details: { username, role },
      ip: req.ip,
    });
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'username already exists' });
    }
    next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({ users: users.map((u) => u.toSafeJSON()) });
  } catch (err) {
    next(err);
  }
};
