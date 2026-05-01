// قناة Socket.io للوحة التحكم | Dashboard realtime channel
const jwt = require('jsonwebtoken');
const config = require('../config');

function init(io) {
  const ns = io.of('/dashboard');
  ns.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('missing token'));
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      socket.data.user = payload;
      next();
    } catch (e) {
      next(new Error('invalid token'));
    }
  });
  ns.on('connection', (socket) => {
    socket.emit('hello', { ok: true, user: socket.data.user.username });
  });
  return ns;
}

module.exports = { init };
