// FRONTEND: screens, navigation, actions
import { api, setToken, getToken } from './api.js';
import { ring, area, bars } from './charts.js';
import { DEVICES, connectBle, startLive, stopLive } from './devices.js';
import { initFx, stagger, paint } from './fx.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 6e4)); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : Math.round(m / 60) + 'h ago'; };
const day = t => new Date(t).toLocaleDateString([], { weekday: 'short' });
const hour = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const emoji = s => s >= 8 ? '😄' : s >= 6.5 ? '😊' : s >= 5 ? '😐' : s >= 3 ? '😕' : '😞';
const arrow = p => (p >= 0 ? '↑ ' : '↓ ') + Math.abs(p) + '%';
const stressColor = v => v >= 67 ? '#c0504d' : v >= 34 ? '#c49a6c' : '#6b9a4b';

let me = null, tab = 'dashboard', refreshTimer = null, shown = null;
function fresh(t) { const f = shown !== t; shown = t; $('#view').classList.toggle('still', !f); return f; }
function moveInd(t) { const i = ['dashboard', 'insights', 'profile'].indexOf(t); if (i >= 0) $('#ind').style.transform = `translateX(${i * 100}%)`; }

function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  $('#toasts').append(el); setTimeout(() => el.remove(), 3200);
}
const fail = e => toast(e.message || 'Something went wrong');

// ================= AUTH =================
let mode = 'login';
function showAuth() {
  stopLive(); clearInterval(refreshTimer);
  $('#app').classList.add('hidden'); $('#auth').classList.remove('hidden');
  const reg = mode === 'register', bio = localStorage.getItem('ns_bio');
  $('#auth').innerHTML = `
    <div class="logo"><em>🧠</em><b>NeuroSense</b></div>
    <h1>${reg ? 'Create Account' : 'Welcome Back'}</h1><p class="muted" style="margin:6px 0 16px">${reg ? 'Start your wellness journey' : 'Sign in to continue your wellness journey'}</p>
    ${!reg ? `<button class="btn ghost" id="bio">☝ Sign in with Fingerprint</button><div class="divider">or continue with</div>` : ''}
    <form id="form">
      ${reg ? `<label class="field">👤<input id="name" placeholder="Name" autocomplete="name"></label>` : ''}
      <label class="field">✉<input id="email" type="email" placeholder="Email" value="${reg ? '' : 'demo@neurosense.com'}" required autocomplete="email"></label>
      <label class="field">🔒<input id="pw" type="password" placeholder="Password" required minlength="6" autocomplete="${reg ? 'new-password' : 'current-password'}"><button type="button" id="eye">👁</button></label>
      ${!reg ? `<div class="link" id="forgot">Forgot Password?</div>` : ''}
      <button class="btn" id="submit">${reg ? 'Create account' : 'Sign in'}</button>
    </form>
    <div class="divider">or</div>
    <button class="btn ghost" data-p="google">G &nbsp;Continue with Google</button>
    <button class="btn ghost" data-p="apple"> &nbsp;Continue with Apple</button>
    <p class="divider" style="margin-top:18px">${reg ? 'Have an account?' : 'New here?'} <a class="link" id="switch">${reg ? 'Sign in' : 'Create account'}</a></p>`;
  stagger($('#auth'));
  $('#eye').onclick = () => { const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; };
  $('#switch').onclick = () => { mode = reg ? 'login' : 'register'; showAuth(); };
  if ($('#forgot')) $('#forgot').onclick = () => toast('Password reset needs an email service. See README.');
  $('#form').onsubmit = async e => {
    e.preventDefault(); $('#submit').disabled = true;
    try {
      const d = await api(reg ? '/auth/register' : '/auth/login', 'POST',
        { email: $('#email').value, password: $('#pw').value, name: reg ? $('#name').value : undefined });
      setToken(d.token); await enter(d.user);
    } catch (x) { fail(x); } finally { const b = $('#submit'); if (b) b.disabled = false; }
  };
  document.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => {
    try { const d = await api('/auth/social', 'POST', { provider: b.dataset.p }); setToken(d.token); await enter(d.user); } catch (x) { fail(x); }
  });
  if ($('#bio')) $('#bio').onclick = bioLogin;
}

