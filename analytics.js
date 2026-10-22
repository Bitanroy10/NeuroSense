// ALGORITHMS: stress score, burnout risk, 24h predictions, trends, suggestions, demo data.
const DAY = 864e5, HOUR = 36e5;
const clamp = (x, a = 0, b = 100) => Math.min(b, Math.max(a, x));
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const label = s => (s < 34 ? 'Low' : s < 67 ? 'Moderate' : 'High');

// Stress 0-100: 60% from heart-rate elevation over resting, 40% from low HRV (ms)
const stressScore = (hr, hrv, rest = 62) =>
  Math.round(clamp((hr - rest) / 50, 0, 1) * 60 + clamp((60 - hrv) / 50, 0, 1) * 40);

// Resting HR = 10th percentile of all heart rates
function restingHr(rs) {
  if (!rs.length) return 62;
  const s = rs.map(r => r.hr).sort((a, b) => a - b);
  return Math.max(45, s[Math.floor(s.length * 0.1)]);
}

// Average items into N daily buckets (oldest -> newest)
function bucket(items, valueFn, days = 7) {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const ends = [], vals = [];
  for (let i = days - 1; i >= 0; i--) {
    const hi = end.getTime() - i * DAY, lo = hi - DAY;
    const v = items.filter(x => x.t > lo && x.t <= hi).map(valueFn);
    ends.push(hi); vals.push(v.length ? avg(v) : null);
  }
  return { ends, vals };
}
const nn = a => a.filter(v => v !== null);
const change = a => { // % change: last 3 days vs previous days
  const v = nn(a), recent = avg(v.slice(-3)), prev = avg(v.slice(0, -3));
  return prev ? Math.round(((recent - prev) / prev) * 1000) / 10 : 0;
};

