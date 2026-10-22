// STORAGE: Upstash Redis (REST) on Vercel; local JSON file for `node server/server.js` development.
const fs = require('fs'), path = require('path');
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const FILE = path.join(__dirname, 'data.json');
let mem;
const load = () => mem ??= (() => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } })();

async function cmd(c) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(c) });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error || 'Store error');
  return d.result;
}
const guard = () => {
  if (process.env.VERCEL && !URL_) throw Object.assign(new Error('Database not configured. Add Upstash Redis under Vercel > Storage.'), { status: 503 });
};
exports.get = async k => { guard(); if (URL_) { const v = await cmd(['GET', k]); return v ? JSON.parse(v) : null; } return load()[k] || null; };
exports.set = async (k, v) => { guard(); if (URL_) return void await cmd(['SET', k, JSON.stringify(v)]); load()[k] = v; fs.writeFileSync(FILE, JSON.stringify(mem)); };
