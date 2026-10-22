// FRONTEND: motion effects (cursor follower, magnetic buttons, ripples, staggered entrances, count-up numbers)
const $ = s => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

export function stagger(root) { [...root.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 10))); }

function countUp(root) {
  if (reduce) return;
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = parseFloat(el.dataset.count), suf = el.dataset.suf || '', dec = (el.dataset.count.split('.')[1] || '').length, t0 = performance.now();
    const step = t => { const p = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - p, 3); el.textContent = (to * e).toFixed(dec) + suf; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
export function paint(fresh) {
  const v = $('#view'); stagger(v);
  if (fresh) { v.scrollTo({ top: 0, behavior: 'instant' }); countUp(v); }
}

export function initFx() {
  // ripple on click
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest?.('.btn,#tabs button,.field button'); if (!b || reduce) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, i = document.createElement('i');
    i.className = 'ripple'; i.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.append(i); setTimeout(() => i.remove(), 700);
  });
  if (!fine || reduce) return;

  const root = document.documentElement, cur = document.createElement('div'), dot = document.createElement('div');
  cur.id = 'cur'; cur.innerHTML = '<i></i>'; dot.id = 'dot'; document.body.append(cur, dot);
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y, lastBtn = null;

  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    root.style.setProperty('--mx', (x / innerWidth - .5).toFixed(3)); root.style.setProperty('--my', (y / innerHeight - .5).toFixed(3));
    cur.classList.add('on');
    const t = e.target, card = t.closest?.('.card');
    if (card) { const r = card.getBoundingClientRect(); card.style.setProperty('--px', x - r.left + 'px'); card.style.setProperty('--py', y - r.top + 'px'); }
    cur.classList.toggle('hot', !!t.closest?.('button,a,.insight,.link,summary,input,label.field'));
    const b = t.closest?.('.btn');                       // magnetic pull toward the pointer
    if (lastBtn && lastBtn !== b) { lastBtn.style.setProperty('--tx', '0px'); lastBtn.style.setProperty('--ty', '0px'); }
    if (b) { const r = b.getBoundingClientRect(); b.style.setProperty('--tx', ((x - r.left) / r.width - .5) * 10 + 'px'); b.style.setProperty('--ty', ((y - r.top) / r.height - .5) * 5 + 'px'); }
    lastBtn = b;
  }, { passive: true });
  addEventListener('pointerdown', () => cur.classList.add('down'));
  addEventListener('pointerup', () => cur.classList.remove('down'));
  root.addEventListener('mouseleave', () => cur.classList.remove('on'));
  (function loop() { cx += (x - cx) * .16; cy += (y - cy) * .16; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); })();
}
