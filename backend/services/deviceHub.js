// مركز اتصال الأجهزة عبر Socket.io | Device hub
// يدير الاتصالات الدائمة مع أجهزة ESP32 ويتيح إرسال أوامر فورية.
const bcrypt = require('bcryptjs');
const Device = require('../models/Device');
const Alert = require('../models/Alert');
const { audit } = require('../utils/audit');

let hubInstance = null;

class DeviceHub {
  constructor(io) {
    this.io = io;
    this.devices = new Map(); // deviceId -> socket
    this._wire();
  }

  _wire() {
    const ns = this.io.of('/devices');
    ns.use(async (socket, next) => {
      // Accept credentials from handshake.auth (Socket.io) or query params (ESP32 WebSocket)
      const auth = socket.handshake.auth || {};
      const query = socket.handshake.query || {};
      const deviceId = auth.deviceId || query.deviceId;
      const token    = auth.token    || query.token;

      if (!deviceId || !token) return next(new Error('missing credentials'));

      let device = await Device.findOne({ deviceId });

      if (!device) {
        // Auto-register on first connection
        const deviceToken = await bcrypt.hash(token, 10);
        device = await Device.create({
          deviceId,
          name: deviceId,
          location: '',
          deviceToken,
          enabled: true,
        });
        console.log(`[hub] auto-registered device: ${deviceId}`);
      } else {
        if (!device.enabled) return next(new Error('device disabled'));
        const ok = await bcrypt.compare(token, device.deviceToken);
        if (!ok) return next(new Error('invalid token'));
      }

      socket.data.deviceId = deviceId;
      socket.data.device = device;
      next();
    });

    ns.on('connection', (socket) => this._onConnect(socket));
  }

  async _onConnect(socket) {
    const { deviceId } = socket.data;
    this.devices.set(deviceId, socket);
    await Device.updateOne(
      { deviceId },
      {
        online: true,
        lastSeenAt: new Date(),
        ipAddress: socket.handshake.address,
      }
    );
    this._broadcastStatus(deviceId, true);
    await audit({
      actor: deviceId,
      actorType: 'device',
      action: 'device.connect',
      resource: deviceId,
      ip: socket.handshake.address,
    });

    socket.on('message', (msg) => this._onMessage(deviceId, msg));
    socket.on('heartbeat', (data) => this._onHeartbeat(deviceId, data));
    socket.on('ack', (data) => this._onAck(deviceId, data));

    socket.on('disconnect', async () => {
      this.devices.delete(deviceId);
      await Device.updateOne(
        { deviceId },
        { online: false, lastSeenAt: new Date() }
      );
      this._broadcastStatus(deviceId, false);
      await audit({
        actor: deviceId,
        actorType: 'device',
        action: 'device.disconnect',
        resource: deviceId,
      });
    });
  }

  async _onHeartbeat(deviceId, data = {}) {
    await Device.updateOne(
      { deviceId },
      {
        online: true,
        lastSeenAt: new Date(),
        rssi: data.rssi ?? null,
        uptime: data.uptime ?? 0,
        firmwareVersion: data.fw || undefined,
      }
    );
  }

  async _onAck(deviceId, data = {}) {
    const { alertId, status } = data;
    if (!alertId) return;
    await Alert.updateOne(
      { alertId },
      { $push: { deviceAcks: { deviceId, status, at: new Date() } } }
    );
  }

  _onMessage(deviceId, msg) {
    // قناة مفتوحة لرسائل تشخيصية
    console.log(`[device:${deviceId}]`, msg);
  }

  _broadcastStatus(deviceId, online) {
    // إخطار لوحة التحكم بحالة الجهاز
    this.io.of('/dashboard').emit('device:status', { deviceId, online });
  }

  sendTo(deviceId, payload) {
    const socket = this.devices.get(deviceId);
    if (!socket) return false;
    socket.emit('command', payload);
    return true;
  }

  broadcast(payload) {
    this.io.of('/devices').emit('command', payload);
  }

  disconnect(deviceId) {
    const socket = this.devices.get(deviceId);
    if (socket) socket.disconnect(true);
  }

  isOnline(deviceId) {
    return this.devices.has(deviceId);
  }
}

function init(io) {
  hubInstance = new DeviceHub(io);
  return hubInstance;
}

function getHub() {
  if (!hubInstance) throw new Error('DeviceHub not initialised');
  return hubInstance;
}

module.exports = { init, getHub };
