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
    // Use root namespace `/` for ESP32 devices.
    // Reason: links2004/WebSockets SocketIOclient (ESP32) doesn't reliably
    // join sub-namespaces in Socket.IO v4 — events end up on the default
    // namespace and CONNECT_ERROR on a sub-namespace tears the whole
    // socket down. Dashboard uses its own `/dashboard` namespace, so they
    // don't conflict.
    const ns = this.io.of('/');
    ns.use(async (socket, next) => {
      try {
        const auth = socket.handshake.auth || {};
        const query = socket.handshake.query || {};
        const deviceId = auth.deviceId || query.deviceId;

        console.log(`[hub] handshake from ${socket.handshake.address} deviceId=${deviceId}`);

        if (!deviceId) {
          console.log('[hub] ❌ missing deviceId');
          return next(new Error('missing deviceId'));
        }

        // No token check — auto-create on first connect.
        let device = await Device.findOne({ deviceId });
        if (!device) {
          device = await Device.create({
            deviceId,
            name: deviceId,
            location: '',
            deviceToken: 'open',
            enabled: true,
          });
          console.log(`[hub] ✅ auto-registered device: ${deviceId}`);
        } else if (!device.enabled) {
          console.log(`[hub] ❌ device disabled: ${deviceId}`);
          return next(new Error('device disabled'));
        } else {
          console.log(`[hub] ✅ connected: ${deviceId}`);
        }

        socket.data.deviceId = deviceId;
        socket.data.device = device;
        next();
      } catch (err) {
        console.error('[hub] middleware error:', err.message);
        next(new Error('server error'));
      }
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
    this.io.of('/').emit('command', payload);
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
