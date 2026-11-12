// 언덕, 풀잎, 나무, 꽃. 언덕 곡선은 surfaceY로 한곳에서 정한다.

import { WEATHERS } from '../weather.js';
import { clamp, css, easeOutBack, hashStr, lerp, mixc, mulc, rng, smooth } from './util.js';

// 가까운 언덕의 윗선. 꼭대기가 화면 높이의 약 62%(작은 화면에서는 UI 위)에 온다.
export function nearY(L, x) {
  const u = x / L.w;
  const k = u < 0.5 ? 0.05 : 0.072;
  return L.hillTop + L.h * k * Math.pow(Math.abs(u - 0.5) * 2, 1.6) + L.h * 0.004 * Math.sin(u * 9 + 1);
}

const bump = (x) => Math.exp(-x * x);
const farAY = (L, x) => {
  const u = x / L.w;
  return L.hillTop - L.h * (0.02 + 0.118 * bump((u - 0.82) / 0.36) + 0.052 * bump((u - 0.1) / 0.3));
};
const farBY = (L, x) => {
  const u = x / L.w;
  return L.hillTop + L.h * (0.012 - 0.07 * bump((u - 0.14) / 0.3) - 0.036 * bump((u - 0.93) / 0.24));
};

function fillHill(ctx, L, fn, top, bottom, step = 6) {
  ctx.beginPath();
  ctx.moveTo(-8, L.h * 2);
  for (let x = -8; x <= L.w + 8 + step; x += step) ctx.lineTo(x, fn(L, x));
  ctx.lineTo(L.w + 14, L.h * 2);
  ctx.closePath();
  const y0 = fn(L, L.w * 0.5) - L.h * 0.12;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + L.h * 0.42);
  g.addColorStop(0, css(top));
  g.addColorStop(1, css(bottom));
  ctx.fillStyle = g;
  ctx.fill();
}

