// 구름: 통통한 원을 겹친 윤곽을 오프스크린에 미리 그려 두고, 깊이 3겹과 천장 띠 2겹으로 흘려 보낸다.
// 색이 바뀌면(어두워짐, 밤) 스프라이트를 다시 그린다. ctx.filter는 쓰지 않는다.

import { clamp, css, makeCanvas, rng, smooth, lerp } from './util.js';

const SHAPE_W = [150, 200, 130, 230, 170, 190];
const SHAPE_H = [78, 98, 70, 112, 84, 92];

// 층: 작고 낮은 먼 구름 → 큰 가까운 구름. thr는 cloud 값이 이만큼 되면 나타나는 문턱이다.
const LAYERS = [
  { thr: [0.03, 0.18, 0.34, 0.52, 0.7], scale: [0.55, 0.75], y: [0.5, 0.8], speed: 4, alpha: 0.86 },
  { thr: [0.26, 0.3, 0.42, 0.6, 0.8], scale: [0.85, 1.1], y: [0.36, 0.66], speed: 8, alpha: 0.97 },
  { thr: [0.4, 0.5, 0.62, 0.76, 0.9], scale: [1.35, 1.7], y: [0.0, 0.3], speed: 14, alpha: 1 },
];

const FADE = 0.15;
const BAND_W = 560;
const BAND_H = 280;

// 구름은 "실루엣을 먼저 그리고 source-in으로 덩어리 전체에 그라데이션 한 벌"로 칠한다.
// 원마다 따로 칠하지 않으므로 안쪽에 원 테두리가 비치지 않는다.
function silhouette(g, circles, slab) {
  g.fillStyle = '#000';
  g.beginPath();
  for (const c of circles) {
    g.moveTo(c.x + c.r, c.y);
    g.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  }
  if (slab) g.rect(slab.x, slab.y, slab.w, slab.h);
  g.fill();
}

function paintBody(g, tone, x, top, w, bottom, shadeFrom, bigs) {
  g.globalCompositeOperation = 'source-in';
  const grad = g.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, css(tone.top));
  grad.addColorStop(0.5, css(tone.mid));
  grad.addColorStop(1, css(tone.bot));
  g.fillStyle = grad;
  g.fillRect(x - 20, top - 20, w + 40, bottom - top + 40);
  g.globalCompositeOperation = 'source-atop';
  // 위쪽에서 받는 부드러운 빛 (가장자리가 없는 번짐)
  for (const c of bigs) {
    const hl = g.createRadialGradient(c.x - c.r * 0.25, c.y - c.r * 0.45, 0, c.x - c.r * 0.25, c.y - c.r * 0.45, c.r * 0.75);
    hl.addColorStop(0, css(tone.hi, tone.hiA * 0.8));
    hl.addColorStop(1, css(tone.hi, 0));
    g.fillStyle = hl;
    g.fillRect(c.x - c.r * 1.2, c.y - c.r * 1.2, c.r * 2.4, c.r * 2.4);
  }
  const sh = g.createLinearGradient(0, shadeFrom, 0, bottom);
  sh.addColorStop(0, css(tone.shade, 0));
  sh.addColorStop(1, css(tone.shade, tone.shadeA));
  g.fillStyle = sh;
  g.fillRect(x - 20, top - 20, w + 40, bottom - top + 40);
}

function makePuff(shape, tone, pr) {
  const W = SHAPE_W[shape];
  const H = SHAPE_H[shape];
  const canvas = makeCanvas(W * pr, H * pr);
  const g = canvas.getContext('2d');
  g.scale(pr, pr);
  const r = rng(1000 + shape * 37);
  const base = H - 3;
  const n = 4 + (shape % 3);
  const pad = H * 0.2;
  const circles = [];
  for (let i = 0; i < n; i += 1) {
    const u = i / (n - 1);
    const end = i === 0 || i === n - 1;
    const hump = 0.45 + 0.55 * Math.sin(Math.PI * (0.1 + 0.8 * u));
    // 모든 원이 바닥에 닿아 있어 아래쪽이 둥글게 이어진다 (직선으로 잘린 모서리가 없다)
    const rad = ((base - 2) / 2) * (0.5 + 0.5 * hump) * (0.9 + r() * 0.2) * (end ? 0.72 : 1);
    circles.push({ x: pad + u * (W - 2 * pad) + (end ? 0 : (r() - 0.5) * 8), r: rad, y: base - rad });
  }
  const minX = Math.min(...circles.map((c) => c.x - c.r));
  const maxX = Math.max(...circles.map((c) => c.x + c.r));
  const top = Math.min(...circles.map((c) => c.y - c.r));
  const s = Math.min((W - 2) / (maxX - minX), (base - 2) / (base - top));
  g.translate(W / 2, base);
  g.scale(s, s);
  g.translate(-(minX + maxX) / 2, -base);
  const minR = Math.min(...circles.map((c) => c.r));
  silhouette(g, circles, { x: circles[0].x, y: base - minR * 1.3, w: circles[n - 1].x - circles[0].x, h: minR * 1.3 });
  const bigs = circles.filter((c) => c.r > H * 0.2);
  paintBody(g, tone, minX, top, maxX - minX, base, base - (base - top) * 0.5, bigs);
  return { canvas, w: W, h: H };
}