// Fingerprint / Face unlock using WebAuthn platform authenticator (device-level gate for the saved session)
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function bioEnroll() {
  try {
    if (!window.PublicKeyCredential) throw new Error('Biometrics not supported here');
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'NeuroSense' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: me.email, displayName: me.name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' } } });
    localStorage.setItem('ns_bio', JSON.stringify({ id: b64(cred.rawId), token: getToken() }));
    toast('Fingerprint login enabled'); renderProfile();
  } catch (e) { fail(e); }
}
async function bioLogin() {
  const saved = JSON.parse(localStorage.getItem('ns_bio') || 'null');
  if (!saved) return toast('Sign in once, then enable fingerprint in Profile');
  try {
    await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: unb64(saved.id) }], userVerification: 'required' } });
    setToken(saved.token); await boot();
  } catch (e) { fail(e); }
}

async function enter(user) {
  me = user; shown = null; $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden');
  go(user.devices.length ? 'dashboard' : 'devices');
  if (user.devices.length) startLive(() => ['dashboard', 'insights'].includes(tab) && render(true));
  clearInterval(refreshTimer); refreshTimer = setInterval(() => ['dashboard', 'insights'].includes(tab) && render(true), 30000);
}

// ================= NAV =================
function go(t) {
  tab = t; $('#tabs').classList.toggle('hidden', t === 'devices'); moveInd(t);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  render();
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
const render = () => ({ dashboard: renderDashboard, insights: renderInsights, profile: renderProfile, devices: renderDevices })[tab]();

// ================= DASHBOARD =================
async function renderDashboard() {
  let d; try { d = await api('/dashboard'); } catch (e) { return fail(e); }
  if (tab !== 'dashboard') return;
  const s = d.stress, dev = me.devices[0];
  $('#view').innerHTML = `
    <div class="top"><h1>Dashboard</h1><span class="chip">${dev ? '● ' + esc(dev) : 'No device'}</span></div>
    ${d.syncedAt ? `<div class="sync">✔ Synced ${ago(d.syncedAt)}</div>` : `<div class="card"><b>No device connected</b><p class="muted">Connect a wearable to see live stress, heart rate and sleep.</p><button class="btn" id="goDev">Connect Device</button></div>`}
    <div class="card"><div class="row"><b><span class="beat">♥</span> Stress Level</b>${s.value != null ? `<span class="badge">${s.rising ? '↗ Rising' : '↘ Falling'}</span>` : ''}</div>
      ${ring(s.value, s.value ?? '--', s.label, s.value != null ? stressColor(s.value) : '#ccc')}
      <div class="note">${esc(s.message)}</div></div>
    <div class="card"><div class="row"><b>◎ Mood Score</b><span class="muted">${d.mood ? ago(d.mood.t) : ''}</span></div>
      ${d.mood ? `<div class="row" style="margin:10px 0"><span class="emoji">${emoji(d.mood.score)}</span><span class="big" style="color:var(--green)"><span data-count="${d.mood.score}">${d.mood.score}</span><small class="muted"> out of 10</small></span></div>
      <div class="bar"><i style="width:${d.mood.score * 10}%;background:var(--green)"></i></div>` : '<p class="muted">No mood logged yet.</p>'}
      <button class="btn ghost" id="logMood">◉ Log Today's Mood</button></div>
    ${d.heart ? `<div class="card"><div class="row"><b><span class="beat">♥</span> Heart Rate</b><span class="badge pulse">● Live</span></div><div class="muted">24-hour timeline</div>
      <div class="stats"><div><b style="color:var(--red)" data-count="${d.heart.current}">${d.heart.current}</b><small>Current bpm</small></div><div><b data-count="${d.heart.resting}">${d.heart.resting}</b><small>Resting bpm</small></div><div><b data-count="${d.heart.max}">${d.heart.max}</b><small>Max today</small></div></div>
      ${area(d.heart.series.map(p => p.hr), d.heart.series.map(p => hour(p.t)), { min: 40, max: 160, color: '#b05a5a' })}</div>` : ''}
    ${d.sleep ? `<div class="card"><div class="row"><b>☾ Sleep Quality</b><span class="badge good">${d.sleep.quality >= 80 ? 'Good' : 'Fair'}</span></div>
      <p class="big"><span data-count="${d.sleep.hours}">${d.sleep.hours}</span><small class="muted"> hours</small></p><div class="bar"><i style="width:${d.sleep.quality}%;background:var(--blue)"></i></div>
      <button class="btn ghost" id="logSleep">Log sleep hours</button></div>` : ''}
    <div class="row"><h2>AI Insights</h2></div>
    ${d.insights.length ? d.insights.map((i, n) => `<div class="insight ${i.priority}" data-a="${i.type}"><div class="row"><b>${esc(i.title)}</b><span class="badge ${i.priority}">${i.priority}</span></div><p>${esc(i.text)}</p><p style="text-align:right;color:var(--blue)">Take Action →</p></div>`).join('') : '<p class="muted">No alerts right now. Nice work.</p>'}`;
  if ($('#goDev')) $('#goDev').onclick = () => go('devices');
  $('#logMood').onclick = logMood;
  if ($('#logSleep')) $('#logSleep').onclick = logSleep;
  document.querySelectorAll('.insight').forEach(el => el.onclick = () => act(el.dataset.a));
  paint(fresh('dashboard'));
}

function ask(html, onOk) {
  const dlg = $('#dlg'); dlg.innerHTML = html + `<button class="btn" id="ok">Save</button><button class="btn ghost" id="cancel">Cancel</button>`;
  dlg.showModal(); $('#cancel').onclick = () => dlg.close();
  $('#ok').onclick = async () => { try { await onOk(); dlg.close(); } catch (e) { fail(e); } };
}
function logMood() {
  ask(`<h2 style="margin-top:0">How are you feeling?</h2><div class="row"><span class="emoji" id="em">😊</span><b class="big" id="mv">7</b></div><input type="range" id="mood" min="0" max="10" step="0.5" value="7">`, async () => {
    await api('/mood', 'POST', { score: +$('#mood').value }); toast('Mood logged'); render();
  });
  $('#mood').oninput = e => { $('#mv').textContent = e.target.value; $('#em').textContent = emoji(+e.target.value); };
}
function logSleep() {
  ask(`<h2 style="margin-top:0">Hours slept last night</h2><input type="range" id="sl" min="2" max="12" step="0.5" value="7"><p class="big" id="sv">7</p>`, async () => {
    await api('/sleep', 'POST', { hours: +$('#sl').value }); toast('Sleep logged'); render();
  });
  $('#sl').oninput = e => $('#sv').textContent = e.target.value;
}

// ================= INSIGHTS =================
const ICON = { break: '⏸', breathing: '≋', bedtime: '☾', hydrate: '💧' };
const BTN = { break: ['green', '🔔 Set Reminder'], breathing: ['', '▶ Start Exercise'], bedtime: ['orange', '🕒 Set Bedtime'], hydrate: ['sky', '🔔 Set Reminder'] };
async function renderInsights() {
  let d; try { d = await api('/insights'); } catch (e) { return fail(e); }
  if (tab !== 'insights') return;
  const w = d.weekly, labels = w.days.map(day), b = d.burnout.value;
  $('#view').innerHTML = `
    <div class="top"><h1>Health Insights</h1><span class="chip">${d.syncedAt ? '⟳ ' + ago(d.syncedAt) : ''}</span></div>
    <h2 style="margin-top:6px">Predictive Analytics</h2>
    <div class="card"><details open><summary class="row" style="cursor:pointer"><span><b>🔥 Burnout Risk Assessment</b><br><span class="muted">${d.burnout.label}</span></span></summary>
      ${ring(b, b + '%', 'Risk', stressColor(b))}
      <b>24-Hour Predictions</b><div style="margin-top:10px">
      ${d.predictions.map(p => `<div class="pred"><div class="row"><span>${p.name}</span><b data-count="${p.value}" data-suf="%">${p.value}%</b></div><div class="bar"><i style="width:${p.value}%;background:${stressColor(p.value)}"></i></div></div>`).join('')}</div></details></div>
    <h2>Weekly Trends</h2>
    <div class="card"><div class="row"><span><b>Stress Pattern Analysis</b><br><span class="muted">Weekly average: ${w.stressAvg}/10</span></span><span class="badge">${arrow(w.stressChange)}</span></div>${area(w.stress, labels)}</div>
    <div class="card"><div class="row"><span><b>Sleep Insights</b><br><span class="muted">Average: ${w.sleepAvg} hours</span></span><span class="badge ${w.sleepChange < 0 ? '' : 'good'}">${arrow(w.sleepChange)}</span></div>${bars(w.sleep, labels, 10)}</div>
    <h2>Personalized Suggestions</h2>
    ${d.suggestions.map(s => `<div class="card"><div class="sugg"><span class="ic">${ICON[s.type]}</span><div><b>${esc(s.title)}</b><p>${esc(s.text)}</p></div></div>
      <button class="btn ${BTN[s.type][0]}" data-a="${s.type}">${BTN[s.type][1]}</button></div>`).join('')}`;
  document.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => act(b.dataset.a));
  paint(fresh('insights'));
}

