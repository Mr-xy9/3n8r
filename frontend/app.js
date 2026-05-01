// طبقة API ومصادقة في المتصفح | API + auth client
const API_BASE = location.origin + '/api';

const auth = {
  save({ user, accessToken, refreshToken }) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  },
  clear() {
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
  user() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  },
  token() { return localStorage.getItem('accessToken'); },
};

async function request(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = auth.token();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (res.status === 401 && location.pathname !== '/index.html' && location.pathname !== '/') {
    auth.clear();
    location.href = 'index.html';
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const api = {
  login(username, password) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  me() { return request('/auth/me'); },
  stats() { return request('/alerts/stats'); },
  listAlerts(limit = 50) { return request(`/alerts?limit=${limit}`); },
  triggerAlert(payload) {
    return request('/alerts/trigger', { method: 'POST', body: JSON.stringify(payload) });
  },
  stopAlert(alertId) {
    return request(`/alerts/${alertId}/stop`, { method: 'POST' });
  },
  listDevices() { return request('/devices'); },
  registerDevice(payload) {
    return request('/devices', { method: 'POST', body: JSON.stringify(payload) });
  },
  deleteDevice(id) { return request(`/devices/${id}`, { method: 'DELETE' }); },
  pingDevice(id) { return request(`/devices/${id}/ping`, { method: 'POST' }); },
  resetDevice(id) { return request(`/devices/${id}/reset`, { method: 'POST' }); },
  audit(limit = 100) { return request(`/audit?limit=${limit}`); },
};