function summarize(u) {
  const now = Date.now(), rs = u.readings, rest = restingHr(rs);
  const last = rs[rs.length - 1];
  const last24 = rs.filter(r => r.t > now - DAY);
  const sc = r => stressScore(r.hr, r.hrv, rest);
  const recent = rs.filter(r => r.t > now - 30 * 60e3).map(sc);
  const curStress = last ? Math.round(recent.length ? avg(recent) : sc(last)) : null;
  const prevStress = avg(rs.filter(r => r.t > now - 2 * HOUR && r.t <= now - HOUR).map(sc));

  const st = bucket(rs, sc, 7), sl = bucket(u.sleep, s => s.hours, 7), md = bucket(u.moods, m => m.score, 7);
  const avgStress = avg(nn(st.vals)) || (curStress ?? 40);
  const avgSleep = avg(nn(sl.vals)) || 7;
  const avgMood = avg(nn(md.vals)) || 7;
  const trend = change(st.vals);
  const sleepDef = clamp(((8 - avgSleep) / 3) * 100);

  // Burnout risk: weighted blend of stress, sleep debt, low mood and stress trend
  const burnout = Math.round(clamp(
    0.4 * avgStress + 0.3 * sleepDef + 0.2 * (10 - avgMood) * 10 + 0.1 * clamp(50 + trend * 2)));
  const predictions = [
    { key: 'stress', name: 'High Stress', value: Math.round(clamp(0.6 * avgStress + 0.4 * (curStress ?? avgStress) + Math.min(15, Math.max(0, trend) * 0.3))) },
    { key: 'fatigue', name: 'Fatigue', value: Math.round(clamp(0.6 * sleepDef + 0.4 * avgStress)) },
    { key: 'mood', name: 'Mood Drop', value: Math.round(clamp((10 - avgMood) * 5 + 0.3 * avgStress + 0.2 * sleepDef)) }
  ];

  const active = m => rs.filter(r => r.t > now - m * 60e3).reduce((s, r) => s + (r.activeMin || 0), 0);
  const active120 = Math.round(active(120)), active45 = Math.round(active(45));
  const lastSleep = u.sleep[u.sleep.length - 1];
  const lastMood = u.moods[u.moods.length - 1];

  const suggestions = [], insights = [];
  if (active120 >= 60) suggestions.push({ type: 'break', title: 'Take a 5-Minute Break',
    text: `You've been active for ${active120} minutes in the last 2 hours. A short break can help reduce stress and improve focus.` });
  if ((curStress ?? 0) >= 50 || avgStress >= 50) suggestions.push({ type: 'breathing', title: 'Try Breathing Exercise',
    text: 'Your stress levels are elevated. A 2-minute breathing exercise can help you relax.' });
  if (avgSleep < 7) suggestions.push({ type: 'bedtime', title: 'Consider Earlier Bedtime',
    text: `You average ${avgSleep.toFixed(1)}h of sleep. Going to bed 30 minutes earlier could improve sleep quality.` });
  suggestions.push({ type: 'hydrate', title: 'Stay Hydrated',
    text: 'Regular hydration helps maintain energy levels and cognitive function throughout the day.' });

  if (active45 >= 25) insights.push({ title: 'Stay Hydrated', priority: 'MEDIUM', type: 'hydrate',
    text: `You've been active for ${active45} minutes. Consider drinking water to maintain optimal hydration.` });
  if ((curStress ?? 0) >= 50) insights.push({ title: 'Take a Break', priority: 'HIGH', type: 'breathing',
    text: 'Your stress levels have been elevated. A 5-minute breathing exercise could help.' });
  if (avgSleep < 7) insights.push({ title: 'Sleep Reminder', priority: 'LOW', type: 'bedtime',
    text: 'Your recent sleep is below 7 hours. Try winding down earlier tonight.' });

  const tf = a => Math.round(a * 10) / 10;
  return {
    hasData: rs.length > 0,
    syncedAt: last ? last.t : null,
    stress: { value: curStress, label: curStress === null ? '--' : label(curStress),
      rising: curStress !== null && curStress >= prevStress,
      message: curStress === null ? 'Connect a device to start tracking.' :
        curStress >= 67 ? 'High stress detected. Please take a break now.' :
        curStress >= 34 ? 'Moderate stress detected. Consider taking a short break.' : 'Stress is low. Keep it up!' },
    mood: lastMood ? { score: lastMood.score, t: lastMood.t } : null,
    heart: last ? { current: Math.round(last.hr), resting: Math.round(rest),
      max: Math.round(Math.max(...last24.map(r => r.hr))),
      series: last24.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 48)) === 0).map(r => ({ t: r.t, hr: Math.round(r.hr) })) } : null,
    sleep: lastSleep ? { hours: lastSleep.hours, quality: Math.round(clamp(lastSleep.hours / 8 * 100)) } : null,
    insights,
    burnout: { value: burnout, label: burnout < 34 ? 'Low Risk - Healthy' : burnout < 67 ? 'Moderate Risk - Monitor' : 'High Risk - Take Action' },
    predictions, suggestions,
    weekly: { days: st.ends, stress: st.vals.map(v => v === null ? null : tf(v / 10)), stressAvg: tf(avgStress / 10), stressChange: trend,
      sleep: sl.vals.map(v => v === null ? null : tf(v)), sleepAvg: tf(avgSleep), sleepChange: change(sl.vals) }
  };
}

// Demo data generator, used when a (simulated) wearable is connected
function seedData(u) {
  const now = Date.now(); u.readings = []; u.sleep = []; u.moods = [];
  const bias = Array.from({ length: 8 }, () => rnd(-3, 9));
  for (let i = 167; i >= 0; i--) {
    const t = now - i * HOUR, h = new Date(t).getHours(), b = bias[Math.floor(i / 24)];
    const day = h >= 8 && h <= 20;
    u.readings.push({ t, hr: Math.round(60 + (day ? 8 + 8 * Math.sin((h - 8) / 12 * Math.PI) : 0) + b + rnd(-3, 3)),
      hrv: Math.round(clamp(58 - b * 2.5 + rnd(-8, 8), 20, 85)), activeMin: day ? Math.round(rnd(0, 35)) : 0 });
  }
  for (let d = 0; d < 7; d++) {
    u.sleep.push({ t: now - d * DAY, hours: Math.round(rnd(5.2, 8.2) * 10) / 10 });
    u.moods.push({ t: d === 0 ? now - HOUR : now - d * DAY, score: Math.round(rnd(5, 9) * 10) / 10 });
  }
  u.sleep.sort((a, b) => a.t - b.t); u.moods.sort((a, b) => a.t - b.t);
}

module.exports = { stressScore, summarize, seedData, clamp };
