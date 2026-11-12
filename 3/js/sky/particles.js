// 강수 입자: 비(앞 80 + 먼 60), 눈(앞 40 + 먼 50). 저성능은 절반 (design-spec §5.5)
import { mulberry32 } from '../dates.js';
const TAU = Math.PI * 2;
const SIN12 = Math.sin((12 * Math.PI) / 180), COS12 = Math.cos((12 * Math.PI) / 180);

class Precip {
  constructor(seed, caps, lowCaps) { this.r = mulberry32(seed); this.front = []; this.far = []; this.caps = caps; this.lowCaps = lowCaps; this.cap = caps; this.density = 0; this.target = 0; this.ramp = null; this.follow = 0; this.fillUntil = -1; }
  setLow(low) { this.cap = low ? this.lowCaps : this.caps; }
  start(t, mode, rampMs) {
    this.target = 1;
    if (mode === 'instant' || mode === 'fade' || mode === 'tod') { this.density = 1; this.ramp = null; this.follow = 0; this.fillUntil = t + 60; }
    else if (mode === 'scrub') { this.ramp = null; this.follow = 140; this.fillUntil = t + 500; }
    else { this.ramp = { t0: t + 120, dur: rampMs }; this.follow = 0; this.fillUntil = t + 120 + rampMs + 200; }
  }
  stop(mode) { this.target = 0; this.ramp = null; if (mode === 'scrub') this.follow = 140; else { this.follow = 0; this.density = 0; } if (mode === 'instant' || mode === 'fade') { this.front.length = 0; this.far.length = 0; } }
  clear() { this.front.length = 0; this.far.length = 0; }
  stepDensity(dt, t) {
    if (this.ramp) { this.density = Math.max(0, Math.min(1, (t - this.ramp.t0) / this.ramp.dur)); if (t - this.ramp.t0 >= this.ramp.dur) this.ramp = null; }
    else if (this.follow) { this.density += (this.target - this.density) * (1 - Math.exp(-dt / this.follow)); if (Math.abs(this.density - this.target) < 0.01) { this.density = this.target; this.follow = 0; } }
  }
  get active() { return this.front.length + this.far.length > 0 || this.density > 0; }
}

export class Rain extends Precip {
  constructor(seed) { super(seed, [80, 60], [40, 20]); this.splash = []; }
  spawn(front, env, fill) {
    const r = this.r, W = env.W;
    const p = { x: -0.04 * W + r() * W * 1.3, y: 0, v: front ? 860 + r() * 240 : 620 + r() * 180, len: front ? 16 + r() * 8 : 10 + r() * 4, gy: env.crest1 - 6 + r() * (env.crest2 - env.crest1 + 10), vx: 0 };
    const ground = front ? env.hill3(p.x) : p.gy;
    p.y = fill ? -30 + r() * (ground + 20) : -20 - r() * 120;
    (front ? this.front : this.far).push(p);
  }
  update(dt, t, env) {
    this.stepDensity(dt, t);
    const fill = t < this.fillUntil || env.still;
    const n1 = Math.round(this.cap[0] * this.density), n2 = Math.round(this.cap[1] * this.density);
    if (!env.still) {
      const k = (env.mul * dt) / 1000; const T = env.touch;
      for (const [arr, front] of [[this.front, true], [this.far, false]]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i]; const sp = p.v * k; p.x -= SIN12 * sp; p.y += COS12 * sp;
          if (front && T) { const dx = p.x - T.x, dy = p.y - T.y, d = Math.hypot(dx, dy); if (d < 56 && d > 0.01) { p.x = T.x + (dx / d) * 56; p.y = T.y + (dy / d) * 56 * 0.98; } }
          const g = front ? env.hill3(p.x) + 2 : p.gy;
          if (p.y > g) { if (front && this.r() < 0.3) this.splash.push({ x: p.x, y: env.hill3(p.x) + 3 + this.r() * 16, a: 0 }); arr.splice(i, 1); }
        }
      }
      for (let i = this.splash.length - 1; i >= 0; i--) { const s = this.splash[i]; s.a += dt; if (s.a > 180) this.splash.splice(i, 1); }
    }
    let guard = 0;
    while (this.front.length < n1 && guard++ < 200) this.spawn(true, env, fill);
    while (this.far.length < n2 && guard++ < 400) this.spawn(false, env, fill);
  }
  drawLayer(c, front, suck) {
    const arr = front ? this.front : this.far; if (!arr.length) return;
    c.strokeStyle = front ? '#D5E7F2' : '#A9C7DC'; c.lineWidth = front ? 1.6 : 1.0; c.lineCap = 'round';
    c.globalAlpha = (front ? 0.62 : 0.32) * (suck ? 1 - suck.p * 0.7 : 1);
    c.beginPath();
    for (const p of arr) { let x = p.x, y = p.y, l = p.len; if (suck) { x += (suck.x - x) * suck.p; y += (suck.y - y) * suck.p; l *= 1 - suck.p; } c.moveTo(x, y); c.lineTo(x + SIN12 * l, y - COS12 * l); }
    c.stroke(); c.globalAlpha = 1;
  }
  drawSplash(c) {
    if (!this.splash.length) return;
    c.strokeStyle = '#D5E7F2'; c.lineWidth = 1;
    for (const s of this.splash) { const q = s.a / 180, r = 2 + 5 * q; c.globalAlpha = 0.5 * (1 - q); c.beginPath(); c.ellipse(s.x, s.y, r, r * 0.45, 0, Math.PI + 0.35, Math.PI + 1.25); c.stroke(); c.beginPath(); c.ellipse(s.x, s.y, r, r * 0.45, 0, -1.25, -0.35); c.stroke(); }
    c.globalAlpha = 1;
  }
}

