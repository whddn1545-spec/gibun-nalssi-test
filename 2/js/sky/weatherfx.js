// 비, 눈, 번개와 건드렸을 때의 반응.
// 비와 눈은 시간만으로 위치가 정해지는 입자라서(상태 없음) 카드용 정지 장면에도 그대로 쓴다.

import { clamp, css, lerp, makeCanvas, rng } from './util.js';

const RAIN_BACK = 90;
const RAIN_FRONT = 64;
const SNOW_LAYERS = [
  { n: 38, r: [1.3, 2.1], speed: [14, 22], amp: 7, alpha: 0.62, front: false },
  { n: 26, r: [2.4, 3.6], speed: [26, 40], amp: 12, alpha: 0.85, front: false },
  { n: 14, r: [4.4, 6.4], speed: [46, 68], amp: 18, alpha: 0.95, front: true },
];

function makeSnowSprite(pr) {
  const size = 32;
  const canvas = makeCanvas(size * pr, size * pr);
  const g = canvas.getContext('2d');
  g.scale(pr, pr);
  const c = size / 2;
  const grad = g.createRadialGradient(c, c, 0, c, c, c);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,.96)');
  grad.addColorStop(0.64, 'rgba(238,246,255,.7)');
  grad.addColorStop(0.8, 'rgba(150,184,222,.2)');
  grad.addColorStop(1, 'rgba(150,184,222,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvas;
}

function sparklePath(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

// 번개 가지: 끝을 향해 비틀거리며 내려가고, 가지를 친다
function genBolt(r, x0, y0, x1, y1, width, depth = 0) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(5, Math.round(dist / 20));
  const pts = [[x0, y0]];
  const nx = -(y1 - y0) / dist;
  const ny = (x1 - x0) / dist;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const jitter = (r() - 0.5) * 34 * (1 - t * 0.35) * (depth ? 0.7 : 1);
    pts.push(i === steps ? [x1, y1] : [lerp(x0, x1, t) + nx * jitter, lerp(y0, y1, t) + ny * jitter]);
  }
  const out = [{ pts, width }];
  if (depth < 1) {
    const count = 2 + Math.floor(r() * 2);
    for (let b = 0; b < count; b += 1) {
      const idx = 2 + Math.floor(r() * (pts.length - 4));
      const [bx, by] = pts[idx];
      const side = r() < 0.5 ? -1 : 1;
      const len = 40 + r() * 70;
      const ang = Math.atan2(y1 - y0, x1 - x0) + side * (0.5 + r() * 0.5);
      out.push(...genBolt(r, bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, width * 0.5, depth + 1));
    }
  }
  return out;
}

// 비워 둘 사각형(카드 제목 자리) 안인지
const inClear = (F, x, y, pad = 0) => {
  const c = F.clear;
  return Boolean(c) && x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad;
};
const avoid = (x, c, half) => (Math.abs(x - c) < half ? c + (x >= c ? half : -half) : x);

const bump = (t, t0, rise, fall) => (t < t0 ? 0 : t < t0 + rise ? (t - t0) / rise : Math.exp(-(t - t0 - rise) / fall));

export class FX {
  constructor(pr, reducedMotion) {
    this.pr = pr;
    this.reduced = reducedMotion;
    this.snowSprite = makeSnowSprite(pr);
    const r = rng(8080);
    this.back = Array.from({ length: RAIN_BACK }, () => ({ x: r(), sp: 520 + r() * 220, len: 9 + r() * 8, ph: r() }));
    this.front = Array.from({ length: RAIN_FRONT }, () => ({
      x: r(), sp: 820 + r() * 320, len: 15 + r() * 12, ph: r(), depth: r(),
    }));
    this.flakes = SNOW_LAYERS.map((layer) => Array.from({ length: layer.n }, () => ({
      x: r(), ph: r(), r: lerp(layer.r[0], layer.r[1], r()), sp: lerp(layer.speed[0], layer.speed[1], r()),
      fx: 0.5 + r() * 0.9, fp: r() * 6.28, depth: r(),
    })));
    this.bolt = null;
    this.nextBolt = 2.2;
    this.lastMini = -9;
    this.parts = [];
    this.rings = [];
    this.rand = rng(31337);
    this.flinch = 0;
    this.still = false;
  }

