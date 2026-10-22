// FRONTEND: API client
let token = localStorage.getItem('ns_token');
export const setToken = t => { token = t; t ? localStorage.setItem('ns_token', t) : localStorage.removeItem('ns_token'); };
export const getToken = () => token;
export async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && token) setToken(null); throw new Error(d.error || 'Request failed'); }
  return d;
}
