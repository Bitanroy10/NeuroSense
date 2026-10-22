// BACKEND: zero-dependency REST API. Runs on Vercel (api/[...path].js) or locally (node server/server.js).
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { summarize, seedData } = require('./analytics');
const store = require('./store');

const SECRET = process.env.SECRET || 'change-this-secret-in-production';
const PUB = path.join(__dirname, '..', 'public');

// ---------- auth helpers ----------
const hmac = p => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
const sign = email => { const p = Buffer.from(JSON.stringify({ email, exp: Date.now() + 7 * 864e5 })).toString('base64url'); return p + '.' + hmac(p); };
function verify(tok) {
  try {
    const [p, s] = tok.split('.');
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(hmac(p)))) return null;
    const d = JSON.parse(Buffer.from(p, 'base64url'));
    return d.exp > Date.now() ? d.email : null;
  } catch { return null; }
}
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, devices: u.devices, reminders: u.reminders.slice(-10) });
const key = email => 'user:' + email;
const saveUser = u => store.set(key(u.email), u);

async function newUser(name, email, pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const u = { id: crypto.randomUUID(), name, email, salt, hash: hashPw(pw, salt), devices: [], readings: [], moods: [], sleep: [], reminders: [] };
  await saveUser(u); return u;
}

const hits = new Map(); // login rate limiter (per server instance): 10 attempts / minute / IP
const limited = ip => { const n = (hits.get(ip) || []).filter(t => Date.now() - t < 6e4); n.push(Date.now()); hits.set(ip, n); return n.length > 10; };
const err = (status, message) => Object.assign(new Error(message), { status });

// ---------- routes ----------
const routes = {
  'POST /api/auth/register': async ({ body }) => {
    const { name = '', email = '', password = '' } = body, em = String(email).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) throw err(400, 'Enter a valid email');
    if (password.length < 6) throw err(400, 'Password must be at least 6 characters');
    if (await store.get(key(em))) throw err(409, 'Account already exists');
    const u = await newUser(String(name).trim().slice(0, 60) || em.split('@')[0], em, password);
    return { token: sign(em), user: publicUser(u) };
  },
  'POST /api/auth/login': async ({ body, ip }) => {
    if (limited(ip)) throw err(429, 'Too many attempts. Try again in a minute.');
    const em = String(body.email || '').toLowerCase(), u = await store.get(key(em));
    if (!u || hashPw(String(body.password || ''), u.salt) !== u.hash) throw err(401, 'Invalid email or password');
    return { token: sign(em), user: publicUser(u) };
  },
  // DEMO ONLY: real Google/Apple sign-in needs OAuth client keys (see README)
  'POST /api/auth/social': async ({ body }) => {
    const p = body.provider === 'apple' ? 'apple' : 'google', em = `${p}.demo@neurosense.com`;
    const u = (await store.get(key(em))) || await newUser(p[0].toUpperCase() + p.slice(1) + ' Demo', em, crypto.randomBytes(12).toString('hex'));
    return { token: sign(em), user: publicUser(u) };
  },
  'GET /api/me': async ({ user }) => ({ user: publicUser(user) }),
  'GET /api/dashboard': async ({ user }) => summarize(user),
  'GET /api/insights': async ({ user }) => summarize(user),
  'POST /api/devices/connect': async ({ user, body }) => {
    const name = String(body.name || '').slice(0, 40);
    if (!name) throw err(400, 'Device name required');
    if (!user.devices.includes(name)) user.devices.push(name);
    if (!user.readings.length) seedData(user);
    await saveUser(user); return { devices: user.devices };
  },
  'POST /api/devices/disconnect': async ({ user, body }) => {
    user.devices = user.devices.filter(d => d !== body.name); await saveUser(user); return { devices: user.devices };
  },
  'POST /api/readings': async ({ user, body }) => {
    const hr = Number(body.hr), hrv = Number(body.hrv);
    if (!(hr >= 30 && hr <= 220) || !(hrv >= 5 && hrv <= 200)) throw err(400, 'Invalid reading');
    user.readings.push({ t: Date.now(), hr, hrv, activeMin: Math.min(10, Math.max(0, Number(body.activeMin) || 0)) });
    if (user.readings.length > 800) user.readings.splice(0, user.readings.length - 800);
    await saveUser(user); return { ok: true };
  },
  'POST /api/mood': async ({ user, body }) => {
    const score = Number(body.score);
    if (!(score >= 0 && score <= 10)) throw err(400, 'Mood must be 0-10');
    user.moods.push({ t: Date.now(), score }); await saveUser(user); return { ok: true };
  },
  'POST /api/sleep': async ({ user, body }) => {
    const hours = Number(body.hours);
    if (!(hours > 0 && hours <= 16)) throw err(400, 'Invalid hours');
    user.sleep.push({ t: Date.now(), hours }); await saveUser(user); return { ok: true };
  },
  'POST /api/reminders': async ({ user, body }) => {
    user.reminders.push({ t: Date.now(), type: String(body.type || '').slice(0, 20), at: String(body.at || '').slice(0, 30) });
    await saveUser(user); return { ok: true };
  }
};

const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

function readBody(req) {
  if (req.body !== undefined) { // Vercel pre-parses the body
    try { return Promise.resolve(typeof req.body === 'string' ? (req.body ? JSON.parse(req.body) : {}) : req.body || {}); }
    catch { return Promise.reject(err(400, 'Bad JSON')); }
  }
  return new Promise((ok, no) => {
    let s = ''; req.on('data', c => { s += c; if (s.length > 1e6) { no(err(413, 'Too large')); req.destroy(); } });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { no(err(400, 'Bad JSON')); } });
  });
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
function serve(req, res) { // local development only (Vercel serves /public itself)
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(PUB, p));
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}

async function handler(req, res) {
  const pathname = new URL(req.url, 'http://x').pathname.replace(/\/$/, '');
  if (!pathname.startsWith('/api/')) return serve(req, res);
  try {
    const fn = routes[`${req.method} ${pathname}`];
    if (!fn) throw err(404, 'Not found');
    let user = null;
    if (!pathname.startsWith('/api/auth/')) {
      const email = verify((req.headers.authorization || '').replace('Bearer ', ''));
      user = email && await store.get(key(email));
      if (!user) throw err(401, 'Please sign in');
    }
    const body = req.method === 'POST' ? await readBody(req) : {};
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0];
    json(res, 200, await fn({ user, body, ip }));
  } catch (e) { if (!e.status) console.error(e); json(res, e.status || 500, { error: e.status ? e.message : 'Server error' }); }
}

module.exports = { handler };
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  http.createServer(handler).listen(PORT, () => console.log(`NeuroSense running on http://localhost:${PORT}`));
}