// ================= ACTIONS: reminders, bedtime, breathing =================
async function notify(text) {
  toast('⏰ ' + text);
  if ('Notification' in window && Notification.permission === 'granted') new Notification('NeuroSense', { body: text });
}
async function remind(type, text, minutes) {
  if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  await api('/reminders', 'POST', { type, at: new Date(Date.now() + minutes * 6e4).toISOString() });
  setTimeout(() => notify(text), minutes * 6e4);
  toast(`Reminder set for ${minutes} min from now`);
}
function act(type) {
  if (type === 'break') remind('break', 'Time for a 5-minute break', 30).catch(fail);
  else if (type === 'hydrate') remind('hydrate', 'Drink some water 💧', 30).catch(fail);
  else if (type === 'breathing') breathing();
  else if (type === 'bedtime') ask(`<h2 style="margin-top:0">Bedtime reminder</h2><input type="time" id="bt" value="22:30">`, async () => {
    const [h, m] = $('#bt').value.split(':'), t = new Date(); t.setHours(h, m, 0, 0); if (t < Date.now()) t.setDate(t.getDate() + 1);
    await remind('bedtime', 'Time to wind down for bed 🌙', Math.round((t - Date.now()) / 6e4));
  });
}
function breathing() {
  const el = $('#breathe'); el.classList.remove('hidden');
  el.innerHTML = `<h1>Breathe</h1><div class="orb" id="orb"></div><h2 id="bt2">Inhale…</h2><p class="muted" id="left">2:00</p><button class="btn ghost" style="width:160px" id="stop">Stop</button>`;
  let sec = 120, inh = true; const orb = $('#orb');
  const flip = () => { inh = !inh; orb.classList.toggle('in', !inh); $('#bt2').textContent = inh ? 'Inhale…' : 'Exhale…'; };
  setTimeout(() => orb.classList.add('in'), 50); $('#bt2').textContent = 'Inhale…'; inh = false; // first inhale already running
  const breath = setInterval(flip, 4000);
  const tick = setInterval(() => { sec--; $('#left').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; if (sec <= 0) end(true); }, 1000);
  const end = done => { clearInterval(breath); clearInterval(tick); el.classList.add('hidden'); if (done) toast('Nice work. Exercise complete 🌿'); };
  $('#stop').onclick = () => end(false);
}

