// 하나의 rAF 루프. 하늘과 UI 움직임이 같은 시계(vt, ms)를 쓴다.
// 시험(?qa=1)에서는 freeze() 뒤 advance(ms)로 시간을 직접 밀 수 있다.
const subs = new Set();
let raf = 0, last = 0, vt = 0, frozen = false, paused = false;
const ft = [];
export const now = () => vt;
function run(dt) {
  vt += dt;
  for (const f of Array.from(subs)) {
    try { f(dt, vt); } catch (e) { subs.delete(f); console.error(e); }
  }
}
function tick(ts) {
  raf = 0;
  if (frozen || paused) return;
  let dt = last ? ts - last : 16.67; last = ts;
  if (dt > 100) dt = 100; if (dt < 0) dt = 0;
  ft.push(dt); if (ft.length > 600) ft.shift();
  run(dt);
  raf = requestAnimationFrame(tick);
}
function wake() { if (!raf && !frozen && !paused) { last = 0; raf = requestAnimationFrame(tick); } }
export function onFrame(fn) { subs.add(fn); wake(); return () => subs.delete(fn); }
export function start() { wake(); }
export function pause(v) { paused = v; if (v) { if (raf) cancelAnimationFrame(raf); raf = 0; } else wake(); }
export function freeze() { frozen = true; if (raf) cancelAnimationFrame(raf); raf = 0; }
export function unfreeze() { frozen = false; wake(); }
export function advance(ms, step = 1000 / 60) { let left = ms; while (left > 1e-6) { const d = Math.min(step, left); run(d); left -= d; } }
export function frameTimes() { return ft.slice(); }
// 시간 함수: fn(p 0..1, 경과 ms). delay 뒤 시작.
export function play(dur, fn, delay = 0) {
  const t0 = vt + delay; let off = null, resolve;
  const h = { done: new Promise((r) => (resolve = r)), cancel() { if (off) { off(); off = null; } resolve(); } };
  off = onFrame((dt, t) => { const e = t - t0; if (e < 0) return; const p = dur > 0 ? Math.min(1, e / dur) : 1; fn(p, e); if (p >= 1) h.cancel(); });
  if (delay <= 0) fn(0, 0);
  return h;
}
export function after(ms, fn) { return play(0, (p) => { if (p >= 1) fn(); }, Math.max(ms, 0.001)); }
