// منطق خريطة المساجد | Mosque map logic
(function () {
  'use strict';

  let map = null;
  let mosqueLayer = null;
  let osmLayer = null;
  let deviceMarkers = {};

  const RIYADH = { lat: 24.7136, lng: 46.6753, zoom: 11 };

  // أيقونات رسمية على الخريطة | Official map markers (SVG pin)
  const pinSVG = (color, ring) => `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
        fill="${color}" stroke="${ring}" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5.5" fill="#fff"/>
    </svg>`;

  const iconOnline = L.divIcon({
    className: '',
    html: pinSVG('#006B3F', '#fff'),
    iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -32],
  });
  const iconOffline = L.divIcon({
    className: '',
    html: pinSVG('#C0392B', '#fff'),
    iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -32],
  });
  const iconOsm = L.divIcon({
    className: '',
    html: pinSVG('#8A93A2', '#fff'),
    iconSize: [22, 28], iconAnchor: [11, 28], popupAnchor: [0, -24],
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
              <h4>${name}</h4>
              <p class="muted">مصدر البيانات: OpenStreetMap</p>
              <button class="btn btn-primary btn-sm" onclick="window.mapAddMosque(${lat},${lng},'${name.replace(/'/g, "\\'")}')">
                تسجيل المسجد في النظام
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
          ? '<span class="badge ok">متصل</span>'
          : '<span class="badge bad">غير متصل</span>')
      : '<span class="badge warn">لا يوجد جهاز مرتبط</span>';

    return `
      <div class="map-popup">
        <h4>${mosque.nameAr || mosque.name}</h4>
        ${mosque.district ? `<p class="muted">${mosque.district}</p>` : ''}
        ${mosque.address ? `<p>${mosque.address}</p>` : ''}
        <div style="margin:.5rem 0">${statusBadge}</div>
        ${device ? `<p class="muted">معرّف الجهاز: ${device.deviceId}</p>` : ''}
        ${device ? `
          <div class="map-actions">
            <button class="btn btn-danger btn-sm" onclick="window.mapTriggerAlert('${device.deviceId}')">
              إطلاق إنذار
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.mapPingDevice('${device.deviceId}')">
              فحص الاتصال
            </button>
          </div>
        ` : ''}
        <button class="btn btn-ghost btn-sm" style="margin-top:.5rem;width:100%"
          onclick="window.mapDeleteMosque('${mosque._id}')">حذف من النظام</button>
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
      alert('تم إطلاق الإنذار بنجاح');
    } catch (err) { alert(err.message); }
  };

  window.mapPingDevice = async function (deviceId) {
    try {
      const r = await api.pingDevice(deviceId);
      alert(r.ok ? 'الجهاز متصل ويستجيب' : 'الجهاز غير متصل حالياً');
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