// ================= DEVICES =================
function renderDevices() {
  $('#view').innerHTML = `
    <div class="top"><b>Connect Devices</b><a class="link" id="skip" style="margin:0">Skip</a></div>
    <div class="card" style="background:#dbe6f2"><b>Enhance Health Monitoring</b><p class="muted">Connect your wearable for accurate stress tracking, sleep analysis and AI insights. Your data stays safe and private.</p></div>
    <div class="muted" style="margin:10px 0">Supported Devices</div>
    ${DEVICES.map(d => { const on = me.devices.includes(d.name); return `<div class="card"><div class="device"><span class="pic">${d.icon}</span><b>${d.name}</b></div>
      <button class="btn ${on ? 'ghost' : ''}" data-d="${d.name}">${on ? '✔ Connected (tap to disconnect)' : '🔗 Connect Device'}</button></div>`; }).join('')}
    <div class="card"><b>Bluetooth heart-rate sensor</b><p class="muted">Use any BLE heart-rate strap/band for real readings (Chrome / Edge).</p><button class="btn sky" id="ble">Pair via Bluetooth</button></div>`;
  paint(fresh('devices'));
  $('#skip').onclick = () => go('dashboard');
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => {
    const name = b.dataset.d, on = me.devices.includes(name);
    try { const r = await api(`/devices/${on ? 'disconnect' : 'connect'}`, 'POST', { name }); me.devices = r.devices;
      me.devices.length ? startLive(() => ['dashboard', 'insights'].includes(tab) && render()) : stopLive();
      toast(on ? name + ' disconnected' : name + ' connected'); on ? renderDevices() : go('dashboard'); } catch (e) { fail(e); }
  });
  $('#ble').onclick = async () => {
    try { const name = await connectBle(); me.devices = (await api('/devices/connect', 'POST', { name })).devices;
      startLive(() => ['dashboard', 'insights'].includes(tab) && render()); toast(name + ' paired'); go('dashboard'); } catch (e) { fail(e); }
  };
}

