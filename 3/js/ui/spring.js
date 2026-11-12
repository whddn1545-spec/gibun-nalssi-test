// 스프링(반암시적 오일러, dt 1/120초)과 곡선 (design-spec §6)
import { onFrame } from '../loop.js';
export const SPR = { pop: { k: 420, c: 24 }, soft: { k: 170, c: 26 }, bounce: { k: 320, c: 14 } };
export class Spring {
  constructor(x = 0, cfg = SPR.soft, eps = 0.002) { this.x = x; this.v = 0; this.target = x; this.cfg = cfg; this.eps = eps; this.acc = 0; this.idle = true; }
  to(t, cfg) { this.target = t; if (cfg) this.cfg = cfg; this.idle = false; return this; }
  set(x) { this.x = this.target = x; this.v = 0; this.idle = true; this.acc = 0; return this; }
  kick(v) { this.v += v; this.idle = false; return this; }
  step(dtMs) {
    if (this.idle) return false;
    this.acc += Math.min(dtMs, 64) / 1000; const h = 1 / 120; const { k, c } = this.cfg;
    while (this.acc >= h) { const a = -k * (this.x - this.target) - c * this.v; this.v += a * h; this.x += this.v * h; this.acc -= h; }
    if (Math.abs(this.x - this.target) < this.eps && Math.abs(this.v) < this.eps * 5) { this.x = this.target; this.v = 0; this.idle = true; }
    return true;
  }
}
// 스프링 묶음을 루프에 붙인다. 반환된 함수를 부르면 다시 돈다.
export function driver(springs, apply) {
  let off = null;
  return function kick() {
    if (off) return;
    off = onFrame((dt) => {
      let busy = false;
      for (const s of springs) busy = s.step(dt) || busy;
      apply();
      if (!busy) { off(); off = null; }
    });
  };
}
// 닫힌 꼴 스프링 응답(0→1, 초기 속도 0). ms를 넣으면 진행값.
export function springCurve(cfg) {
  const w0 = Math.sqrt(cfg.k), z = cfg.c / (2 * w0);
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return (ms) => { if (ms <= 0) return 0; const t = ms / 1000; return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); }; }
  return (ms) => { if (ms <= 0) return 0; const t = ms / 1000; return 1 - Math.exp(-w0 * t) * (1 + w0 * t); };
}
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t, dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) break; const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    if (t < 0 || t > 1 || Math.abs(sx(t) - x) > 1e-4) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 24; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return sy(t);
  };
}
export const ease = {
  out: bezier(0.22, 0.8, 0.24, 1),
  in: bezier(0.5, 0, 0.8, 0.3),
  inout: bezier(0.45, 0.05, 0.25, 1),
  fly: bezier(0.5, 0, 0.7, 0.6),
  lin: (x) => Math.max(0, Math.min(1, x)),
};
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const seg = (t, t0, d) => clamp01((t - t0) / d);
// 단추 눌림: 80 동안 .96, 떼면 spring-pop 복귀 (§6.4)
export function pressable(el) {
  const s = new Spring(1, SPR.pop, 0.0005); let held = false;
  const kick = driver([s], () => { el.style.transform = s.x === 1 ? '' : `scale(${s.x.toFixed(4)})`; });
  const down = () => { held = true; s.to(0.96, { k: 900, c: 60 }); kick(); };
  const up = () => { if (!held) return; held = false; s.to(1, SPR.pop); kick(); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  return { press() { s.set(0.95); s.to(1, SPR.pop); kick(); } };
}
