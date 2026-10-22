// FRONTEND: wearable connection + live data pushing
import { api } from './api.js';
export const DEVICES = [
  { name: 'Fitbit Charge 5', icon: '⌚' }, { name: 'Samsung Galaxy Watch', icon: '⌚' },
  { name: 'Noise Pro', icon: '⌚' }, { name: 'Apple Watch', icon: '⌚' }
];
let timer = null, hr = 70, bleHr = null, bleRR = [];

// Real heart-rate sensor via Web Bluetooth (Chrome/Edge/Android; standard BLE Heart Rate profile)
export async function connectBle() {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported in this browser');
  const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
  const svc = await (await dev.gatt.connect()).getPrimaryService('heart_rate');
  const ch = await svc.getCharacteristic('heart_rate_measurement');
  ch.addEventListener('characteristicvaluechanged', e => {
    const v = e.target.value, f = v.getUint8(0);
    bleHr = f & 1 ? v.getUint16(1, true) : v.getUint8(1);
    if (f & 16) { bleRR = []; for (let i = f & 1 ? 3 : 2; i + 1 < v.byteLength; i += 2) bleRR.push(v.getUint16(i, true) / 1024 * 1000); }
  });
  await ch.startNotifications();
  return dev.name || 'Bluetooth HR Sensor';
}
const rmssd = rr => rr.length < 2 ? null : Math.sqrt(rr.slice(1).reduce((s, x, i) => s + (x - rr[i]) ** 2, 0) / (rr.length - 1));

export function startLive(onUpdate) {
  stopLive();
  timer = setInterval(async () => {
    let hrv;
    if (bleHr) { hr = bleHr; hrv = rmssd(bleRR) || Math.max(20, 100 - hr * 0.7); }
    else { hr = Math.min(130, Math.max(55, hr + (Math.random() - 0.5) * 6)); hrv = Math.max(20, 70 - (hr - 60) * 0.8 + Math.random() * 8); }
    try { await api('/readings', 'POST', { hr: Math.round(hr), hrv: Math.round(hrv), activeMin: hr > 85 ? 10 / 60 : 0 }); onUpdate?.(); } catch {}
  }, 10000);
}
export const stopLive = () => { clearInterval(timer); timer = null; };
