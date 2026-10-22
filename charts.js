// FRONTEND: tiny dependency-free SVG charts
export function ring(value, text, sub, color) {
  const r = 52, c = 2 * Math.PI * r, v = value == null ? 0 : value;
  return `<svg class="ring" width="150" height="150" viewBox="0 0 150 150">
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="#efece6" stroke-width="12"/>
    <circle cx="75" cy="75" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${(c * v / 100).toFixed(1)} ${c}" transform="rotate(-90 75 75)"/>
    <text x="75" y="80" style="font-size:34px;font-weight:700;fill:#1d2433">${text}</text>
    <text x="75" y="100" style="font-size:13px">${sub}</text></svg>`;
}
export function area(vals, labels, { min = 0, max = 10, color = '#e08a4a' } = {}) {
  const W = 320, H = 150, L = 26, B = 22, T = 8, n = vals.length;
  const x = i => L + (n < 2 ? 0 : i * (W - L - 6) / (n - 1)), y = v => T + (H - T - B) * (1 - (v - min) / (max - min));
  const pts = vals.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
  if (!pts.length) return '<p class="muted">No data yet</p>';
  const line = pts.map(p => p.join(',')).join(' ');
  const grid = [0, .5, 1].map(f => { const v = min + (max - min) * f; return `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="2" y="${y(v) + 3}">${Math.round(v)}</text>`; }).join('');
  const labs = labels.map((l, i) => (n <= 8 || i % Math.ceil(n / 6) === 0) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${l}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${grid}
    <polygon points="${pts[0][0]},${y(min)} ${line} ${pts.at(-1)[0]},${y(min)}" fill="${color}" opacity=".15"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${labs}</svg>`;
}
export function bars(vals, labels, max = 10) {
  const W = 320, H = 150, L = 26, B = 22, n = vals.length, bw = (W - L) / n;
  const col = v => v >= 7 ? '#6b9a4b' : v >= 6 ? '#d9a566' : '#c0504d';
  const b = vals.map((v, i) => v == null ? '' : `<rect x="${L + i * bw + 5}" y="${8 + (H - 8 - B) * (1 - v / max)}" width="${bw - 10}" height="${(H - 8 - B) * v / max}" rx="3" fill="${col(v)}"/>`).join('');
  const labs = labels.map((l, i) => `<text x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${l}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">${b}${labs}</svg>`;
}
