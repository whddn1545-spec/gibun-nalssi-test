// 나의 작은 하늘: 날씨 값들이 부드럽게 이어지는 Canvas 장면.
// 모든 좌표는 장면 크기에 비례하므로 앱 화면과 공유 카드에서 같은 그림을 그릴 수 있다.

import { TAU, clamp, lerp, smoothstep, rng, hash, prefersReducedMotion } from './util.js';
import { W as WEATHER } from './weather.js';

/* ── 색 (OKLab에서 섞어야 파랑→보라 전환이 탁해지지 않는다) ─────────────── */
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function lab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = toLin(((n >> 16) & 255) / 255);
  const g = toLin(((n >> 8) & 255) / 255);
  const b = toLin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function css(c, alpha = 1) {
  const l = (c[0] + 0.3963377774 * c[1] + 0.2158037573 * c[2]) ** 3;
  const m = (c[0] - 0.1055613458 * c[1] - 0.0638541728 * c[2]) ** 3;
  const s = (c[0] - 0.0894841775 * c[1] - 1.291485548 * c[2]) ** 3;
  const ch = (v) => Math.round(clamp(toSrgb(clamp(v))) * 255);
  const r = ch(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = ch(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const b = ch(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
}

const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const stops = (arr) => arr.map(lab);

/* ── 날씨 설정 ──────────────────────────────────────────────────────────── */
const PRESET = {
  none: {
    day: stops(['#7DB7E8', '#ABD3F0', '#DCEBF3', '#FBF0DF']),
    night: stops(['#0B1236', '#172358', '#2C3B7A', '#566199']),
    sun: 0.75, cloud: 0.24, dark: 0, rain: 0, snow: 0, fog: 0, wind: 0.1, bow: 0, bolt: 0, cover: 0, over: 0.12,
  },
  clear: {
    day: stops(['#1F7FE8', '#4FAAF6', '#A2DAFB', '#FFF0D2']),
    night: stops(['#08103A', '#142460', '#2B4088', '#5C69A8']),
    sun: 1, cloud: 0.2, dark: 0, rain: 0, snow: 0, fog: 0, wind: 0.08, bow: 0, bolt: 0, cover: 0, over: 0,
  },
  rainbow: {
    day: stops(['#3AA0F5', '#74C5FA', '#BEE9F6', '#FFE4EC']),
    night: stops(['#0D1342', '#1F2B6B', '#404A90', '#786FB0']),
    sun: 0.8, cloud: 0.32, dark: 0, rain: 0, snow: 0, fog: 0, wind: 0.08, bow: 1, bolt: 0, cover: 0, over: 0,
  },
  cloud: {
    day: stops(['#7492B5', '#9DB4CC', '#C8D5E2', '#EFEAE2']),
    night: stops(['#121A36', '#212B4D', '#394567', '#5B6583']),
    sun: 0.22, cloud: 0.96, dark: 0.16, rain: 0, snow: 0, fog: 0, wind: 0.16, bow: 0, bolt: 0, cover: 0, over: 0.55,
  },
  snow: {
    day: stops(['#86A2CC', '#AFC4E2', '#D6E1F1', '#F5F2F3']),
    night: stops(['#121B3E', '#24325C', '#3F4F7D', '#6D7BA2']),
    sun: 0.14, cloud: 0.62, dark: 0.1, rain: 0, snow: 1, fog: 0, wind: 0.1, bow: 0, bolt: 0, cover: 1, over: 0.4,
  },
  wind: {
    day: stops(['#4F9FD6', '#83C2E4', '#BAE0EE', '#F1F4E2']),
    night: stops(['#0D183C', '#1B2D5A', '#334A76', '#5A6E94']),
    sun: 0.62, cloud: 0.56, dark: 0.02, rain: 0, snow: 0, fog: 0, wind: 1, bow: 0, bolt: 0, cover: 0, over: 0.14,
  },
  fog: {
    day: stops(['#A5B2BD', '#C2CCD3', '#DCE1E4', '#EFEFEA']),
    night: stops(['#191F31', '#2D3648', '#484F61', '#6A707C']),
    sun: 0.3, cloud: 0.02, dark: 0.04, rain: 0, snow: 0, fog: 1, wind: 0.06, bow: 0, bolt: 0, cover: 0, over: 0.62,
  },
  rain: {
    day: stops(['#3B5575', '#587494', '#8096AE', '#B2BECA']),
    night: stops(['#0C1324', '#182236', '#2B3950', '#47566B']),
    sun: 0, cloud: 1, dark: 0.72, rain: 0.74, snow: 0, fog: 0.12, wind: 0.26, bow: 0, bolt: 0, cover: 0, over: 0.86,
  },
  thunder: {
    day: stops(['#201C42', '#393260', '#5E5480', '#8F7D9B']),
    night: stops(['#090819', '#15122C', '#292345', '#483C64']),
    sun: 0, cloud: 1, dark: 1, rain: 1, snow: 0, fog: 0.08, wind: 0.62, bow: 0, bolt: 1, cover: 0, over: 1,
  },
};

const NUM_KEYS = ['sun', 'cloud', 'dark', 'rain', 'snow', 'fog', 'wind', 'bow', 'bolt', 'cover', 'over'];

const SEASON = {
  spring: { near: ['#AEE08E', '#7AC17E'], mid: ['#88CFA1', '#68B38E'], far: '#9FD1C2', crown: ['#FFC6D8', '#F5A3BF'], leaf: '#FFC6D8' },
  summer: { near: ['#86D27F', '#52AB6A'], mid: ['#65BC8A', '#49A17A'], far: '#83C4B3', crown: ['#60BE7B', '#3D9A62'], leaf: '#8FD48A' },
  autumn: { near: ['#F1D07C', '#D9A55C'], mid: ['#E8B070', '#CB8D56'], far: '#DEB794', crown: ['#F8AB4F', '#E2723B'], leaf: '#F5A64E' },
  winter: { near: ['#BBC9B6', '#95A99C'], mid: ['#A7B7B2', '#879B9A'], far: '#B6C4C6', crown: ['#A2B7AA', '#7F978A'], leaf: '#DFE8EA' },
};
for (const s of Object.values(SEASON)) {
  s.near = s.near.map(lab);
  s.mid = s.mid.map(lab);
  s.far = lab(s.far);
  s.crown = s.crown.map(lab);
}

export const seasonOf = (d) => {
  const m = d.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
};

const C = {
  night: lab('#1A2346'),
  nightLand: lab('#16224A'),
  stormLand: lab('#2E3350'),
  overcast: lab('#7C8C95'),
  snow: lab('#FCFDFF'),
  snowShade: lab('#D4E0F1'),
  snowNight: lab('#AEBBD8'),
  snowNightShade: lab('#7E8DB2'),
  warmHill: lab('#E7A06C'),
  wall: lab('#FFF8EC'),
  wallShade: lab('#EADFCF'),
  roof: lab('#E9795B'),
  roofShade: lab('#C9604A'),
  door: lab('#8D5C46'),
  chimney: lab('#B66A52'),
  glassDay: lab('#A5D9F2'),
  glassWarm: lab('#FFD889'),
  trunk: lab('#8A6448'),
  warmSky: [lab('#5A62A8'), lab('#C893BC'), lab('#FFB084'), lab('#FF9860')],
};

/* ── 하루의 시간 ────────────────────────────────────────────────────────── */
export function timeOfDay(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  const night = 1 - smoothstep(5, 7, h) * (1 - smoothstep(18.2, 20, h));
  const warm = Math.max(1 - Math.abs(h - 18) / 1.8, 1 - Math.abs(h - 6.4) / 1.3, 0);
  const p = clamp((h - 6) / 13);
  return {
    hour: h,
    night,
    warm: smoothstep(0, 1, warm),
    sunX: lerp(0.24, 0.76, p),
    sunY: 0.66 - 0.48 * Math.sin(p * Math.PI),
  };
}

export const DAYLIGHT = { hour: 12, night: 0, warm: 0, sunX: 0.68, sunY: 0.2 };

/* ── 지형 ───────────────────────────────────────────────────────────────── */
const HILLS = [
  { b: 0.71, a: 0.028, f: 5.4, p: 1.2, a2: 0.011, f2: 12.3, p2: 0.3 },
  { b: 0.775, a: 0.032, f: 4.2, p: 3.3, a2: 0.012, f2: 9.1, p2: 2.1 },
  { b: 0.85, a: 0.024, f: 3.1, p: 4.6, a2: 0.008, f2: 7.4, p2: 1.3, bump: 0.05 },
];
const HOUSE_X = 0.645;
const TREE_X = 0.26;

function hillY(i, nx) {
  const h = HILLS[i];
  let y = h.b + h.a * Math.sin(nx * h.f + h.p) + h.a2 * Math.sin(nx * h.f2 + h.p2);
  if (h.bump) y -= h.bump * Math.exp(-(((nx - HOUSE_X) / 0.26) ** 2));
  return y;
}

/* ── 스프라이트 ─────────────────────────────────────────────────────────── */
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

const CLOUD_TONES = {
  light: { top: '#FFFFFF', bot: '#EDF3FA', shade: '148,176,212', shadeA: 0.5, hi: 0.7 },
  dusk: { top: '#FFE8D8', bot: '#F7BFAE', shade: '204,112,134', shadeA: 0.55, hi: 0.5 },
  storm: { top: '#6F7993', bot: '#454C64', shade: '24,28,50', shadeA: 0.62, hi: 0.12 },
  night: { top: '#454F7C', bot: '#2B3358', shade: '12,16,38', shadeA: 0.55, hi: 0.12 },
};

function cloudSprite(w, h, seed, tone) {
  const c = mk(w, h);
  const g = c.getContext('2d');
  const R = rng(seed);
  const base = h * 0.74;
  const n = 5 + Math.floor(R() * 2);
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const bell = Math.sin(u * Math.PI);
    const r = h * (0.14 + 0.25 * bell * (0.78 + R() * 0.36));
    puffs.push({ x: w * (0.17 + 0.66 * u) + (R() - 0.5) * w * 0.03, y: base - r * 0.62, r });
  }
  const path = new Path2D();
  const add = (x, y, r) => {
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, TAU);
  };
  puffs.forEach((p) => add(p.x, p.y, p.r));
  // 아래쪽도 몽글몽글하게
  const m = 7;
  for (let i = 0; i < m; i++) {
    const u = i / (m - 1);
    add(w * (0.21 + 0.58 * u), base + Math.sin(u * Math.PI) * h * 0.035 - h * 0.012, h * (0.082 + R() * 0.035));
  }
  path.moveTo(w * 0.86, base - h * 0.06);
  path.ellipse(w / 2, base - h * 0.06, w * 0.36, h * 0.17, 0, 0, TAU);

  const body = g.createLinearGradient(0, h * 0.12, 0, base + h * 0.14);
  body.addColorStop(0, tone.top);
  body.addColorStop(1, tone.bot);
  g.fillStyle = body;
  g.fill(path);

  g.save();
  g.clip(path);
  for (const p of puffs) {
    const hl = g.createRadialGradient(p.x - p.r * 0.28, p.y - p.r * 0.42, 0, p.x - p.r * 0.28, p.y - p.r * 0.42, p.r * 1.05);
    hl.addColorStop(0, `rgba(255,255,255,${tone.hi})`);
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.fillRect(p.x - p.r * 1.5, p.y - p.r * 1.5, p.r * 3, p.r * 3);
  }
  // 투명 쪽도 같은 색이어야 중간에 회색 띠가 생기지 않는다
  const under = g.createLinearGradient(0, base - h * 0.32, 0, base + h * 0.16);
  under.addColorStop(0, `rgba(${tone.shade},0)`);
  under.addColorStop(1, `rgba(${tone.shade},${tone.shadeA})`);
  g.fillStyle = under;
  g.fillRect(0, 0, w, h);
  g.restore();
  return c;
}

function fogSprite(w, h, seed, color) {
  const c = mk(w, h);
  const g = c.getContext('2d');
  const R = rng(seed);
  for (let i = 0; i < 26; i++) {
    const x = R() * w;
    const y = h * (0.35 + R() * 0.3);
    const rx = w * (0.08 + R() * 0.13);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${color},.42)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    // 가장자리에 걸린 덩어리를 반대쪽에도 그려 이어 붙일 때 세로 줄이 생기지 않게 한다
    for (const ox of [-w, 0, w]) {
      g.save();
      g.translate(x + ox, y);
      g.scale(rx, h * 0.3);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, 1, 0, TAU);
      g.fill();
      g.restore();
    }
  }
  return c;
}

