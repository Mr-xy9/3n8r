// التحقق من JWT والصلاحيات | JWT auth + RBAC middleware
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.accessTtl }
  );
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString(), typ: 'refresh' }, config.jwt.secret, {
    expiresIn: config.jwt.refreshTtl,
  });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    if (payload.typ === 'refresh') return res.status(401).json({ error: 'invalid token' });
    const user = await User.findById(payload.sub);
    if (!user || !user.active) return res.status(401).json({ error: 'invalid user' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

module.exports = { signAccessToken, signRefreshToken, requireAuth, requireRole };