function strokeCrest(ctx, L, fn, offset, width, color, step = 6) {
  ctx.beginPath();
  for (let x = -8; x <= L.w + 8 + step; x += step) {
    const y = fn(L, x) + offset;
    if (x === -8) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// 나무 잎 뭉치: [x, y, 반지름, 나타나는 성장값]
const BLOBS = [
  [0, -46, 16, -0.6], [-12, -39, 11.5, -0.3], [12, -40, 12, 0],
  [-8, -58, 12, 1.0], [9, -57, 12.5, 1.1], [0, -67, 11, 1.4],
  [-21, -48, 10, 2.0], [21, -49, 10.5, 2.1], [-15, -69, 9.5, 2.4], [16, -70, 9.5, 2.5],
  [0, -80, 9.5, 3.0], [-27, -59, 8.5, 3.1], [28, -60, 8.5, 3.2],
];

export function growthFor(total) {
  if (total < 7) return 0.35 + (total / 7) * 0.6;
  if (total < 30) return 1 + ((total - 7) / 23) * 0.95;
  if (total < 100) return 2 + ((total - 30) / 70) * 0.95;
  return 3 + Math.min(1, (total - 100) / 150);
}

export class Terrain {
  constructor(reducedMotion) {
    this.reduced = reducedMotion;
    const r = rng(777);
    this.tufts = Array.from({ length: 22 }, () => ({ u: 0.02 + r() * 0.96, h: 5 + r() * 5, ph: r() * 6.28, dy: r() * 3 }));
    this.treePush = 0;
    this.treeVel = 0;
    this.growth = 0.35;
    this.growthTarget = 0.35;
    this.flowers = new Map();
    this.dying = [];
    this.gardenSeen = false;
  }

  update(dt) {
    this.treeVel += (-30 * this.treePush - 3.2 * this.treeVel) * dt;
    this.treePush += this.treeVel * dt;
    this.growth += (this.growthTarget - this.growth) * (1 - Math.exp(-dt / 0.9));
    for (const d of this.dying) d.age += dt;
    this.dying = this.dying.filter((d) => d.age < 0.45);
  }

  shakeTree() {
    this.treeVel += (Math.random() < 0.5 ? -1 : 1) * 1.6;
  }

  setGarden(garden, now) {
    const list = garden?.flowers ?? [];
    this.growthTarget = growthFor(garden?.total ?? list.length);
    if (!this.gardenSeen) this.growth = this.growthTarget;
    const next = new Map();
    for (const f of list) {
      const prev = this.flowers.get(f.date);
      if (prev) {
        prev.weather = f.weather;
        next.set(f.date, prev);
        continue;
      }
      const r = rng(hashStr(f.date));
      next.set(f.date, {
        date: f.date, weather: f.weather, u: 0.025 + r() * 0.95, v: Math.pow(r(), 1.3), ph: r() * 6.28, tint: 0.9 + r() * 0.2,
        born: this.gardenSeen ? now : -10,
      });
    }
    for (const [date, f] of this.flowers) if (!next.has(date)) this.dying.push({ ...f, age: 0 });
    this.flowers = next;
    this.gardenSeen = true;
  }

  // 방금 피어난 꽃 위치들 (톡 하고 피는 순간 반짝이를 위해)
  bornAt(now) {
    return [...this.flowers.values()].filter((f) => f.born > now - 0.03 && f.born <= now);
  }

  drawFar(ctx, L, F) {
    const haze = mixc(F.sky[2], F.sky[1], 0.55);
    const farA = mixc(F.hillFar, haze, 0.3);
    const farB = mixc(F.hillFar, haze, 0.12);
    ctx.save();
    ctx.translate(0, F.camShift * 0.86);
    fillHill(ctx, L, farAY, farA, mixc(farA, haze, 0.35));
    ctx.restore();
    ctx.save();
    ctx.translate(0, F.camShift * 0.93);
    fillHill(ctx, L, farBY, farB, mixc(farB, haze, 0.3));
    ctx.restore();
  }

  drawNear(ctx, L, F) {
    const top = F.hillTopC;
    const bot = F.hillBotC;
    fillHill(ctx, L, nearY, top, bot, 5);
    // 부드러운 풀밭 결
    const dark = mixc(top, bot, 0.9);
    strokeCrest(ctx, L, nearY, 20, 15, css(dark, 0.1));
    strokeCrest(ctx, L, nearY, 44, 20, css(dark, 0.08));
    // 윗선에 들어오는 빛
    strokeCrest(ctx, L, nearY, 1.2, 2.4, css(mixc(top, [255, 255, 255], 0.38), 0.7));
    if (F.p.snowCover > 0.02) {
      strokeCrest(ctx, L, nearY, 1.5, 5 * F.p.snowCover, css(mulc([255, 255, 255], F.amb), 0.9 * F.p.snowCover));
    }
    // 풀잎
    const sway = F.reduced ? 0.25 : 1;
    // 눈이 쌓이면 풀이 덮여 사라진다
    const grass = 1 - smooth(0.05, 0.85, F.p.snowCover);
    ctx.fillStyle = css(mixc(top, bot, 0.78), 0.95 * grass);
    if (grass > 0.01) for (const tu of this.tufts) {
      const x = tu.u * L.w;
      const y = nearY(L, x) + 1.5 + tu.dy;
      const s = Math.sin(F.t * 1.7 + tu.ph) * (1 + F.p.wind * 3) * sway;
      for (let b = -1; b <= 1; b += 1) {
        const bx = x + b * 2.6;
        const lean = b * 2.2 + s * 0.6;
        ctx.beginPath();
        ctx.moveTo(bx - 1.2, y);
        ctx.quadraticCurveTo(bx + lean * 0.4, y - tu.h * 0.6, bx + lean + s * 0.4, y - tu.h * (b ? 0.8 : 1));
        ctx.quadraticCurveTo(bx + lean * 0.5 + 0.6, y - tu.h * 0.5, bx + 1.2, y);
        ctx.fill();
      }
    }
  }

  // 꽃은 날짜로 정해진 자리에 핀다
  drawFlowers(ctx, L, F, now) {
    const keepOut = [[F.px, 24], [F.tx, 14], [F.lx, 10], [F.sx, 14]];
    // 꽃은 언덕 표면과 한계선(오늘 화면에서는 메모 칸 위) 사이에만 심는다.
    const limit = F.gardenLimit;
    let xl = L.w * 0.025;
    let xr = L.w * 0.975;
    if (limit != null) {
      // 한계선 위로 드러나는 언덕 구간 안에서만 심는다
      const ok = [];
      for (let x = 0; x <= L.w; x += 4) if (nearY(L, x) < limit - 8) ok.push(x);
      if (ok.length > 4) { xl = Math.max(xl, ok[0] + 4); xr = Math.min(xr, ok[ok.length - 1] - 4); }
    }
    const list = [...this.flowers.values(), ...this.dying.map((d) => ({ ...d, dead: true }))];
    const items = list.map((f) => {
      let x = lerp(xl, xr, (f.u - 0.025) / 0.95);
      const room = limit == null ? L.h * 0.15 : Math.max(2, limit - 6 - nearY(L, x));
      let depth = 2 + f.v * (room - 2);
      for (const [cx, half] of keepOut) {
        if (Math.abs(x - cx) < half && depth < 22) {
          if (depth + 22 <= room) depth += 22;
          else x = cx + (x >= cx ? half : -half);
        }
      }
      return { f, x, depth };
    }).sort((a, b) => a.depth - b.depth);
    for (const { f, x, depth } of items) {
      let k;
      if (f.dead) k = 1 - smooth(0, 0.45, f.age);
      else k = easeOutBack((now - f.born) / 0.75, 2.1);
      if (k <= 0.01) continue;
      const y = nearY(L, x) + depth;
      const size = (1 + f.v * 0.6) * f.tint;
      const sway = Math.sin(F.t * 1.8 + f.ph) * (1 + F.p.wind * 3.5) * (F.reduced ? 0.25 : 1);
      this.flower(ctx, F, x, y, size * k, f.weather, sway, k, f.ph);
      if (!f.dead && now - f.born < 0.6 && now >= f.born) {
        const rk = (now - f.born) / 0.6;
        ctx.strokeStyle = `rgba(255,255,255,${(0.7 * (1 - rk)).toFixed(3)})`;
        ctx.lineWidth = 1.6 * (1 - rk) + 0.4;
        ctx.beginPath();
        ctx.arc(x + sway * 0.4, y - 9 * size, 5 + rk * 17, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  flower(ctx, F, x, y, s, id, sway, grow, ph) {
    const info = WEATHERS[id];
    if (!info) return;
    const base = mulc(F.flowerRGB(id), F.ambSoft);
    const stemH = 9 * s * Math.min(1, grow * 1.2);
    const hx = x + sway * 0.5;
    const hy = y - stemH;
    ctx.strokeStyle = css(mulc([84, 168, 92], F.amb), 0.95);
    ctx.lineWidth = 1.4 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 0.1, y - stemH * 0.5, hx, hy);
    ctx.stroke();
    const leafC = css(mulc([96, 190, 104], F.amb), 0.95);
    ctx.fillStyle = leafC;
    ctx.beginPath();
    ctx.ellipse(x + 2.2 * s, y - stemH * 0.35, 2.6 * s, 1.1 * s, -0.5, 0, Math.PI * 2);
    ctx.fill();

    const shape = { sunny: [9, 2.9, 1.9], cloudy: [5, 2.6, 2.3], rain: [5, 2.6, 2.1], thunder: [6, 2.8, 1.9], snow: [6, 2.7, 1.7], rainbow: [5, 2.7, 2.3] }[id];
    const [n, ring, pr] = shape;
    const edge = css(mixc(base, [60, 40, 90], 0.3), 0.55);
    ctx.lineWidth = 0.7;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + ph;
      const px = hx + Math.cos(a) * ring * s;
      const py = hy + Math.sin(a) * ring * s;
      ctx.fillStyle = css(mixc(base, [255, 255, 255], i % 2 ? 0.0 : 0.16));
      ctx.beginPath();
      ctx.arc(px, py, pr * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.stroke();
    }
    const centers = { sunny: [201, 118, 40], snow: [255, 236, 150], rain: [255, 245, 200], thunder: [255, 226, 110], cloudy: [255, 244, 214], rainbow: [255, 230, 120] };
    ctx.fillStyle = css(mulc(centers[id], F.ambSoft));
    ctx.beginPath();
    ctx.arc(hx, hy, (id === 'sunny' ? 2.4 : 1.7) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTree(ctx, L, F) {
    const x = F.tx;
    const y = nearY(L, x) + 3;
    const g = this.growth;
    const sc = 0.5 + 0.22 * Math.min(g, 3.4);
    const wind = 0.35 + F.p.wind * 1.6;
    const mot = F.reduced ? 0.3 : 1;
    const ang = (Math.sin(F.t * 0.9 + 0.5) * 0.9 + Math.sin(F.t * 1.9) * 0.35) * 0.018 * wind * mot + this.treePush * 0.05;
    const trunkW = lerp(0.62, 1, clamp(g / 2));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(sc, sc);

    // 줄기
    const trunkTop = -40;
    const t1 = css(mulc([150, 104, 78], F.amb));
    const t2 = css(mulc([108, 72, 60], F.amb));
    const tg = ctx.createLinearGradient(-5, 0, 5, 0);
    tg.addColorStop(0, t1);
    tg.addColorStop(1, t2);
    ctx.fillStyle = tg;
    const bw = 5.2 * trunkW;
    const tw = 3.2 * trunkW;
    ctx.beginPath();
    ctx.moveTo(-bw - 1.6, 0);
    ctx.quadraticCurveTo(-bw * 0.6, -14, -tw, trunkTop);
    ctx.lineTo(tw, trunkTop);
    ctx.quadraticCurveTo(bw * 0.6, -14, bw + 1.6, 0);
    ctx.closePath();
    ctx.fill();
    if (g > 1.2) {
      ctx.strokeStyle = t2;
      ctx.lineWidth = 2.2 * trunkW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(-8, -42);
      ctx.moveTo(0, -32);
      ctx.lineTo(8, -43);
      ctx.stroke();
    }

    // 잎 뭉치
    const light = mixc(mulc([172, 238, 140], F.amb), [235, 245, 255], F.p.snowCover * 0.12);
    const mid = mixc(mulc([96, 198, 118], F.amb), [190, 214, 230], F.p.snowCover * 0.1);
    const deep = mulc([44, 146, 96], F.amb);
    const order = BLOBS.map((b, i) => [b, i]).sort((a, b) => a[0][1] - b[0][1]);
    for (const [b, i] of order) {
      const k = easeOutBack((g - b[3]) / 0.55, 1.5);
      if (k <= 0.01) continue;
      const r = b[2] * k;
      const bx = b[0] + Math.sin(F.t * 1.3 + i * 0.9) * 0.7 * wind * mot;
      const by = b[1] + Math.sin(F.t * 1.1 + i * 1.3) * 0.5 * mot;
      const rg = ctx.createRadialGradient(bx - r * 0.32, by - r * 0.4, r * 0.1, bx, by, r * 1.12);
      rg.addColorStop(0, css(light));
      rg.addColorStop(0.55, css(mid));
      rg.addColorStop(1, css(deep));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
      if (F.p.snowCover > 0.03) this.snowCap(ctx, bx, by, r, F.p.snowCover);
    }
    // 가장 풍성한 나무에는 작은 꽃잎이 핀다
    if (g > 3.15) {
      const a = clamp((g - 3.15) / 0.8);
      const dots = [[-14, -52], [7, -62], [17, -44], [-4, -74], [-22, -62], [24, -62], [2, -50]];
      dots.forEach(([dx, dy], i) => {
        ctx.fillStyle = `rgba(255,${i % 2 ? 214 : 190},${i % 2 ? 224 : 210},${(0.95 * a).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(dx, dy, 2 + (i % 3) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  snowCap(ctx, x, y, r, amount) {
    ctx.fillStyle = `rgba(255,255,255,${(0.96 * amount).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.99, Math.PI * 1.17, Math.PI * 1.83);
    const w = Math.cos(Math.PI * 1.83) * r;
    ctx.quadraticCurveTo(x + w * 0.5, y - r * 0.5, x + w * 0.62, y - r * 0.52);
    ctx.quadraticCurveTo(x + w * 0.2, y - r * 0.42, x, y - r * 0.5);
    ctx.quadraticCurveTo(x - w * 0.4, y - r * 0.4, x - w * 0.62, y - r * 0.52);
    ctx.closePath();
    ctx.fill();
  }
}
