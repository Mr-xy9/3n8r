// منطق لوحة التحكم | Dashboard logic
(function () {
  if (!auth.token()) { location.href = 'index.html'; return; }
  const user = auth.user();
  document.getElementById('user-name').textContent = `${user.fullName || user.username} · ${user.role}`;

  document.getElementById('btn-logout').addEventListener('click', () => {
    auth.clear();
    location.href = 'index.html';
  });

  // التبديل بين التبويبات
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      const target = t.dataset.tab;
      document.querySelectorAll('.panel').forEach((p) => {
        p.classList.toggle('hidden', p.dataset.panel !== target);
      });
      if (target === 'devices') loadDevices();
      else if (target === 'history') loadAlerts();
      else if (target === 'audit') loadAudit();
      else if (target === 'overview') loadOverview();
    });
  });

  // اتصال Socket.io للوحة
  const socket = io('/dashboard', { auth: { token: auth.token() } });
  socket.on('device:status', ({ deviceId, online }) => {
    const row = document.querySelector(`[data-device-row="${deviceId}"] .status`);
    if (row) row.innerHTML = online
      ? '<span class="badge ok">متصل</span>'
      : '<span class="badge bad">غير متصل</span>';
    loadOverview();
  });

  // ==== نظرة عامة ====
  async function loadOverview() {
    try {
      const stats = await api.stats();
      const cards = [
        { lbl: 'إجمالي التنبيهات', num: stats.total },
        { lbl: 'آخر 24 ساعة', num: stats.last24h },
        { lbl: 'الأجهزة المتصلة', num: `${stats.onlineDevices}/${stats.totalDevices}` },
      ];
      document.getElementById('stats-cards').innerHTML = cards
        .map((c) => `<div class="card"><div class="num">${c.num}</div><div class="lbl">${c.lbl}</div></div>`)
        .join('');
      const { devices } = await api.listDevices();
      document.getElementById('online-devices').innerHTML = devices
        .map((d) => `<div class="device-pill">
          <strong><span class="dot ${d.online ? 'on' : 'off'}"></span>${d.name || d.deviceId}</strong>
          <span class="muted">${d.location || '-'}</span>
          <span class="muted">${d.deviceId}</span>
        </div>`)
        .join('') || '<p class="muted">لا توجد أجهزة مسجّلة بعد.</p>';
    } catch (e) { console.error(e); }
  }

  // ==== إطلاق إنذار ====
  document.getElementById('trigger-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const targets = (fd.get('targetDevices') || '').toString().split(',').map((s) => s.trim()).filter(Boolean);
    const payload = {
      type: fd.get('type'),
      title: fd.get('title') || '',
      message: fd.get('message') || '',
      audioUrl: fd.get('audioUrl') || '',
      duration: parseInt(fd.get('duration'), 10) || 30,
      repeat: parseInt(fd.get('repeat'), 10) || 1,
      targetDevices: targets,
    };
    if (!confirm(`تأكيد إطلاق إنذار من نوع ${payload.type}؟`)) return;
    try {
      const res = await api.triggerAlert(payload);
      alert(`تم الإطلاق إلى ${res.dispatched}/${res.total} جهاز`);
    } catch (err) {
      alert('فشل: ' + err.message);
    }
  });

  document.getElementById('btn-stop-all').addEventListener('click', async () => {
    if (!confirm('إيقاف جميع التنبيهات النشطة؟')) return;
    const { alerts } = await api.listAlerts(20);
    const active = alerts.filter((a) => a.status === 'active');
    for (const a of active) await api.stopAlert(a.alertId);
    alert(`أُوقف ${active.length} تنبيه`);
  });

  // ==== الأجهزة ====
  document.getElementById('device-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const res = await api.registerDevice({
        deviceId: fd.get('deviceId'),
        name: fd.get('name') || '',
        location: fd.get('location') || '',
      });
      const banner = document.getElementById('device-token-banner');
      banner.textContent = `تم إنشاء الجهاز ${res.device.deviceId}. التوكن (يُعرض مرة واحدة): ${res.deviceToken}`;
      banner.classList.remove('hidden');
      e.target.reset();
      loadDevices();
    } catch (err) { alert(err.message); }
  });

  async function loadDevices() {
    try {
      const { devices } = await api.listDevices();
      const tb = document.getElementById('devices-tbody');
      tb.innerHTML = devices.map((d) => `
        <tr data-device-row="${d.deviceId}">
          <td>${d.deviceId}</td>
          <td>${d.name || '-'}</td>
          <td>${d.location || '-'}</td>
          <td class="status">${d.online ? '<span class="badge ok">متصل</span>' : '<span class="badge bad">غير متصل</span>'}</td>
          <td>${d.rssi ?? '-'}</td>
          <td>${d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('ar') : '-'}</td>
          <td>
            <button class="btn btn-ghost" data-act="ping" data-id="${d.deviceId}">Ping</button>
            <button class="btn btn-warning" data-act="reset" data-id="${d.deviceId}">إعادة</button>
            <button class="btn btn-danger" data-act="del" data-id="${d.deviceId}">حذف</button>
          </td>
        </tr>`).join('');
      tb.querySelectorAll('button[data-act]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          try {
            if (btn.dataset.act === 'ping') {
              const r = await api.pingDevice(id);
              alert(r.ok ? 'تم الإرسال' : 'الجهاز غير متصل');
            } else if (btn.dataset.act === 'reset') {
              if (!confirm('إعادة تشغيل الجهاز؟')) return;
              await api.resetDevice(id);
            } else if (btn.dataset.act === 'del') {
              if (!confirm('حذف الجهاز نهائياً؟')) return;
              await api.deleteDevice(id);
              loadDevices();
            }
          } catch (e) { alert(e.message); }
        });
      });
    } catch (e) { console.error(e); }
  }

  // ==== سجل التنبيهات ====
  async function loadAlerts() {
    try {
      const { alerts } = await api.listAlerts(100);
      document.getElementById('alerts-tbody').innerHTML = alerts.map((a) => `
        <tr>
          <td>${new Date(a.createdAt).toLocaleString('ar')}</td>
          <td>${a.type}</td>
          <td><span class="badge ${a.status === 'active' ? 'warn' : a.status === 'completed' ? 'ok' : 'bad'}">${a.status}</span></td>
          <td>${a.triggeredBy?.username || 'system'}</td>
          <td>${a.deviceAcks?.length || 0} ack</td>
        </tr>`).join('');
    } catch (e) { console.error(e); }
  }

  // ==== سجل المراجعة ====
  async function loadAudit() {
    if (user.role !== 'admin') {
      document.getElementById('audit-tbody').innerHTML = '<tr><td colspan="5" class="muted">يتطلب صلاحية admin</td></tr>';
      return;
    }
    try {
      const { logs } = await api.audit(200);
      document.getElementById('audit-tbody').innerHTML = logs.map((l) => `
        <tr>
          <td>${new Date(l.createdAt).toLocaleString('ar')}</td>
          <td>${l.actor} <span class="muted">(${l.actorType})</span></td>
          <td>${l.action}</td>
          <td>${l.resource || '-'}</td>
          <td>${l.success ? '<span class="badge ok">نجح</span>' : '<span class="badge bad">فشل</span>'}</td>
        </tr>`).join('');
    } catch (e) { console.error(e); }
  }

  loadOverview();
})();
