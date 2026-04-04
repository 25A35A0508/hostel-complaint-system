// ── Config ───────────────────────────────────────────────────────────────────
const API = 'http://localhost:5000/api';

// ── Auth ─────────────────────────────────────────────────────────────────────
function getToken()  { return localStorage.getItem('hcms_token'); }
function getUser()   { const u = localStorage.getItem('hcms_user'); return u ? JSON.parse(u) : null; }
function setAuth(token, user) {
  localStorage.setItem('hcms_token', token);
  localStorage.setItem('hcms_user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('hcms_token');
  localStorage.removeItem('hcms_user');
}

function requireAuth(role) {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) { window.location.href = '/pages/login.html'; return false; }
  if (role && user.role !== role && !(role === 'staff' && ['admin','warden'].includes(user.role))) {
    window.location.href = user.role === 'admin' ? '/pages/admin.html' : '/pages/dashboard.html';
    return false;
  }
  return true;
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) };
  if (opts.body instanceof FormData) delete headers['Content-Type'];
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return [...document.querySelectorAll(sel)]; }

function showAlert(id, msg, type = 'error') {
  const el_ = el(id);
  if (!el_) return;
  el_.className = `alert alert-${type}`;
  el_.textContent = msg;
  el_.style.display = 'block';
  if (type === 'success') setTimeout(() => { el_.style.display = 'none'; }, 3000);
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return new Date(date).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function statusBadge(status) {
  const map = {
    pending:     ['badge-pending',  '⏳ Pending Review'],
    in_progress: ['badge-progress', '↻ In Progress'],
    resolved:    ['badge-resolved', '✓ Resolved'],
    closed:      ['badge-closed',   '✗ Closed'],
  };
  const [cls, label] = map[status] || ['badge-closed', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function priorityBadge(priority) {
  const map = {
    low:      ['badge-resolved', 'Low'],
    medium:   ['badge-pending',  'Medium'],
    high:     ['badge-high',     '● High Priority'],
    critical: ['badge-critical', '⚠ Critical'],
  };
  const [cls, label] = map[priority] || ['badge-closed', priority];
  return `<span class="badge ${cls}">${label}</span>`;
}

function categoryColor(cat) {
  const map = { Electrical:'border-blue', Plumbing:'border-amber', Water:'border-amber', Internet:'border-blue', Maintenance:'border-amber', Mess:'border-blue', Noise:'border-amber', Other:'border-blue' };
  return map[cat] || 'border-blue';
}

// ── Render shared nav items ───────────────────────────────────────────────────
function renderUserChip() {
  const user = getUser();
  if (!user) return;
  const initials = user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const el_ = el('user-chip');
  if (el_) el_.innerHTML = `<div class="user-avatar">${initials}</div><span>${user.name}</span>`;
}

function logout() {
  clearAuth();
  window.location.href = '/pages/login.html';
}