// ================= PROFILE =================
function renderProfile() {
  const bio = !!localStorage.getItem('ns_bio');
  $('#view').innerHTML = `<div class="top"><h1>Profile</h1></div>
    <div class="card"><div class="emoji">🙂</div><h2 style="margin:6px 0">${esc(me.name)}</h2><p class="muted">${esc(me.email)}</p></div>
    <div class="card"><b>Devices</b><p class="muted" style="margin:6px 0">${me.devices.length ? me.devices.map(esc).join(', ') : 'None connected'}</p><button class="btn ghost" id="mng">Manage devices</button></div>
    <div class="card"><b>Security & alerts</b>
      <button class="btn ghost" id="bioBtn">${bio ? '☝ Disable fingerprint login' : '☝ Enable fingerprint login'}</button>
      <button class="btn ghost" id="notif">🔔 Enable notifications</button></div>
    <button class="btn red" id="out">Sign out</button>`;
  paint(fresh('profile'));
  $('#mng').onclick = () => go('devices');
  $('#bioBtn').onclick = () => bio ? (localStorage.removeItem('ns_bio'), toast('Fingerprint login disabled'), renderProfile()) : bioEnroll();
  $('#notif').onclick = async () => toast('Notifications: ' + (('Notification' in window) ? await Notification.requestPermission() : 'unsupported'));
  $('#out').onclick = () => { setToken(null); me = null; mode = 'login'; showAuth(); };
}

// ================= BOOT =================
async function boot() {
  if (!getToken()) return showAuth();
  try { enter((await api('/me')).user); } catch { showAuth(); }
}
initFx();
boot();