  setPixelRatio(pr) {
    if (pr === this.pr) return;
    this.pr = pr;
    this.snowSprite = makeSnowSprite(pr);
  }

  // ── 상태 ──

  update(dt, F) {
    // 천둥 날씨에서만 3~7초마다 번개가 친다
    if (F.p.bolt > 0.5) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.strike(F);
        this.nextBolt = 3 + this.rand() * 4;
      }
    } else {
      this.nextBolt = Math.min(this.nextBolt, 1.4);
    }
    this.flinch = Math.max(0, this.flinch - dt * 2.6);
    if (this.bolt) {
      this.bolt.age += dt;
      if (this.bolt.age > this.bolt.dur) this.bolt = null;
    }
    for (const p of this.parts) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-p.drag * dt);
      p.vy = p.vy * Math.exp(-p.drag * dt) + p.g * dt;
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
  }

  strike(F, x, y, mini = false) {
    const r = this.rand;
    const c = F.clear;
    let top = F.hillTop * (mini ? 0.2 : 0.16);
    let sx;
    let ex;
    if (mini) {
      sx = x + (r() - 0.5) * 40;
      ex = x;
    } else {
      sx = F.w * (0.15 + r() * 0.7);
      if (c) {
        // 카드: 제목 자리 오른쪽에 치고, 사람과 나무를 피한다
        const minX = c.x + c.w + 36;
        if (minX < F.w - 30) sx = lerp(minX, F.w - 30, r());
        else top = Math.max(top, c.y + c.h + 8);
      }
      ex = sx + (r() - 0.5) * 80;
      if (c) ex = clamp(avoid(avoid(ex, F.px, 48), F.tx, 34), 10, F.w - 10);
    }
    const ey = mini ? y : F.surfaceY(ex) + 4;
    let segs = genBolt(r, sx, top, ex, ey, mini ? 2.2 : 3.2);
    if (c) segs = segs.filter((seg, i) => i === 0 || !seg.pts.some(([px, py]) => inClear(F, px, py, 8)));
    this.bolt = { segs, age: 0, dur: mini ? 0.45 : 1.0, mini, ox: sx, oy: top };
    if (!mini) this.flinch = 1;
  }

  poke(F, x, y, id) {
    const r = this.rand;
    const add = (n, fn) => { for (let i = 0; i < n; i += 1) this.parts.push(fn(i)); };
    const spark = (colors, n = 12) => add(n, () => {
      const a = r() * Math.PI * 2;
      const sp = 30 + r() * 90;
      return {
        kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, drag: 2.2, g: -14,
        age: 0, life: 0.9 + r() * 0.7, r: 3 + r() * 4, color: colors[Math.floor(r() * colors.length)],
      };
    });
    switch (id) {
      case 'sunny':
        spark([[255, 232, 140], [255, 250, 220], [255, 200, 90]]);
        break;
      case 'rain':
        for (let i = 0; i < 3; i += 1) this.rings.push({ x, y, age: -i * 0.16, life: 1.15 });
        break;
      case 'thunder':
        if (F.t - this.lastMini > 1) {
          this.lastMini = F.t;
          this.strike(F, x, y, true);
        }
        break;
      case 'snow':
        add(16, () => {
          const a = -Math.PI / 2 + (r() - 0.5) * 2.6;
          const sp = 40 + r() * 110;
          return {
            kind: 'flake', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.6, g: 26,
            age: 0, life: 1.8 + r() * 0.8, r: 2 + r() * 3.4,
          };
        });
        break;
      case 'rainbow':
        spark([[255, 111, 134], [255, 170, 79], [255, 227, 110], [111, 219, 148], [98, 197, 255], [169, 139, 255]], 16);
        break;
      case 'cloudy':
        break;
      default:
        spark([[255, 255, 255], [220, 232, 255]], 9);
    }
  }

  leaves(x, y) {
    const r = this.rand;
    for (let i = 0; i < 4; i += 1) {
      this.parts.push({
        kind: 'leaf', x: x + (r() - 0.5) * 40, y: y + (r() - 0.5) * 20, vx: (r() - 0.5) * 30, vy: 6 + r() * 14,
        drag: 0.6, g: 26, age: 0, life: 1.8 + r(), r: 3 + r() * 1.6, rot: r() * 6.28,
      });
    }
  }

  // ── 그리기 ──

  rainSlant(F) {
    return 0.12 + F.p.wind * 0.3;
  }

  drawBackRain(ctx, F) {
    const amount = F.p.rain * RAIN_BACK * F.q;
    if (amount < 0.05) return;
    const th = this.rainSlant(F);
    const sx = Math.sin(th);
    const cy = Math.cos(th);
    const tan = Math.tan(th);
    const D = F.hillTop + F.h * 0.12 + 40;
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = `rgba(214,234,255,${(0.36 * (1 - 0.25 * F.night)).toFixed(3)})`;
    ctx.beginPath();
    const partial = [];
    for (let i = 0; i < RAIN_BACK; i += 1) {
      const a = clamp(amount - i);
      if (a <= 0) break;
      const d = this.back[i];
      const s = (F.t * d.sp + d.ph * D) % D;
      const y = s - 20;
      const x = d.x * (F.w + D * tan) - D * tan * 0.5 + y * tan;
      if (inClear(F, x, y, 6)) continue;
      if (a < 1) { partial.push([x, y, d, a]); continue; }
      ctx.moveTo(x, y);
      ctx.lineTo(x - sx * d.len, y - cy * d.len);
    }
    ctx.stroke();
    for (const [x, y, d, a] of partial) {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - sx * d.len, y - cy * d.len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawFrontRain(ctx, F) {
    const amount = F.p.rain * RAIN_FRONT * F.q;
    if (amount < 0.05) return;
    const th = this.rainSlant(F);
    const tan = Math.tan(th);
    const sx = Math.sin(th);
    const cy = Math.cos(th);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.7;
    const dropCol = 'rgba(226,242,255,';
    for (let i = 0; i < RAIN_FRONT; i += 1) {
      const a = clamp(amount - i);
      if (a <= 0) break;
      const d = this.front[i];
      const xl = d.x * F.w;
      const g = F.surfaceY(xl) + 4 + d.depth * F.h * 0.1;
      const splashLen = d.sp * 0.22;
      const D = g + 30 + splashLen;
      const s = (F.t * d.sp + d.ph * D) % D;
      if (s < g + 30) {
        const y = s - 30;
        const x = xl - (g - y) * tan;
        if (inClear(F, x, y, 6)) continue;
        ctx.strokeStyle = `${dropCol}${(0.62 * a).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - sx * d.len, y - cy * d.len);
        ctx.stroke();
      } else if (g < F.h) {
        // 언덕에 닿으면 작은 물방울이 튄다
        const k = (s - g - 30) / splashLen;
        const fade = (1 - k) * a;
        ctx.strokeStyle = `${dropCol}${(0.5 * fade * fade).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(xl, g, 2 + k * 9, 0.8 + k * 2.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.7;
      }
    }
  }

  drawSnow(ctx, F, front) {
    if (F.p.snow < 0.01) return;
    for (let li = 0; li < SNOW_LAYERS.length; li += 1) {
      const layer = SNOW_LAYERS[li];
      if (layer.front !== front) continue;
      const amount = F.p.snow * layer.n * F.q;
      const list = this.flakes[li];
      const drift = F.p.wind * 0.35;
      for (let i = 0; i < list.length; i += 1) {
        const a = clamp(amount - i);
        if (a <= 0) break;
        const f = list[i];
        const x0 = f.x * F.w;
        const g = layer.front ? F.surfaceY(x0) + 8 + f.depth * F.h * 0.1 : F.hillTop + F.h * 0.1;
        const D = g + 24;
        const s = (F.t * f.sp + f.ph * D) % D;
        const y = s - 12;
        const x = x0 + Math.sin(F.t * f.fx + f.fp) * layer.amp + y * drift;
        if (inClear(F, x, y, 8)) continue;
        const fade = Math.min(1, (D - s) / 26) * a * layer.alpha;
        ctx.globalAlpha = fade;
        const d = f.r * 2.3;
        ctx.drawImage(this.snowSprite, x - d / 2, y - d / 2, d, d);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBolt(ctx, F, mini = false) {
    const b = this.bolt;
    if (!b || b.mini !== mini) return;
    let alpha;
    if (this.still) alpha = 1;
    else if (this.reduced) alpha = 0.34 * bump(b.age, 0, 0.35, 0.4);
    else alpha = clamp(Math.max(bump(b.age, 0, 0.05, 0.1), 0.85 * bump(b.age, 0.24, 0.05, 0.16)) * 1.1 + 0.25 * Math.exp(-b.age * 4));
    if (b.age > b.dur - 0.12) alpha *= (b.dur - b.age) / 0.12;
    if (alpha < 0.01) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 정지 장면은 크게 확대되므로 얇은 심지와 약한 빛무리만 그린다
    const passes = this.still ? [[1.1, 0.13, '190,180,255'], [0.5, 0.5, '235,228,255'], [0.27, 1, '255,255,255']] : [[6, 0.2, '180,170,255'], [2.6, 0.55, '230,222,255'], [1, 1, '255,255,255']];
    for (const pass of passes) {
      const [mul, am, col] = pass;
      ctx.strokeStyle = `rgba(${col},${(alpha * am).toFixed(3)})`;
      for (const seg of b.segs) {
        ctx.lineWidth = this.still ? Math.max(0.5, seg.width * mul) : Math.max(0.8, seg.width * (mul === 1 ? 0.8 : mul));
        ctx.beginPath();
        seg.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 번쩍임: 알파 최대 .35, 두 번 깜빡. 움직임 줄이기에서는 아예 켜지 않는다.
  flashLevel() {
    const b = this.bolt;
    if (!b || b.mini || this.reduced || this.still) return 0;
    return Math.max(bump(b.age, 0, 0.05, 0.09), 0.8 * bump(b.age, 0.24, 0.05, 0.14)) * (b.age < b.dur ? 1 : 0);
  }

  drawFlash(ctx, F) {
    const e = this.flashLevel();
    if (e < 0.01) return;
    ctx.fillStyle = `rgba(232,226,255,${(0.35 * e).toFixed(3)})`;
    ctx.fillRect(0, 0, F.w, F.h);
  }

  // 구름이 번개 불빛을 받아 환해진다 (구름 위에 덧칠)
  drawCloudGlow(ctx, F) {
    const b = this.bolt;
    const e = this.flashLevel();
    if (!b || e < 0.01) return;
    const R = F.w * 0.7;
    const g = ctx.createRadialGradient(b.ox, b.oy, 0, b.ox, b.oy, R);
    g.addColorStop(0, `rgba(235,228,255,${(0.42 * e).toFixed(3)})`);
    g.addColorStop(1, 'rgba(235,228,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, F.w, F.hillTop);
  }

  drawEffects(ctx, F) {
    for (const r of this.rings) {
      if (r.age < 0) continue;
      const k = r.age / r.life;
      ctx.strokeStyle = `rgba(214,236,255,${(0.75 * (1 - k) * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 2 * (1 - k) + 0.6;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 6 + k * 46, (6 + k * 46) * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.parts) {
      const k = p.age / p.life;
      if (p.kind === 'spark') {
        const a = (1 - k) * (0.6 + 0.4 * Math.sin(p.age * 18));
        ctx.fillStyle = css(p.color, clamp(a));
        sparklePath(ctx, p.x, p.y, p.r * (1 - k * 0.4));
      } else if (p.kind === 'flake') {
        ctx.globalAlpha = (1 - k) * 0.95;
        const d = p.r * 2.4;
        ctx.drawImage(this.snowSprite, p.x - d / 2, p.y - d / 2, d, d);
        ctx.globalAlpha = 1;
      } else if (p.kind === 'leaf') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + p.age * 3);
        ctx.fillStyle = css([110, 200, 110], (1 - k) * F.leafLight);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    this.drawBolt(ctx, F, true);
  }
}

