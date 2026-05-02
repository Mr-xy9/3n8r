// منطق خريطة المساجد | Mosque map logic
(function () {
  'use strict';

  let map = null;
  let mosqueLayer = null;
  let osmLayer = null;
  let deviceMarkers = {};

  const RIYADH = { lat: 24.7136, lng: 46.6753, zoom: 11 };

  // أيقونات الخريطة
  const iconOnline = L.divIcon({
    className: '',
    html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))">🟢</div>',
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14],
  });
  const iconOffline = L.divIcon({
    className: '',
    html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">🕌</div>',
    iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14],
  });
  const iconOsm = L.divIcon({
    className: '',
    html: '<div style="font-size:18px;line-height:1;opacity:.7">🕌</div>',
    iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -11],
  });

  function initMap() {
    if (map) return;
    map = L.map('mosque-map', { preferCanvas: true }).setView([RIYADH.lat, RIYADH.lng], RIYADH.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    mosqueLayer = L.layerGroup().addTo(map);
    osmLayer = L.layerGroup().addTo(map);

    loadRegisteredMosques();
    loadOsmMosques();
    setupSocket();
  }

  // مساجد مسجّلة في قاعدة البيانات
  async function loadRegisteredMosques() {
    try {
      const { mosques, devices } = await Promise.all([
        api.listMosques(),
        api.listDevices(),
      ]).then(([m, d]) => ({ mosques: m.mosques, devices: d.devices }));

      const deviceMap = {};
      devices.forEach((d) => { deviceMap[d.deviceId] = d; });

      mosqueLayer.clearLayers();
      deviceMarkers = {};

      mosques.forEach((m) => {
        const device = m.deviceId ? deviceMap[m.deviceId] : null;
        const online = device?.online;
        const icon = m.deviceId ? (online ? iconOnline : iconOffline) : iconOsm;

        const marker = L.marker([m.lat, m.lng], { icon })
          .bindPopup(buildPopup(m, device), { maxWidth: 280 });

        mosqueLayer.addLayer(marker);
        if (m.deviceId) deviceMarkers[m.deviceId] = marker;
      });
    } catch (err) {
      console.error('[map] failed to load mosques:', err.message);
    }
  }

  // مساجد OpenStreetMap عبر Overpass API
  async function loadOsmMosques() {
    const bbox = '24.4,46.4,25.1,47.1'; // حدود الرياض
    const query = `[out:json][timeout:30];(node["amenity"="place_of_worship"]["religion"="muslim"](${bbox});way["amenity"="place_of_worship"]["religion"="muslim"](${bbox}););out center 300;`;
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

    try {
      const res = await fetch(url);
      const data = await res.json();
      osmLayer.clearLayers();

      data.elements.forEach((el) => {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (!lat || !lng) return;
        const name = el.tags?.name || el.tags?.['name:ar'] || 'مسجد';
        L.marker([lat, lng], { icon: iconOsm })
          .bindPopup(`
            <div class="map-popup">
              <h4>🕌 ${name}</h4>
              <p class="muted">من OpenStreetMap</p>
              <button class="btn btn-primary btn-sm" onclick="window.mapAddMosque(${lat},${lng},'${name.replace(/'/g, "\\'")}')">
                + تسجيل في النظام
              </button>
            </div>`)
          .addTo(osmLayer);
      });
    } catch (err) {
      console.warn('[map] overpass unavailable:', err.message);
    }
  }

  function buildPopup(mosque, device) {
    const statusBadge = device
      ? (device.online
          ? '<span class="badge ok">متصل ✅</span>'
          : '<span class="badge bad">غير متصل ❌</span>')
      : '<span class="badge warn">لا يوجد جهاز</span>';

    return `
      <div class="map-popup">
        <h4>🕌 ${mosque.nameAr || mosque.name}</h4>
        ${mosque.district ? `<p class="muted">${mosque.district}</p>` : ''}
        ${mosque.address ? `<p>${mosque.address}</p>` : ''}
        <div style="margin:.5rem 0">${statusBadge}</div>
        ${device ? `<p class="muted">جهاز: ${device.deviceId}</p>` : ''}
        ${device ? `
          <div class="map-actions">
            <button class="btn btn-danger btn-sm" onclick="window.mapTriggerAlert('${device.deviceId}')">
              🚨 إطلاق إنذار
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.mapPingDevice('${device.deviceId}')">
              📡 Ping
            </button>
          </div>
        ` : ''}
        <button class="btn btn-ghost btn-sm" style="margin-top:.4rem;width:100%"
          onclick="window.mapDeleteMosque('${mosque._id}')">🗑 حذف</button>
      </div>`;
  }

  // استقبال تحديثات Socket.io
  function setupSocket() {
    if (!window._dashSocket) return;
    window._dashSocket.on('device:status', ({ deviceId, online }) => {
      const marker = deviceMarkers[deviceId];
      if (!marker) return;
      marker.setIcon(online ? iconOnline : iconOffline);
    });
  }

  // تسجيل مسجد جديد من Overpass
  window.mapAddMosque = async function (lat, lng, name) {
    try {
      await api.createMosque({ name, nameAr: name, lat, lng });
      loadRegisteredMosques();
    } catch (err) { alert(err.message); }
  };

  window.mapTriggerAlert = async function (deviceId) {
    if (!confirm(`إطلاق إنذار على جهاز ${deviceId}؟`)) return;
    try {
      await api.triggerAlert({ type: 'AIR_RAID', duration: 30, repeat: 1, targetDevices: [deviceId] });
      alert('تم إطلاق الإنذار ✅');
    } catch (err) { alert(err.message); }
  };

  window.mapPingDevice = async function (deviceId) {
    try {
      const r = await api.pingDevice(deviceId);
      alert(r.ok ? 'الجهاز متصل ✅' : 'الجهاز غير متصل ❌');
    } catch (err) { alert(err.message); }
  };

  window.mapDeleteMosque = async function (id) {
    if (!confirm('حذف المسجد من النظام؟')) return;
    try {
      await api.deleteMosque(id);
      loadRegisteredMosques();
    } catch (err) { alert(err.message); }
  };

  // نموذج إضافة مسجد يدوياً (بالنقر على الخريطة)
  function enableAddByClick() {
    if (!map) return;
    map.once('click', async (e) => {
      const name = prompt('اسم المسجد:');
      if (!name) return;
      const district = prompt('الحي (اختياري):') || '';
      const deviceId = prompt('معرّف الجهاز ESP32 (اختياري):') || null;
      try {
        await api.createMosque({ name, nameAr: name, district, lat: e.latlng.lat, lng: e.latlng.lng, deviceId });
        loadRegisteredMosques();
      } catch (err) { alert(err.message); }
    });
    alert('انقر على الخريطة لتحديد موقع المسجد');
  }

  // مرفق للـ Dashboard
  window.mapModule = { initMap, loadRegisteredMosques, enableAddByClick };
})();