function dotSprite(size) {
  const c = mk(size, size);
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/* 무지개는 넓은 띠를 겹쳐서 가장자리를 부드럽게 만들어 둔다 */
const BOW_COLORS = ['#FF7C86', '#FFB067', '#FFE27C', '#8FE39A', '#74CEF5', '#8B9DF6', '#C592EE'];
function rainbowSprite(size, band) {
  const c = mk(size, size / 2 + band);
  const g = c.getContext('2d');
  g.lineCap = 'butt';
  const cx = size / 2;
  const cy = size / 2;
  BOW_COLORS.forEach((col, i) => {
    const r = size / 2 - band * (i + 0.5);
    g.strokeStyle = col;
    for (const [lw, a] of [[band * 1.9, 0.12], [band * 1.3, 0.24], [band * 0.85, 0.66]]) {
      g.globalAlpha = a;
      g.lineWidth = lw;
      g.beginPath();
      g.arc(cx, cy, r, Math.PI, TAU);
      g.stroke();
    }
  });
  return c;
}

/* ── 장면 ───────────────────────────────────────────────────────────────── */
const CLOUD_DEFS = [
  // x, y, 크기, 깊이, 나타나는 구름량
  [0.16, 0.22, 0.6, 0.3, 0.05],
  [0.74, 0.31, 0.48, 0.22, 0.13],
  [0.46, 0.13, 0.76, 0.6, 0.27],
  [0.9, 0.17, 0.62, 0.42, 0.38],
  [0.06, 0.41, 0.5, 0.26, 0.46],
  [0.6, 0.45, 0.66, 0.5, 0.52],
  [0.3, 0.31, 0.95, 0.8, 0.6],
  [0.82, 0.08, 1.15, 0.92, 0.68],
  [0.12, 0.05, 1.3, 1, 0.76],
  [0.5, 0.0, 1.45, 1.12, 0.82],
  [0.96, 0.27, 1.0, 0.86, 0.88],
  [0.2, 0.2, 1.2, 0.95, 0.92],
];

const FLOWER_MAX = 64;
const MAX = { rain: 170, snow: 120, leaves: 16, gust: 7 };

export class SkyScene {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.g = canvas.getContext('2d', { alpha: false });
    this.opts = { maxDpr: 2.5, seed: 11, still: false, onFlash: null, ...opts };
    this.reduced = prefersReducedMotion();
    this.R = rng(this.opts.seed);
    this.t = 0;
    this.last = 0;
    this.raf = 0;
    this.running = false;
    this.W = 0;
    this.H = 0;
    this.quality = 1;
    this.dpr = 1;
    this._slow = 0;
    this._frames = 0;

    this.weather = null;
    this.date = opts.date || new Date();
    this.todOverride = opts.tod || null;
    this.tod = this.todOverride || timeOfDay(this.date);
    this.season = SEASON[seasonOf(this.date)];
    this.growth = 0.5;
    this.growthTarget = 0.5;

    this.cur = null;
    this.flowers = [];
    this.splash = [];
    this.sparks = [];
    this.smoke = [];
    this.nextBolt = 2;
    this.boltFx = null;
    this.flash = 0;
    this.birds = null;
    this.nextBirds = 4;
    this.pulse = 0;

    this._seedParticles();
    this._loop = this._loop.bind(this);
  }

  _seedParticles() {
    const R = this.R;
    this.clouds = CLOUD_DEFS.map(([x, y, s, d, th], i) => ({
      x, y, s, d, th, push: 0, sp: i % 3, a: 0,
    }));
    this.drops = Array.from({ length: MAX.rain }, () => ({
      x: R() * 1.3 - 0.15, y: R() * 1.1, v: 1.05 + R() * 0.7, z: Math.floor(R() * 3), len: 0.6 + R() * 0.6, g: R() * 0.125,
    }));
    this.flakes = Array.from({ length: MAX.snow }, () => ({
      x: R(), y: R() * 1.05, v: 0.05 + R() * 0.1, r: 1 + R() * R() * 3, ph: R() * TAU, f: 0.5 + R() * 1.1, a: 0.5 + R() * 0.5,
    }));
    this.leaves = Array.from({ length: MAX.leaves }, () => ({
      x: R() * 1.4 - 0.2, y: 0.25 + R() * 0.6, v: 0.32 + R() * 0.32, ph: R() * TAU, s: 0.7 + R() * 0.7, rot: R() * TAU, spin: 2 + R() * 4,
    }));
    this.gusts = Array.from({ length: MAX.gust }, (_, i) => ({
      x: R() * 1.4 - 0.4, y: 0.12 + (i / MAX.gust) * 0.6 + R() * 0.06, len: 0.3 + R() * 0.28, v: 0.45 + R() * 0.3, curl: R() < 0.55, ph: R() * TAU,
    }));
    this.stars = Array.from({ length: 80 }, () => ({
      x: R(), y: R() * 0.66, r: 0.45 + R() * R() * 1.2, ph: R() * TAU, f: 0.6 + R() * 2,
    }));
    this.fogBands = [
      { y: 0.66, s: 0.012, x: R(), h: 0.44, z: 0, a: 0.95 },
      { y: 0.76, s: 0.02, x: R(), h: 0.42, z: 1, a: 0.95 },
      { y: 0.9, s: 0.03, x: R(), h: 0.34, z: 2, a: 0.7 },
    ];
    this.miniTrees = Array.from({ length: 11 }, () => ({ x: R(), s: 0.7 + R() * 0.7, d: 0.2 + R() * 0.35 }));
    this.tufts = Array.from({ length: 26 }, () => ({ x: R(), d: 0.012 + R() * 0.11, h: 3.4 + R() * 3.4 }));
  }

  /* ── 크기 ──────────────────────────────────────────────────────────── */
  resize(w, h, dpr) {
    const cssW = w ?? this.c.clientWidth;
    const cssH = h ?? this.c.clientHeight;
    if (!cssW || !cssH) return;
    const useDpr = Math.max(1, Math.min(this.opts.maxDpr, dpr ?? (window.devicePixelRatio || 1)) * this.quality);
    if (cssW === this.W && cssH === this.H && useDpr === this.dpr) return;
    this.W = cssW;
    this.H = cssH;
    this.dpr = useDpr;
    this.c.width = Math.round(cssW * useDpr);
    this.c.height = Math.round(cssH * useDpr);
    this.S = Math.min(cssW / 320, cssH / 380);
    this._buildStatic();
    this._layoutGarden();
    if (!this.running) this.draw(0);
  }

  _buildStatic() {
    const { W, H, S, dpr } = this;
    const px = S * dpr;
    this.cloudSprites = {};
    for (const [name, tone] of Object.entries(CLOUD_TONES)) {
      this.cloudSprites[name] = [0, 1, 2].map((i) => cloudSprite(240 * px, 130 * px, 40 + i * 7, tone));
    }
    this.fogDay = fogSprite(W * 1.6 * dpr, H * 0.42 * dpr, 5, '255,255,255');
    this.fogNight = fogSprite(W * 1.6 * dpr, H * 0.42 * dpr, 5, '112,124,150');
    this.dot = dotSprite(Math.ceil(12 * px));
    const bowSize = W * 1.34;
    this.bowBand = bowSize * 0.0165;
    this.bow = rainbowSprite(bowSize * dpr, this.bowBand * dpr);

    this.hillPaths = HILLS.map((_, i) => {
      const body = new Path2D();
      const crest = new Path2D();
      const step = Math.max(3, W / 90);
      body.moveTo(-2, H + 2);
      for (let x = -2; x <= W + step; x += step) {
        const y = hillY(i, x / W) * H;
        body.lineTo(x, y);
        if (x <= -2) crest.moveTo(x, y);
        else crest.lineTo(x, y);
      }
      body.lineTo(W + step + 2, H + 2);
      body.closePath();
      return { body, crest };
    });
  }

  _layoutGarden() {
    if (!this.W) return;
    for (const f of this.flowers) {
      f.px = f.nx * this.W;
      f.py = (hillY(2, f.nx) + f.dy) * this.H;
    }
  }

  /* ── 상태 ──────────────────────────────────────────────────────────── */
  setWeather(id, { instant = false } = {}) {
    this.weather = id;
    this._syncTod();
    const target = this._target();
    if (instant || !this.cur || this.reduced) {
      this.cur = target;
      this._snapClouds = true;
      this.nextBolt = 0.9;
    } else if (id === 'thunder') {
      this.nextBolt = 0.9;
    }
    if (!this.running && this.W) this.draw(0);
  }

  setDate(d) {
    this.date = d;
    this.season = SEASON[seasonOf(d)];
  }

  setGrowth(days, { instant = false } = {}) {
    this.growthTarget = clamp(0.42 + 0.72 * (1 - Math.exp(-days / 18)), 0.42, 1.14);
    if (instant) this.growth = this.growthTarget;
  }

  setGarden(list, { announce = false } = {}) {
    const prev = new Set(this.flowers.map((f) => f.key));
    this.flowers = list.slice(-FLOWER_MAX).map((e) => {
      const r = rng(hash(e.key));
      let nx = 0.04 + r() * 0.92;
      if (nx > 0.52 && nx < 0.77) nx = r() < 0.5 ? 0.42 + r() * 0.1 : 0.78 + r() * 0.16;
      const isNew = !prev.has(e.key);
      return {
        key: e.key,
        nx,
        dy: 0.012 + r() * 0.105,
        h: 4.5 + r() * 6,
        r: 1.7 + r() * 1.3,
        col: WEATHER[e.w]?.flower || '#fff',
        wave: r() * TAU,
        born: isNew && announce ? this.t : -99,
      };
    });
    this.flowers.sort((a, b) => a.dy - b.dy);
    this._layoutGarden();
  }

  _syncTod() {
    if (!this.todOverride) this.tod = timeOfDay(new Date());
  }

  _target() {
    const p = PRESET[this.weather || 'none'];
    const { night, warm } = this.tod;
    const glow = warm * (1 - p.over * 0.72);
    const sky = p.day.map((c, i) => {
      const base = mix(c, p.night[i], night);
      return mix(base, C.warmSky[i], glow * [0.34, 0.5, 0.72, 0.85][i] * (1 - night * 0.5));
    });
    const t = { sky };
    for (const k of NUM_KEYS) t[k] = p[k];
    return t;
  }

  _step(dt) {
    const t = this._target();
    if (!this.cur) this.cur = t;
    const a = 1 - Math.exp(-dt / 0.55);
    for (const k of NUM_KEYS) this.cur[k] += (t[k] - this.cur[k]) * a;
    this.cur.sky = this.cur.sky.map((c, i) => mix(c, t.sky[i], a));
    this.growth += (this.growthTarget - this.growth) * (1 - Math.exp(-dt / 0.9));
  }

  /* ── 터치 ──────────────────────────────────────────────────────────── */
  tap(px, py) {
    if (this.reduced || !this.W) return;
    const nx = px / this.W;
    const ny = py / this.H;
    const w = this.weather;
    if (w === 'thunder' && !this.reduced) {
      this._strike(nx);
      return;
    }
    for (const c of this.clouds) {
      const dx = c.x - nx;
      if (Math.abs(dx) < 0.3 && Math.abs(c.y - ny) < 0.2) c.push += (dx < 0 ? -1 : 1) * 0.16;
    }
    if (w === 'rain') this._burst(nx, ny, 14, ['#CFE4FF', '#9CC6F7'], 0.34, 0.9);
    else if (w === 'snow') this._burst(nx, ny, 16, ['#FFFFFF', '#E3EDFA'], 0.16, 0.05);
    else if (w === 'cloud' || w === 'fog') this._burst(nx, ny, 10, ['#FFFFFF'], 0.1, -0.04, 3.2);
    else if (w === 'wind') this._burst(nx, ny, 12, [this._leafCss()], 0.34, 0.1);
    else this._burst(nx, ny, 16, ['#FFF3B0', '#FFD76B', '#FFFFFF', '#FFB3CC'], 0.28, 0.08);
  }

  _leafCss() {
    return css(this.season.crown[0]);
  }

  _burst(nx, ny, n, colors, speed, grav, size = 1.5) {
    const R = this.R;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU;
      const v = speed * (0.35 + R() * 0.75);
      this.sparks.push({
        x: nx, y: ny, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.6 + R() * 0.5,
        col: colors[Math.floor(R() * colors.length)], r: size * (0.7 + R()), grav,
      });
    }
    if (this.sparks.length > 120) this.sparks.splice(0, this.sparks.length - 120);
  }

  celebrate() {
    if (this.reduced) return;
    const R = this.R;
    for (let i = 0; i < 26; i++) {
      this._burst(0.15 + R() * 0.7, 0.3 + R() * 0.45, 1, ['#FFF3B0', '#FFD76B', '#FFFFFF', '#FFB3CC', '#B9E6FF'], 0.2, -0.02, 1.9);
    }
    this.pulse = 1;
  }

  _strike(nx) {
    const R = this.R;
    const x0 = nx ?? 0.22 + R() * 0.56;
    const y0 = 0.14 + R() * 0.08;
    const x1 = clamp(x0 + (R() - 0.5) * 0.24, 0.08, 0.92);
    const y1 = hillY(0, x1) + 0.015;
    const pts = [[x0, y0]];
    const N = 11;
    for (let i = 1; i < N; i++) {
      const u = i / N;
      pts.push([lerp(x0, x1, u) + (R() - 0.5) * 0.085, lerp(y0, y1, u)]);
    }
    pts.push([x1, y1]);
    const branches = [];
    for (let b = 0; b < 2; b++) {
      const at = 3 + Math.floor(R() * 5);
      let [x, y] = pts[at];
      const dir = R() < 0.5 ? -1 : 1;
      const br = [[x, y]];
      for (let i = 0; i < 4; i++) {
        x += dir * (0.02 + R() * 0.035);
        y += 0.02 + R() * 0.03;
        br.push([x, y]);
      }
      branches.push(br);
    }
    this.boltFx = { pts, branches, life: 0 };
    this.flash = 1;
    this.nextBolt = 3.4 + R() * 4.6;
    this.opts.onFlash?.();
  }

  /* ── 반복 ──────────────────────────────────────────────────────────── */
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    this.c.width = this.c.height = 0;
  }

  _loop(now) {
    if (!this.running) return;
    const elapsed = now - this.last;
    if (elapsed < 14) {
      this.raf = requestAnimationFrame(this._loop);
      return;
    }
    const dt = Math.min(0.05, elapsed / 1000);
    this.last = now;
    this.draw(dt);
    this._governor(elapsed);
    if (this.reduced) {
      this.running = false;
      return;
    }
    this.raf = requestAnimationFrame(this._loop);
  }

  // 느린 기기에서는 해상도를 조금 낮춰 움직임을 지킨다
  _governor(elapsed) {
    this._frames++;
    this._slow += elapsed;
    if (this._frames < 100) return;
    const avg = this._slow / this._frames;
    this._frames = 0;
    this._slow = 0;
    if (avg > 30 && this.quality > 0.55) {
      this.quality = Math.max(0.55, this.quality - 0.2);
      this.resize(this.W, this.H);
    }
  }

  /* ── 그리기 ────────────────────────────────────────────────────────── */
  draw(dt) {
    if (!this.W) return;
    this.t += dt;
    if (!this.todOverride && Math.floor(this.t) % 30 === 0) this._syncTod();
    this._step(dt || 0.0001);

    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    this._drawSky(g);
    this._drawStars(g);
    this._drawSun(g);
    this._drawRainbow(g);
    this._drawClouds(g, dt);
    this._drawBolt(g, dt);
    this._drawBirds(g, dt);
    this._drawTerrain(g, dt);
    this._drawWind(g, dt);
    this._drawRain(g, dt);
    this._drawSnow(g, dt);
    this._drawFog(g, dt, 2);
    this._drawSparks(g, dt);
    this._drawFlash(g, dt);
  }

  _drawSky(g) {
    const { W, H } = this;
    const grad = g.createLinearGradient(0, 0, 0, H);
    const pos = [0, 0.42, 0.7, 0.92];
    this.cur.sky.forEach((c, i) => grad.addColorStop(pos[i], css(c)));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

  _drawStars(g) {
    const { night } = this.tod;
    const a = night * (1 - this.cur.over * 0.9);
    if (a < 0.02) return;
    const { W, H, S } = this;
    g.fillStyle = '#fff';
    for (const s of this.stars) {
      g.globalAlpha = a * (0.45 + 0.55 * Math.abs(Math.sin(this.t * s.f + s.ph)));
      g.beginPath();
      g.arc(s.x * W, s.y * H, s.r * S, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  _drawSun(g) {
    const { W, H, S, tod } = this;
    const vis = this.cur.sun;
    if (vis < 0.01) return;
    const isNight = tod.night;
    const breath = 1 + Math.sin(this.t * 0.8) * 0.018;

    if (isNight < 0.98) {
      const x = tod.sunX * W;
      const y = tod.sunY * H;
      const r = 30 * S * breath;
      const a = vis * (1 - isNight);
      const warmth = tod.warm;
      const halo = g.createRadialGradient(x, y, r * 0.4, x, y, r * 5);
      halo.addColorStop(0, warmth > 0.3 ? `rgba(255,214,160,${0.7 * a})` : `rgba(255,248,214,${0.75 * a})`);
      halo.addColorStop(0.35, `rgba(255,238,190,${0.26 * a})`);
      halo.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = halo;
      g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      if (vis > 0.5) {
        const rayA = (vis - 0.5) * 2 * a * 0.16;
        g.save();
        g.translate(x, y);
        g.rotate(this.t * 0.04);
        const rays = g.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 3.3);
        rays.addColorStop(0, `rgba(255,247,212,${rayA})`);
        rays.addColorStop(1, 'rgba(255,247,212,0)');
        g.fillStyle = rays;
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * TAU;
          const spread = 0.13 + (i % 2) * 0.07;
          g.moveTo(Math.cos(ang - spread) * r, Math.sin(ang - spread) * r);
          g.lineTo(Math.cos(ang - spread * 0.3) * r * 3.3, Math.sin(ang - spread * 0.3) * r * 3.3);
          g.lineTo(Math.cos(ang + spread * 0.3) * r * 3.3, Math.sin(ang + spread * 0.3) * r * 3.3);
          g.lineTo(Math.cos(ang + spread) * r, Math.sin(ang + spread) * r);
          g.closePath();
        }
        g.fill();
        g.restore();
      }
      const disc = g.createRadialGradient(x - r * 0.26, y - r * 0.26, 0, x, y, r);
      disc.addColorStop(0, `rgba(255,253,236,${a})`);
      disc.addColorStop(0.6, warmth > 0.3 ? `rgba(255,214,150,${a})` : `rgba(255,236,160,${a})`);
      disc.addColorStop(1, warmth > 0.3 ? `rgba(255,184,104,${a})` : `rgba(255,212,104,${a})`);
      g.fillStyle = disc;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    if (isNight > 0.02) {
      const x = 0.68 * W;
      const y = 0.21 * H;
      const r = 25 * S;
      const a = Math.min(1, vis * 1.3) * isNight;
      const halo = g.createRadialGradient(x, y, r * 0.5, x, y, r * 4.4);
      halo.addColorStop(0, `rgba(226,232,255,${0.5 * a})`);
      halo.addColorStop(1, 'rgba(226,232,255,0)');
      g.fillStyle = halo;
      g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      const disc = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      disc.addColorStop(0, `rgba(255,252,236,${a})`);
      disc.addColorStop(1, `rgba(226,226,214,${a})`);
      g.fillStyle = disc;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
      g.fillStyle = `rgba(190,190,190,${0.32 * a})`;
      for (const [ox, oy, cr] of [[-0.32, -0.2, 0.2], [0.26, 0.1, 0.27], [-0.1, 0.42, 0.15]]) {
        g.beginPath();
        g.arc(x + ox * r, y + oy * r, cr * r, 0, TAU);
        g.fill();
      }
    }
  }

  _drawRainbow(g) {
    const a = this.cur.bow;
    if (a < 0.01) return;
    const { W, H } = this;
    const size = W * 1.34;
    const x = W / 2 - size / 2;
    const y = H * 0.82 - size / 2;
    const shimmer = 0.84 + Math.sin(this.t * 0.7) * 0.08;
    g.globalAlpha = a * shimmer * (1 - this.tod.night * 0.42);
    g.drawImage(this.bow, x, y, size, this.bow.height / this.dpr);
    g.globalAlpha = 1;
  }

  _drawClouds(g, dt) {
    const { W, H, S, cur, tod } = this;
    const amount = cur.cloud;
    const windSpeed = 0.006 + cur.wind * 0.05;
    const baseW = 240 * S;
    const baseH = 130 * S;
    const nightA = tod.night;
    const duskA = tod.warm * (1 - cur.over * 0.8);
    for (const c of this.clouds) {
      c.x += (windSpeed * (0.35 + c.d) + c.push) * dt;
      c.push *= Math.exp(-dt * 1.4);
      const margin = (baseW * c.s) / W / 2 + 0.05;
      if (c.x > 1 + margin) c.x = -margin;
      if (c.x < -margin) c.x = 1 + margin;
      const want = amount >= c.th ? 1 : 0;
      c.a = this._snapClouds ? want : c.a + (want - c.a) * (1 - Math.exp(-dt / 0.6));
      const a = c.a;
      if (a < 0.01) continue;
      const w = baseW * c.s;
      const h = baseH * c.s;
      const bob = Math.sin(this.t * 0.25 + c.x * 7) * 2 * S;
      const x = c.x * W - w / 2;
      const y = c.y * H - h / 2 + bob;
      g.globalAlpha = a;
      g.drawImage(this.cloudSprites.light[c.sp], x, y, w, h);
      if (duskA > 0.02) {
        g.globalAlpha = a * duskA;
        g.drawImage(this.cloudSprites.dusk[c.sp], x, y, w, h);
      }
      if (cur.dark > 0.02) {
        g.globalAlpha = a * Math.min(1, cur.dark * (0.9 + c.d * 0.3));
        g.drawImage(this.cloudSprites.storm[c.sp], x, y, w, h);
      }
      if (nightA > 0.02) {
        g.globalAlpha = a * nightA * 0.92;
        g.drawImage(this.cloudSprites.night[c.sp], x, y, w, h);
      }
    }
    g.globalAlpha = 1;
    this._snapClouds = false;
  }

  _drawBolt(g, dt) {
    const { cur } = this;
    if (cur.bolt > 0.6 && !this.reduced && !this.opts.still) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) this._strike();
    }
    if (this.opts.still && cur.bolt > 0.6 && !this.boltFx) {
      this._strike(0.34);
      this.flash = 0.25;
      this.boltFx.life = 0.02;
    }
    const b = this.boltFx;
    if (!b) return;
    b.life += dt;
    if (b.life > 0.3) {
      this.boltFx = null;
      return;
    }
    const on = b.life < 0.09 || (b.life > 0.14 && b.life < 0.22);
    if (!on) return;
    const { W, H, S } = this;
    const stroke = (pts, width) => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
      g.lineWidth = width * S;
      g.stroke();
    };
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.shadowColor = 'rgba(190,175,255,.95)';
    g.shadowBlur = 14 * S * this.dpr;
    g.strokeStyle = 'rgba(255,250,235,.96)';
    stroke(b.pts, 2.2);
    g.shadowBlur = 8 * S * this.dpr;
    b.branches.forEach((br) => stroke(br, 1.1));
    g.restore();
  }

  _drawBirds(g, dt) {
    const { W, H, S, cur, tod } = this;
    if (this.opts.still || cur.sun < 0.55 || tod.night > 0.3 || cur.wind > 0.5) return;
    this.nextBirds -= dt;
    if (!this.birds && this.nextBirds <= 0) {
      const R = this.R;
      const n = 3 + Math.floor(R() * 2);
      this.birds = {
        x: -0.15,
        y: 0.32 + R() * 0.16,
        list: Array.from({ length: n }, (_, i) => ({
          ox: -i * 0.055 + R() * 0.02, oy: (i % 2 ? 1 : -1) * i * 0.012, ph: R() * TAU,
        })),
      };
    }
    if (!this.birds) return;
    const b = this.birds;
    b.x += dt * 0.055;
    if (b.x > 1.3) {
      this.birds = null;
      this.nextBirds = 7 + this.R() * 9;
      return;
    }
    g.strokeStyle = css(mix(this.cur.sky[0], C.night, 0.55), 0.75);
    g.lineWidth = 1.3 * S;
    g.lineCap = 'round';
    g.beginPath();
    for (const q of b.list) {
      const x = (b.x + q.ox) * W;
      const y = (b.y + q.oy) * H;
      const flap = Math.sin(this.t * 7 + q.ph) * 2.3 * S;
      const span = 5.2 * S;
      g.moveTo(x - span, y - flap);
      g.quadraticCurveTo(x - span * 0.45, y - 1.8 * S - flap * 0.2, x, y);
      g.quadraticCurveTo(x + span * 0.45, y - 1.8 * S - flap * 0.2, x + span, y - flap);
    }
    g.stroke();
  }

  _hillTone(c, depth, shade = 0) {
    const { cur, tod } = this;
    let out = mix(c, C.overcast, cur.over * 0.5);
    out = mix(out, C.stormLand, cur.dark * 0.66);
    out = mix(out, C.warmHill, tod.warm * (1 - cur.over * 0.8) * 0.26);
    out = mix(out, C.nightLand, tod.night * 0.9);
    const snow = mix(mix(C.snow, C.snowShade, shade), mix(C.snowNight, C.snowNightShade, shade), tod.night);
    out = mix(out, snow, cur.cover * 0.96);
    out = mix(out, cur.sky[3], depth * (0.44 + cur.fog * 0.4));
    return out;
  }

  _plantTone(c) {
    const { cur, tod } = this;
    let out = mix(c, C.overcast, cur.over * 0.36);
    out = mix(out, C.stormLand, cur.dark * 0.56);
    out = mix(out, C.nightLand, tod.night * 0.78);
    return mix(out, mix(C.snow, C.snowNight, tod.night), cur.cover * 0.34);
  }

  _drawTerrain(g, dt) {
    const { W, H, S, season, cur, tod } = this;

    // 먼 언덕
    const farTop = this._hillTone(season.far, 1);
    const farBot = this._hillTone(season.mid[1], 0.8, 1);
    let grad = g.createLinearGradient(0, H * 0.66, 0, H * 0.84);
    grad.addColorStop(0, css(farTop));
    grad.addColorStop(1, css(farBot));
    g.fillStyle = grad;
    g.fill(this.hillPaths[0].body);

    this._drawFog(g, dt, 0);

    // 가운데 언덕과 작은 나무들
    const midTop = this._hillTone(season.mid[0], 0.42);
    const midBot = this._hillTone(season.mid[1], 0.3, 1);
    const treeTone = css(mix(mix(this._plantTone(season.crown[1]), mix(C.snowShade, C.snowNightShade, tod.night), cur.cover * 0.62), cur.sky[3], 0.26 + cur.fog * 0.4));
    g.fillStyle = treeTone;
    g.beginPath();
    for (const m of this.miniTrees) {
      const y = hillY(1, m.x) * H;
      const r = 6.5 * S * m.s;
      g.moveTo(m.x * W + r, y - r * 0.55);
      g.arc(m.x * W, y - r * 0.55, r, 0, TAU);
    }
    g.fill();
    grad = g.createLinearGradient(0, H * 0.73, 0, H * 0.9);
    grad.addColorStop(0, css(midTop));
    grad.addColorStop(1, css(midBot));
    g.fillStyle = grad;
    g.fill(this.hillPaths[1].body);

    this._drawFog(g, dt, 1);

    // 가까운 언덕
    const nearTop = this._hillTone(season.near[0], 0);
    const nearBot = this._hillTone(season.near[1], 0, 1);
    grad = g.createLinearGradient(0, H * 0.78, 0, H);
    grad.addColorStop(0, css(nearTop));
    grad.addColorStop(1, css(nearBot));
    g.fillStyle = grad;
    g.fill(this.hillPaths[2].body);
    g.strokeStyle = css(mix(nearTop, lab('#FFFFFF'), 0.35), 0.5);
    g.lineWidth = 1 * S;
    g.stroke(this.hillPaths[2].crest);

    this._drawTrail(g, nearTop, nearBot);

    const windy = cur.wind;
    const sway = Math.sin(this.t * (1.1 + windy * 2.2)) * (0.012 + windy * 0.075);

    // 깊이에 맞춰 나무 → 집 → 꽃 순서로 그린다
    this._drawTree(g, sway);
    this._drawHouse(g, dt);
    this._drawGarden(g, sway);
  }

  // 집 앞에서 내려오는 오솔길과 풀
  _drawTrail(g, top, bot) {
    const { W, H, S, tod, cur } = this;
    const doorX = (HOUSE_X - 0.05) * W;
    const doorY = hillY(2, HOUSE_X - 0.05) * H + 2 * S;
    const light = mix(mix(mix(top, lab('#FFF3D6'), 0.42), C.nightLand, tod.night * 0.3), mix(C.snowShade, C.snowNightShade, tod.night), cur.cover * 0.82);
    const grad = g.createLinearGradient(0, doorY, 0, H);
    grad.addColorStop(0, css(light, 0.85));
    grad.addColorStop(1, css(mix(light, bot, 0.25), 0.9));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(doorX - 3 * S, doorY);
    g.bezierCurveTo(doorX - 26 * S, doorY + (H - doorY) * 0.36, doorX + 20 * S, doorY + (H - doorY) * 0.6, doorX - 34 * S, H + 2);
    g.lineTo(doorX + 16 * S, H + 2);
    g.bezierCurveTo(doorX + 34 * S, doorY + (H - doorY) * 0.56, doorX - 8 * S, doorY + (H - doorY) * 0.34, doorX + 5 * S, doorY);
    g.closePath();
    g.fill();

    g.strokeStyle = css(mix(bot, C.nightLand, 0.22), cur.cover > 0.5 ? 0.12 : 0.36);
    g.lineWidth = 1.1 * S;
    g.lineCap = 'round';
    g.beginPath();
    for (const t of this.tufts) {
      const x = t.x * W;
      const y = (hillY(2, t.x) + t.d) * H;
      const h = t.h * S;
      g.moveTo(x - 2 * S, y);
      g.quadraticCurveTo(x - 2.2 * S, y - h * 0.6, x - 3.6 * S, y - h * 0.86);
      g.moveTo(x, y);
      g.lineTo(x + 0.3 * S, y - h);
      g.moveTo(x + 2 * S, y);
      g.quadraticCurveTo(x + 2.2 * S, y - h * 0.6, x + 3.6 * S, y - h * 0.86);
    }
    g.stroke();
  }

  _drawTree(g, sway) {
    const { W, H, S, season, cur, tod } = this;
    const x = TREE_X * W;
    const y = hillY(2, TREE_X) * H + 2 * S;
    const k = this.growth * S * 1.15;
    const shade = (c) => this._plantTone(c);
    const trunkCol = css(mix(mix(mix(C.trunk, C.stormLand, cur.dark * 0.5), C.night, tod.night * 0.78), C.overcast, cur.over * 0.16));
    g.save();
    g.translate(x, y);
    g.transform(1, 0, sway, 1, 0, 0);
    g.scale(k, k);
    g.fillStyle = trunkCol;
    g.beginPath();
    g.moveTo(-3.2, 2);
    g.quadraticCurveTo(-2.2, -14, -2.4, -30);
    g.lineTo(2.4, -30);
    g.quadraticCurveTo(2.2, -14, 3.6, 2);
    g.closePath();
    g.fill();
    const puffs = [[-14, -40, 15], [14, -39, 14.5], [0, -52, 18], [-6, -34, 13], [8, -32, 12]];
    g.fillStyle = css(shade(season.crown[1]));
    g.beginPath();
    for (const [px, py, r] of puffs) {
      g.moveTo(px + r, py);
      g.arc(px, py, r, 0, TAU);
    }
    g.fill();
    g.fillStyle = css(shade(season.crown[0]));
    g.beginPath();
    for (const [px, py, r] of [[-12, -44, 10.5], [12, -44, 9], [-1, -57, 12.5]]) {
      g.moveTo(px + r, py);
      g.arc(px, py, r, 0, TAU);
    }
    g.fill();
    g.restore();
  }

  _tone(c, shadeBoost = 0) {
    const { cur, tod } = this;
    let o = mix(c, C.overcast, cur.over * 0.22);
    o = mix(o, C.stormLand, cur.dark * 0.46);
    o = mix(o, C.night, Math.min(0.86, tod.night * 0.74 + shadeBoost));
    return o;
  }

  _drawHouse(g, dt) {
    const { W, H, S, cur, tod } = this;
    const x = HOUSE_X * W;
    const y = hillY(2, HOUSE_X) * H + 3 * S;
    const w = 48 * S;
    const h = 31 * S;
    const roofH = 27 * S;
    const over = 7 * S;
    const darkness = Math.max(tod.night, smoothstep(0.42, 0.95, cur.over));

    // 굴뚝
    g.fillStyle = css(this._tone(C.chimney));
    g.fillRect(x + w * 0.2, y - h - roofH * 0.9, 7 * S, 15 * S);

    // 벽
    const left = x - w / 2;
    const top = y - h;
    g.fillStyle = css(this._tone(C.wall));
    g.fillRect(left, top, w, h + 3 * S);
    g.fillStyle = css(this._tone(C.wallShade));
    g.fillRect(x + w * 0.12, top, w * 0.38, h + 3 * S);

    // 지붕
    g.lineJoin = 'round';
    g.lineWidth = 3 * S;
    g.strokeStyle = g.fillStyle = css(this._tone(C.roof));
    g.beginPath();
    g.moveTo(left - over, top + 1 * S);
    g.lineTo(x, top - roofH);
    g.lineTo(left + w + over, top + 1 * S);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = css(this._tone(C.roofShade));
    g.beginPath();
    g.moveTo(x, top - roofH);
    g.lineTo(left + w + over, top + 1 * S);
    g.lineTo(x + w * 0.05, top + 1 * S);
    g.closePath();
    g.fill();

    // 눈이 쌓인 지붕
    if (cur.cover > 0.02) {
      g.globalAlpha = cur.cover;
      g.fillStyle = css(mix(C.snow, C.snowNight, tod.night));
      g.beginPath();
      g.moveTo(left - over - 1.5 * S, top + 1 * S);
      g.lineTo(x, top - roofH - 2.5 * S);
      g.lineTo(left + w + over + 1.5 * S, top + 1 * S);
      g.quadraticCurveTo(x + w * 0.42, top - roofH * 0.2, x + w * 0.22, top - roofH * 0.38);
      g.quadraticCurveTo(x, top - roofH * 0.62, x - w * 0.22, top - roofH * 0.34);
      g.quadraticCurveTo(x - w * 0.42, top - roofH * 0.16, left - over - 1.5 * S, top + 1 * S);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }

    // 문
    g.fillStyle = css(this._tone(C.door));
    const doorW = 11.5 * S;
    const doorH = 18.5 * S;
    const dx = x - w * 0.31;
    g.beginPath();
    g.moveTo(dx, y + 3 * S);
    g.lineTo(dx, y - doorH + doorW / 2);
    g.arc(dx + doorW / 2, y - doorH + doorW / 2, doorW / 2, Math.PI, TAU);
    g.lineTo(dx + doorW, y + 3 * S);
    g.closePath();
    g.fill();

    // 창문: 어두운 날일수록 불빛이 따뜻해진다
    const winX = x + w * 0.03;
    const winY = top + 7.5 * S;
    const winW = 13.5 * S;
    const winH = 12.5 * S;
    if (darkness > 0.04) {
      const cx = winX + winW / 2;
      const cy = winY + winH / 2;
      const r = 34 * S;
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      glow.addColorStop(0, `rgba(255,212,130,${0.5 * darkness})`);
      glow.addColorStop(1, 'rgba(255,212,130,0)');
      g.fillStyle = glow;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    g.fillStyle = css(mix(this._tone(C.glassDay), C.glassWarm, darkness));
    g.fillRect(winX, winY, winW, winH);
    g.strokeStyle = css(this._tone(C.wall));
    g.lineWidth = 1.3 * S;
    g.beginPath();
    g.moveTo(winX + winW / 2, winY);
    g.lineTo(winX + winW / 2, winY + winH);
    g.moveTo(winX, winY + winH / 2);
    g.lineTo(winX + winW, winY + winH / 2);
    g.stroke();

    this._drawSmoke(g, dt, x + w * 0.2 + 3.5 * S, y - h - roofH * 0.9);
  }

  _drawSmoke(g, dt, x, y) {
    const { S, W, H, cur } = this;
    if (cur.rain > 0.5 || this.opts.still) return;
    this._smokeT = (this._smokeT || 0) - dt;
    if (this._smokeT <= 0 && this.smoke.length < 14) {
      this._smokeT = 0.55;
      this.smoke.push({ x: x / W, y: y / H, life: 0, max: 3.4 + this.R() * 1.4 });
    }
    g.fillStyle = 'rgba(255,255,255,1)';
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.life += dt;
      if (s.life > s.max) {
        this.smoke.splice(i, 1);
        continue;
      }
      const u = s.life / s.max;
      s.x += (0.006 + cur.wind * 0.07) * dt;
      s.y -= 0.022 * dt;
      g.globalAlpha = 0.26 * (1 - u) * smoothstep(0, 0.1, u);
      g.beginPath();
      g.arc(s.x * W, s.y * H, (2.6 + u * 7) * S, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  _drawGarden(g, sway) {
    const { S, t } = this;
    if (!this.flowers.length) return;
    g.lineCap = 'round';
    const dim = Math.min(0.75, this.tod.night * 0.62 + this.cur.over * 0.1);
    for (const f of this.flowers) {
      let k = 1;
      if (f.born > -50) {
        const age = t - f.born;
        k = age < 0.7 ? 1 + Math.sin(Math.min(1, age / 0.55) * Math.PI) * 1.2 * (1 - age / 0.7) : 1;
        k *= Math.min(1, age / 0.22);
        if (age < 0.7 && this.running === false) k = 1;
      }
      const lean = (Math.sin(t * 1.3 + f.wave) * 0.8 + sway * 28) * S;
      const height = f.h * S * k;
      const tx = f.px + lean;
      const ty = f.py - height;
      g.globalAlpha = 0.85;
      g.strokeStyle = css(mix(lab('#4E9A63'), C.night, dim));
      g.lineWidth = 1 * S;
      g.beginPath();
      g.moveTo(f.px, f.py);
      g.quadraticCurveTo(f.px, f.py - height * 0.6, tx, ty);
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = css(mix(lab(f.col), C.night, dim * 0.7));
      const r = f.r * S * k;
      g.beginPath();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * TAU + f.wave;
        const px = tx + Math.cos(a) * r * 0.82;
        const py = ty + Math.sin(a) * r * 0.82;
        g.moveTo(px + r * 0.62, py);
        g.arc(px, py, r * 0.62, 0, TAU);
      }
      g.fill();
      g.fillStyle = css(mix(lab('#FFB43E'), C.night, dim * 0.6));
      g.beginPath();
      g.arc(tx, ty, r * 0.45, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  _drawWind(g, dt) {
    const { W, H, S, cur } = this;
    const a = cur.wind;
    if (a < 0.28) return;
    const strength = smoothstep(0.28, 0.9, a);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const gustN = Math.ceil(this.gusts.length * strength);
    for (let i = 0; i < gustN; i++) {
      const s = this.gusts[i];
      s.x += s.v * dt;
      if (s.x > 1.35) {
        s.x = -0.5 - this.R() * 0.4;
        s.y = 0.1 + this.R() * 0.62;
      }
      const x = s.x * W;
      const y = s.y * H + Math.sin(this.t + s.ph) * 5 * S;
      const len = s.len * W;
      g.strokeStyle = `rgba(255,255,255,${0.62 * strength * (this.tod.night > 0.5 ? 0.55 : 1)})`;
      g.lineWidth = 1.4 * S;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + len * 0.35, y - 7 * S, x + len * 0.6, y + 7 * S, x + len, y);
      if (s.curl) {
        const cx = x + len;
        const r = 7 * S;
        g.arc(cx, y - r, r, Math.PI / 2, -Math.PI * 0.9, true);
      }
      g.stroke();
    }
    const leafN = Math.ceil(this.leaves.length * strength);
    const leaf = css(mix(this.season.crown[0], C.night, this.tod.night * 0.5));
    g.fillStyle = leaf;
    for (let i = 0; i < leafN; i++) {
      const l = this.leaves[i];
      l.x += l.v * dt;
      l.rot += l.spin * dt;
      if (l.x > 1.1) {
        l.x = -0.12;
        l.y = 0.3 + this.R() * 0.52;
      }
      const ly = l.y * H + Math.sin(this.t * 2 + l.ph) * 10 * S;
      g.save();
      g.translate(l.x * W, ly);
      g.rotate(l.rot);
      g.beginPath();
      g.ellipse(0, 0, 3.6 * S * l.s, 1.7 * S * l.s, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  }

  _drawRain(g, dt) {
    const { W, H, S, cur } = this;
    const a = cur.rain;
    if (a < 0.01) {
      this.splash.length = 0;
      return;
    }
    const n = Math.floor(this.drops.length * Math.min(1, a) * Math.max(0.6, this.quality));
    const slant = 0.09 + cur.wind * 0.2;
    const zoneA = [0.18, 0.3, 0.46];
    const widths = [0.75, 1, 1.3];
    g.lineCap = 'round';
    for (let z = 0; z < 3; z++) {
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const d = this.drops[i];
        if (d.z !== z) continue;
        d.y += d.v * dt;
        d.x += d.v * slant * dt * (H / W);
        const ground = hillY(2, clamp(d.x)) + (z === 2 ? d.g : (2 - z) * -0.05);
        if (d.y > ground) {
          if (z === 2 && this.splash.length < 40 && dt > 0) {
            this.splash.push({ x: d.x, y: ground, life: 0 });
          }
          d.y = -0.1 - this.R() * 0.15;
          d.x = this.R() * 1.3 - 0.25;
        }
        const len = 13 * S * d.len * (0.8 + z * 0.3);
        const x = d.x * W;
        const y = d.y * H;
        g.moveTo(x, y);
        g.lineTo(x - len * slant, y - len);
      }
      g.strokeStyle = `rgba(222,236,255,${zoneA[z] * Math.min(1, a * 1.3)})`;
      g.lineWidth = widths[z] * S;
      g.stroke();
    }
    g.strokeStyle = `rgba(230,240,255,${0.5 * a})`;
    g.lineWidth = 0.8 * S;
    for (let i = this.splash.length - 1; i >= 0; i--) {
      const s = this.splash[i];
      s.life += dt;
      if (s.life > 0.26) {
        this.splash.splice(i, 1);
        continue;
      }
      const u = s.life / 0.26;
      g.globalAlpha = 1 - u;
      g.beginPath();
      g.ellipse(s.x * W, s.y * H, (1 + u * 5) * S, (0.5 + u * 1.6) * S, 0, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  _drawSnow(g, dt) {
    const { W, H, S, cur, t } = this;
    const a = cur.snow;
    if (a < 0.01) return;
    const n = Math.floor(this.flakes.length * Math.min(1, a) * Math.max(0.6, this.quality));
    const drift = cur.wind * 0.1;
    for (let i = 0; i < n; i++) {
      const f = this.flakes[i];
      f.y += f.v * dt;
      f.x += (Math.sin(t * f.f + f.ph) * 0.02 + drift) * dt;
      if (f.y > 1.03) {
        f.y = -0.03;
        f.x = this.R();
      }
      if (f.x > 1.03) f.x = -0.03;
      if (f.x < -0.03) f.x = 1.03;
      const r = f.r * S;
      g.globalAlpha = f.a * Math.min(1, a * 1.3);
      g.drawImage(this.dot, f.x * W - r, f.y * H - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }

  _drawFog(g, dt, layer) {
    const a = this.cur.fog;
    if (a < 0.015) return;
    const { W, H } = this;
    const band = this.fogBands[layer];
    band.x += band.s * dt * (1 + this.cur.wind * 2);
    if (band.x > 1) band.x -= 1;
    const w = W * 1.6;
    const h = H * band.h;
    const y = band.y * H - h / 2 + Math.sin(this.t * 0.2 + layer) * H * 0.01;
    const x = band.x * w - w;
    const baseA = a * band.a;
    const night = this.tod.night;
    const paint = (img, alpha) => {
      if (alpha < 0.01) return;
      g.globalAlpha = alpha;
      g.drawImage(img, x, y, w, h);
      g.drawImage(img, x + w, y, w, h);
    };
    paint(this.fogDay, baseA * (1 - night));
    paint(this.fogNight, baseA * night);
    g.globalAlpha = 1;
  }

  _drawSparks(g, dt) {
    const { W, H, S } = this;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life > s.max) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.vy += s.grav * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.exp(-dt * 2.4);
      s.vy *= Math.exp(-dt * 1.2);
      const u = s.life / s.max;
      g.globalAlpha = 1 - u * u;
      g.fillStyle = s.col;
      g.beginPath();
      g.arc(s.x * W, s.y * H, s.r * S * (1 - u * 0.4), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  _drawFlash(g, dt) {
    if (this.flash < 0.005) return;
    const { W, H } = this;
    g.fillStyle = `rgba(205,210,255,${this.flash * 0.42})`;
    g.fillRect(0, 0, W, H);
    this.flash *= Math.exp(-dt * 8);
  }
}

/* 공유 카드에 넣을 정지 장면 */
export function renderStill(weather, width, height, { date = new Date(), garden = [], days = 20 } = {}) {
  const canvas = mk(width, height);
  const scene = new SkyScene(canvas, { still: true, maxDpr: 1, seed: 19, date, tod: DAYLIGHT });
  scene.resize(width, height, 1);
  scene.setGrowth(days, { instant: true });
  scene.setGarden(garden);
  scene.setWeather(weather, { instant: true });
  scene.flash = 0;
  scene.draw(1 / 60);
  return canvas;
}