// 가로로 이어 붙는 천장 띠. 아래쪽 가장자리가 통통한 물결 모양이다.
function makeBand(variant, tone, pr) {
  const canvas = makeCanvas(BAND_W * pr, BAND_H * pr);
  const g = canvas.getContext('2d');
  g.scale(pr, pr);
  const r = rng(5000 + variant * 91);
  const n = 7;
  const all = [];
  for (let i = 0; i < n; i += 1) {
    const rad = 52 + r() * 26 + (variant ? 8 : 0);
    const x = (i + 0.5) * (BAND_W / n) + (r() - 0.5) * 18;
    const y = BAND_H - rad * (0.98 + r() * 0.5);
    for (const k of [-1, 0, 1]) all.push({ x: x + k * BAND_W, y, r: rad });
  }
  silhouette(g, all, { x: -4, y: 0, w: BAND_W + 8, h: BAND_H - 86 });
  const bigs = all.filter((c) => c.x > 0 && c.x < BAND_W);
  paintBody(g, tone, 0, BAND_H - 190, BAND_W, BAND_H, BAND_H - 120, bigs);
  return { canvas, w: BAND_W, h: BAND_H };
}

const overlaps = (c, p, pad) => p.x < c.x + c.w + pad && p.x + p.w > c.x - pad && p.y < c.y + c.h + pad && p.y + p.h > c.y - pad;

export class Clouds {
  constructor(pr) {
    this.pr = pr;
    this.key = '';
    this.puffs = [];
    this.bands = [];
    this.built = [];
    this.cursor = 0;
    this.now = 0;
    this.offsets = [0, 0, 0];
    this.bandOff = [0, 0];
    this.items = [];
    const r = rng(424242);
    LAYERS.forEach((layer, li) => {
      layer.thr.forEach((thr, i) => {
        const [s0, s1] = layer.scale;
        const [y0, y1] = layer.y;
        this.items.push({
          layer: li,
          shape: (li * 2 + i * 3 + 1) % SHAPE_W.length,
          thr,
          scale: s0 + r() * (s1 - s0),
          y: y0 + ((i + r() * 0.8) / layer.thr.length) * (y1 - y0),
          start: (0.12 + i * 0.23 + li * 0.07 + r() * 0.04) % 0.78,
          speedMul: 0.8 + r() * 0.5,
          ph: r() * 6.28,
          vis: 0, px: 0, pv: 0,
        });
      });
    });
  }

  setPixelRatio(pr) {
    if (pr === this.pr) return;
    this.pr = pr;
    this.built = [];
  }

  // 색이 바뀌면 스프라이트를 한 프레임에 한 장씩 돌아가며 최신 색으로 다시 그린다.
  // 대기열을 처음부터 다시 시작하지 않으므로 어느 스프라이트도 굶지 않고(띠 포함),
  // 모든 장이 몇 프레임 안에 같은 속도로 색을 따라가 한 프레임에 도약하지 않는다.
  retone(tone, now, force = false) {
    const key = [tone.top, tone.mid, tone.bot, tone.shade].map((c) => c.map((v) => Math.round(v / 4)).join(',')).join('|') + Math.round(tone.hiA * 12);
    this.key = key;
    this.tone = tone;
    this.now = now;
    const total = SHAPE_W.length + 2;
    const stale = (k) => this.built[k] !== key;
    if (force || !this.built.length) {
      this.built = new Array(total).fill(null);
      for (let k = 0; k < total; k += 1) this.build(k, tone, key);
      return;
    }
    // 띠(천장)가 가장 눈에 띄므로 먼저 확인한다
    const order = [SHAPE_W.length, SHAPE_W.length + 1, ...SHAPE_W.map((_, i) => i)];
    for (let i = 0; i < total; i += 1) {
      const k = order[(this.cursor + i) % total];
      if (stale(k)) {
        this.build(k, tone, key);
        this.cursor = (this.cursor + i + 1) % total;
        return;
      }
    }
  }