export class Snow extends Precip {
  constructor(seed) { super(seed, [40, 50], [20, 25]); this.puff = []; }
  spawn(front, env, fill) {
    const r = this.r, W = env.W;
    const p = { x: -0.05 * W + r() * W * 1.1, y: 0, r: front ? 2.2 + r() * 2.3 : 1.2 + r() * 1.0, vy: 30 + r() * 40, amp: 10 + r() * 8, per: 2400 + r() * 1600, ph: r(), crystal: front && r() < 0.125, rot: r() * TAU, vx: 0, vy2: 0, gy: env.crest2 - 4 + r() * 14 };
    const ground = front ? env.hill3(p.x) : p.gy;
    p.y = fill ? -10 + r() * (ground + 5) : -8 - r() * 60;
    (front ? this.front : this.far).push(p);
  }
  update(dt, t, env) {
    this.stepDensity(dt, t);
    const fill = t < this.fillUntil || env.still;
    const n1 = Math.round(this.cap[0] * this.density), n2 = Math.round(this.cap[1] * this.density);
    if (!env.still) {
      const k = (env.mul * dt) / 1000; const T = env.touch; const damp = Math.exp(-dt / 600);
      for (const [arr, front] of [[this.front, true], [this.far, false]]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i];
          if (T && (T.vx || T.vy)) { const sx = p.x + Math.sin(TAU * (t / p.per + p.ph)) * p.amp; const d = Math.hypot(sx - T.x, p.y - T.y); if (d < 80) { const f = 0.4 * (1 - d / 80) * Math.min(1, dt / 16.7) * 0.25; p.vx += T.vx * f; p.vy2 += T.vy * f; } }
          p.x += p.vx * (dt / 1000); p.y += (p.vy + p.vy2) * k; p.vx *= damp; p.vy2 *= damp;
          const g = front ? env.hill3(p.x) + 4 : p.gy;
          if (p.y > g || p.x < -60 || p.x > env.W + 60) arr.splice(i, 1);
        }
      }
      for (let i = this.puff.length - 1; i >= 0; i--) { const q = this.puff[i]; q.a += dt; q.x += q.vx * (dt / 1000); q.y += q.vy * (dt / 1000); q.vy += 160 * (dt / 1000); q.vx *= damp; if (q.a > 1400) this.puff.splice(i, 1); }
    }
    let guard = 0;
    while (this.front.length < n1 && guard++ < 200) this.spawn(true, env, fill);
    while (this.far.length < n2 && guard++ < 400) this.spawn(false, env, fill);
  }
  burst(x, y, n) { const r = this.r; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.4, v = 120 + r() * 160; this.puff.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2 + r() * 2.5, a: 0 }); } }
  drawLayer(c, front, t, bright, suck) {
    const arr = front ? this.front : this.far; if (!arr.length && !(front && this.puff.length)) return;
    const pos = (p) => { let x = p.x + Math.sin(TAU * (t / p.per + p.ph)) * p.amp, y = p.y; if (suck) { x += (suck.x - x) * suck.p; y += (suck.y - y) * suck.p; } return [x, y]; };
    const fade = suck ? 1 - suck.p * 0.8 : 1;
    if (!front) { c.fillStyle = '#EAF2F8'; c.globalAlpha = 0.55 * fade; c.beginPath(); for (const p of arr) { const [x, y] = pos(p); c.moveTo(x + p.r, y); c.arc(x, y, p.r, 0, TAU); } c.fill(); c.globalAlpha = 1; return; }
    if (bright) { c.fillStyle = '#A9BDCF'; c.globalAlpha = 0.5 * fade; c.beginPath(); for (const p of arr) { if (p.crystal) continue; const [x, y] = pos(p); c.moveTo(x + p.r, y + 1); c.arc(x, y + 1, p.r, 0, TAU); } c.fill(); }
    c.fillStyle = '#FFFFFF'; c.globalAlpha = 0.9 * fade; c.beginPath();
    for (const p of arr) { if (p.crystal) continue; const [x, y] = pos(p); c.moveTo(x + p.r, y); c.arc(x, y, p.r, 0, TAU); }
    for (const q of this.puff) { const a = 1 - q.a / 1400; if (a <= 0) continue; c.moveTo(q.x + q.r, q.y); c.arc(q.x, q.y, q.r, 0, TAU); }
    c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = 0.8; c.beginPath();
    for (const p of arr) { if (!p.crystal) continue; const [x, y] = pos(p); const rr = p.r * 1.25; for (let k = 0; k < 3; k++) { const a = p.rot + (k * Math.PI) / 3 + t / 3000; c.moveTo(x - Math.cos(a) * rr, y - Math.sin(a) * rr); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } }
    c.stroke(); c.globalAlpha = 1;
  }
}