  // 새로 그린 장은 이전 장 위에 서서히 덧입혀져(FADE) 색이 계단 없이 이어진다
  build(k, tone, key) {
    const isPuff = k < SHAPE_W.length;
    const old = isPuff ? this.puffs[k] : this.bands[k - SHAPE_W.length];
    const sp = isPuff ? makePuff(k, tone, this.pr) : makeBand(k - SHAPE_W.length, tone, this.pr);
    if (old) old.prev = null;
    sp.prev = old ?? null;
    sp.born = this.now;
    if (isPuff) this.puffs[k] = sp;
    else this.bands[k - SHAPE_W.length] = sp;
    this.built[k] = key;
  }

  blit(ctx, sp, x, y, w, h, alpha) {
    const f = sp.prev ? clamp((this.now - sp.born) / FADE) : 1;
    if (f >= 1) {
      sp.prev = null;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sp.canvas, x, y, w, h);
      return;
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.prev.canvas, x, y, w, h);
    ctx.globalAlpha = alpha * f;
    ctx.drawImage(sp.canvas, x, y, w, h);
  }

  update(dt, F) {
    const speedK = 0.45 + F.p.wind * 1.7;
    for (let i = 0; i < 3; i += 1) this.offsets[i] += dt * LAYERS[i].speed * speedK;
    this.bandOff[0] += dt * 2.2 * speedK;
    this.bandOff[1] += dt * 4 * speedK;
    const cloud = F.p.cloud;
    for (const it of this.items) {
      const target = smooth(it.thr - 0.01, it.thr + 0.04, cloud);
      it.vis += (target - it.vis) * (1 - Math.exp(-dt / 0.55));
      // 눌려서 밀린 구름이 스프링처럼 돌아온다
      it.pv += (-22 * it.px - 5.5 * it.pv) * dt;
      it.px += it.pv * dt;
    }
  }

  // 눌린 곳 근처 구름을 바깥으로 민다
  push(F, x, y) {
    for (const it of this.items) {
      const p = this.place(it, F);
      if (!p) continue;
      const dx = p.x + p.w / 2 - x;
      const dy = p.y + p.h / 2 - y;
      const d = Math.hypot(dx, dy);
      if (d > 200) continue;
      it.pv += (dx >= 0 ? 1 : -1) * (1 - d / 200) * 160;
    }
  }

  place(it, F) {
    const sp = this.puffs[it.shape];
    if (!sp || it.vis < 0.01) return null;
    const w = sp.w * it.scale;
    const h = sp.h * it.scale;
    const period = F.w + w * 2;
    const raw = it.start * F.w + w + this.offsets[it.layer] * it.speedMul;
    let x = (((raw % period) + period) % period) - w;
    x += it.px - (1 - it.vis) * F.w * 0.35;
    const y = it.y * F.hillTop + Math.sin(F.t * 0.35 + it.ph) * 3 * it.scale - h * 0.2;
    return { x, y, w, h, sp };
  }

  drawLayers(ctx, F, from, to) {
    for (const it of this.items) {
      if (it.layer < from || it.layer > to) continue;
      const p = this.place(it, F);
      if (!p) continue;
      if (F.clear && F.p.dark < 0.5 && overlaps(F.clear, p, 14)) continue;
      this.blit(ctx, p.sp, p.x, p.y, p.w, p.h, LAYERS[it.layer].alpha * clamp(it.vis) * F.cloudAlpha);
    }
    ctx.globalAlpha = 1;
  }

  drawBand(ctx, F, which) {
    const b = this.bands[which];
    if (!b) return;
    const cover = smooth(which ? 0.35 : 0.3, 1, F.p.cloud);
    let bottom = which ? lerp(-0.16, 0.4, cover) * F.hillTop : lerp(-0.1, 0.5, cover) * F.hillTop;
    // 카드 제목 자리에는 밝은 구름 천장이 내려오지 않는다
    if (F.clear && F.p.dark < 0.5) bottom = Math.min(bottom, F.clear.y - 6);
    if (bottom < -b.h * 0.2) return;
    const scale = which ? 1.25 : 1;
    const bw = b.w * scale;
    const bh = b.h * scale;
    const off = ((this.bandOff[which] % bw) + bw) % bw;
    const y = bottom - bh;
    const a = (which ? 1 : 0.92) * F.cloudAlpha;
    for (let x = -off - bw; x < F.w + bw; x += bw) this.blit(ctx, b, x, y, bw + 0.5, bh, a);
    ctx.globalAlpha = 1;
  }
}
