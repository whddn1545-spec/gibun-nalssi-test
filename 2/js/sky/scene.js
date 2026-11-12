// 하늘 세계: 연속 파라미터를 목표값으로 따라가게 하고, 매 프레임 같은 세계를 그린다.
// 날씨별로 장면을 따로 그리지 않는다. setWeather는 목표만 바꾼다.

import { WEATHERS } from '../weather.js';
import { Celestial } from './celestial.js';
import { Clouds } from './clouds.js';
import { Figure } from './figure.js';
import { HILL, KEYS, NIGHT_MUL, PARAMS, SKY, TAU, keyOf } from './palette.js';
import { Terrain, nearY } from './terrain.js';
import { FX } from './weatherfx.js';
import { clamp, css, hex, lerp, lum, mixc, mulc, smooth, toHex } from './util.js';

const WHITE = [255, 255, 255];
const CLOUD_LIGHT = { top: [255, 255, 255], mid: [244, 247, 252], bot: [201, 216, 235] };
const CLOUD_RAIN = { top: [148, 163, 190], mid: [92, 112, 146], bot: [62, 80, 114] };
const CLOUD_THUNDER = { top: [100, 92, 150], mid: [58, 50, 104], bot: [34, 28, 72] };

const tri = (h, a, b, c) => (h <= a || h >= c ? 0 : h < b ? smooth(a, b, h) : 1 - smooth(b, c, h));
const copy3 = (list) => list.map((c) => c.slice());

function timeFactors(h) {
  let night;
  if (h >= 20 || h < 5) night = 1;
  else if (h < 7) night = 1 - smooth(5, 7, h);
  else if (h < 17) night = 0;
  else night = smooth(17, 20, h);
  return { night, warm: Math.max(tri(h, 4.9, 6.1, 7.6), tri(h, 16.6, 18.4, 20.2)) };
}

export class World {
  constructor({ pr = 1, reducedMotion = false, uiReserve = 262 } = {}) {
    this.reduced = reducedMotion;
    this.uiReserve = uiReserve;
    this.pr = pr;
    this.t = 0;
    this.w = 390;
    this.h = 844;
    this.q = 1;
    this.targetKey = 'neutral';
    this.p = PARAMS.neutral.slice();
    this.sky = copy3(SKY.neutral);
    this.hills = copy3(HILL.neutral);
    this.hour = 12;
    this.hourTarget = null;
    this.hourInit = false;
    this.cam = 0;
    this.camTarget = 0;
    this.camInit = false;
    this.bowProg = 0;
    this.weatherInit = false;
    this.listeners = {};
    this.inkNow = 'white';
    this.themeNow = '';
    this.nextEmit = 0;
    this.stillMode = false;
    this.clear = null;
    this.gardenLimit = null;

    this.clouds = new Clouds(pr);
    this.celestial = new Celestial(pr, reducedMotion);
    this.fx = new FX(pr, reducedMotion);
    this.terrain = new Terrain(reducedMotion);
    this.figure = new Figure(reducedMotion);
    this.flowerColors = {};
    for (const id of Object.keys(WEATHERS)) this.flowerColors[id] = hex(WEATHERS[id].color);

    // 프레임마다 모듈이 읽는 값 묶음
    this.F = {
      w: 390, h: 844, t: 0, pr, q: 1, reduced: reducedMotion, hillTop: 523, p: this.p,
      surfaceY: (x) => nearY(this.F, x) + this.F.camShift,
      flowerRGB: (id) => this.flowerColors[id] ?? [255, 255, 255],
    };
    this.layout();
  }

  // ── 크기와 배치 ──

  resize(w, h, pr) {
    this.w = w;
    this.h = h;
    if (pr && pr !== this.pr) {
      this.pr = pr;
      this.clouds.setPixelRatio(pr);
      this.fx.setPixelRatio(pr);
    }
    this.layout();
  }

  layout() {
    const { F } = this;
    F.w = this.w;
    F.h = this.h;
    F.pr = this.pr;
    // 언덕 꼭대기는 화면 높이의 약 62%. 작은 화면에서는 아래 UI 위로 올린다.
    F.hillTop = Math.max(this.h * 0.5, Math.min(this.h * 0.62, this.h - this.uiReserve));
    F.px = this.w * 0.4;
    F.tx = this.w * 0.72;
    F.lx = F.px + 29;
    F.sx = F.px - 36;
    F.py = nearY(F, F.px);
    F.ly = nearY(F, F.lx) + 1;
    F.sy = nearY(F, F.sx);
  }

  // ── 명령 ──

  setWeather(id, instant = false) {
    this.targetKey = keyOf(id);
    this.figure.setTarget(this.targetKey, instant || !this.weatherInit);
    if (instant || !this.weatherInit) this.snapWeather();
    this.weatherInit = true;
  }

  snapWeather() {
    const k = this.targetKey;
    this.p = PARAMS[k].slice();
    this.F.p = this.p;
    this.sky = copy3(SKY[k]);
    this.hills = copy3(HILL[k]);
    this.bowProg = this.p[6] > 0.5 ? 1 : 0;
    this.clouds.items.forEach((it) => { it.vis = smooth(it.thr - 0.01, it.thr + 0.04, this.p[1]); });
    this.figure.umb = this.p[2] > 0.5 ? 1 : 0;
    this.figure.man = this.p[7] > 0.5 ? 1 : 0;
    this.pAsObj();
  }

  setCamera(mode, instant = false) {
    this.camTarget = mode === 'high' ? 1 : 0;
    if (instant || !this.camInit) this.cam = this.camTarget;
    this.camInit = true;
  }

  setGarden(g) {
    this.terrain.setGarden(g, this.t);
  }

  // 꽃을 심을 수 있는 가장 아래 y (오늘 화면의 메모 칸 위). null이면 기본 범위.
  setGardenLimit(y) {
    this.gardenLimit = Number.isFinite(y) ? y : null;
  }

  setHour(h) {
    this.hourTarget = h == null ? null : ((h % 24) + 24) % 24;
  }

  on(evt, fn) {
    (this.listeners[evt] ??= new Set()).add(fn);
    return () => this.listeners[evt].delete(fn);
  }

  emit(evt, v) {
    this.listeners[evt]?.forEach((fn) => fn(v));
  }

  poke(x, y) {
    const F = this.F;
    const gy = y - F.camShift;
    this.fx.poke(F, x, y, this.targetKey === 'neutral' ? null : this.targetKey);
    if (this.targetKey === 'cloudy') this.clouds.push(F, x, y);
    if (Math.abs(x - F.px) < 30 && gy > F.py - 48 && gy < F.py + 14) this.figure.poked();
    if (Math.abs(x - F.tx) < 34 && gy > F.py - 110 && gy < F.py + 8) {
      this.terrain.shakeTree();
      this.fx.leaves(x, y);
    }
  }

  // ── 매 프레임 갱신 ──

  pAsObj() {
    // 모듈에서 읽기 쉽게 이름을 붙인 값
    const o = this.F.p;
    KEYS.forEach((k, i) => { o[k] = this.p[i]; });
  }

  realHour() {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  update(dt) {
    const F = this.F;
    this.t += dt;
    F.t = this.t;
    F.q = this.q;
    F.reduced = this.reduced;
    const target = PARAMS[this.targetKey];
    for (let i = 0; i < KEYS.length; i += 1) this.p[i] += (target[i] - this.p[i]) * (1 - Math.exp(-dt / TAU[i]));
    this.pAsObj();
    const k = 1 - Math.exp(-dt / 1.1);
    const tSky = SKY[this.targetKey];
    const tHill = HILL[this.targetKey];
    for (let i = 0; i < 6; i += 1) for (let c = 0; c < 3; c += 1) this.sky[i][c] += (tSky[i][c] - this.sky[i][c]) * k;
    for (let i = 0; i < 3; i += 1) for (let c = 0; c < 3; c += 1) this.hills[i][c] += (tHill[i][c] - this.hills[i][c]) * k;

    // 시각은 짧은 쪽으로 부드럽게 흘러간다 (낮에서 밤으로 바꾸면 해가 진다)
    const ht = this.hourTarget ?? this.realHour();
    if (!this.hourInit) { this.hour = ht; this.hourInit = true; }
    const diff = ((ht - this.hour + 36) % 24) - 12;
    this.hour = (this.hour + diff * (1 - Math.exp(-dt / 0.55)) + 24) % 24;

    // 카메라는 0.9초에 걸쳐 직선으로 움직이고 이징을 입힌다
    const step = dt / 0.9;
    this.cam += clamp(this.camTarget - this.cam, -step, step);
    const ce = this.cam * this.cam * (3 - 2 * this.cam);

    // 무지개는 왼쪽에서 오른쪽으로 1.8초에 걸쳐 그려진다
    const bowGoal = this.p[6] > 0.5 ? 1 : 0;
    this.bowProg += clamp(bowGoal - this.bowProg, -dt / 1.1, dt / 1.8);

    F.camShift = ce * this.h * 0.58;
    F.camEase = ce;
    this.prepare();
    this.clouds.update(dt, F);
    this.celestial.update(dt, F);
    this.terrain.update(dt);
    this.fx.update(dt, F);
    F.flinchLevel = this.fx.flinch;
    this.figure.update(dt, F);
    this.maybeEmit();
  }

  // 시각과 날씨로 이번 프레임의 색과 위치를 정한다
  prepare() {
    const F = this.F;
    const p = F.p;
    const { night, warm } = timeFactors(this.hour);
    F.night = night;
    F.warm = warm;
    const dawn = this.hour < 12;
    const warmK = warm * (1 - 0.5 * clamp(p.dark));

    const base = [0, 1, 2].map((i) => mixc(this.sky[i], this.sky[i + 3], night));
    F.sky = [
      mixc(base[0], [92, 86, 160], warmK * 0.26),
      mixc(base[1], dawn ? [250, 156, 190] : [245, 124, 152], warmK * 0.46),
      mixc(base[2], dawn ? [255, 184, 142] : [255, 150, 92], warmK * 0.8),
    ];

    const warmTint = mixc(WHITE, [1, 0.9, 0.8].map((v) => v * 255), warm * 0.6).map((v) => v / 255);
    const nightLift = [10 * night, 13 * night, 28 * night];
    const hillColor = (c) => {
      const dayC = mulc(c, warmTint);
      const nightC = mulc(c, NIGHT_MUL);
      return mixc(dayC, [nightC[0] + nightLift[0], nightC[1] + nightLift[1], nightC[2] + nightLift[2]], night);
    };
    F.hillFar = hillColor(this.hills[0]);
    F.hillTopC = hillColor(this.hills[1]);
    F.hillBotC = hillColor(this.hills[2]);

    const dk = clamp(p.dark);
    const ambDay = [1 - 0.3 * dk, 1 - 0.26 * dk, 1 - 0.14 * dk];
    const ambNight = [0.5, 0.56, 0.8];
    F.amb = mulc(mixc(ambDay, ambNight, night), warmTint);
    F.lantern = Math.max(night, smooth(0.25, 0.6, dk));
    F.ambSoft = mixc(mixc(F.amb, WHITE.map(() => 1), 0.45), [1, 0.96, 0.9], F.lantern * 0.3);
    F.leafLight = 0.6 + 0.4 * (1 - night);

    // 구름 색
    const d = clamp(dk / 0.5);
    const light = CLOUD_LIGHT;
    const rain = CLOUD_RAIN;
    const thunder = CLOUD_THUNDER;
    const pick = (key) => (dk <= 0.5 ? mixc(light[key], rain[key], d) : mixc(rain[key], thunder[key], clamp((dk - 0.65) / 0.35)));
    let top = pick('top');
    let mid = pick('mid');
    let bot = pick('bot');
    const nm = [0.32, 0.38, 0.6];
    const nightK = night * 0.88;
    top = mixc(top, mulc(top, nm), nightK);
    mid = mixc(mid, mulc(mid, nm), nightK);
    bot = mixc(bot, mulc(bot, nm), nightK);
    top = mixc(top, [255, 196, 170], warm * 0.5);
    mid = mixc(mid, [255, 172, 160], warm * 0.36);
    bot = mixc(bot, [214, 130, 152], warm * 0.4);
    this.tone = {
      top, mid, bot,
      hi: [255, 255, 255],
      hiA: 0.62 * (1 - 0.65 * dk) * (1 - 0.7 * night),
      shade: mixc([108, 128, 176], [38, 28, 78], dk),
      shadeA: lerp(0.28, 0.5, dk),
    };
    F.cloudAlpha = 1;
    this.clouds.retone(this.tone, this.t, this.stillMode);

    // 해와 달
    const R = this.w * 0.082;
    const horizon = F.hillTop * 0.97;
    const low = horizon + R * 1.4;
    const shift = F.camShift * 0.2;
    const ts = (this.hour - 5.6) / 14;
    F.sunX = lerp(0.3, 0.9, ts) * this.w;
    F.sunY = low - (low - F.hillTop * 0.58) * Math.sin(clamp(ts, 0, 1) * Math.PI) + shift;
    const hm = this.hour >= 12 ? this.hour - 18 : this.hour + 6;
    const tm = hm / 12;
    F.moonX = lerp(0.3, 0.9, tm) * this.w;
    F.moonY = low - (low - F.hillTop * 0.42) * Math.sin(clamp(tm, 0, 1) * Math.PI) + shift;
    if (this.clear) {
      // 제목 자리를 피해 해와 달을 오른쪽 위로 옮긴다
      const c = this.clear;
      const R2 = this.w * 0.082 * 1.9;
      const right = c.x + c.w;
      const move = (x, y) => {
        if (x - R2 > right || y - R2 > c.y + c.h || x + R2 < c.x || y + R2 < c.y) return [x, y];
        const nx = clamp(right + R2, R2, this.w - R2);
        return nx - R2 >= right - 4 ? [nx, Math.max(R2 * 0.9, Math.min(y, c.y + R2 * 0.5))] : [clamp(x, R2, this.w - R2), c.y + c.h + R2];
      };
      [F.sunX, F.sunY] = move(F.sunX, F.sunY);
      [F.moonX, F.moonY] = move(F.moonX, F.moonY);
    }
    F.clear = this.clear;
    F.gardenLimit = this.gardenLimit;
    const vis = smooth(0.04, 0.4, p.sun);
    F.sunAlpha = vis * (1 - night);
    F.moonAlpha = vis * night;
    F.sunWarm = warm;
    F.starVis = smooth(0.35, 1, night) * (1 - smooth(0.15, 0.8, p.cloud)) * (1 - clamp(p.dark));
    F.bowProg = this.bowProg * this.bowProg * (3 - 2 * this.bowProg) * 0.5 + this.bowProg * 0.5;
    F.bowAlpha = smooth(0, 0.15, this.bowProg) * (1 - night * 0.5);
    // 달력·예보처럼 하늘이 뒤로 물러난 화면에서는 해, 달, 무지개를 약 80% 줄여 조용하게 한다
    const calm = 1 - 0.8 * F.camEase;
    F.sunAlpha *= calm;
    F.moonAlpha *= calm;
    F.bowAlpha *= calm;

    // 글자색(ink)과 상태 표시줄 색을 위해 하늘 윗부분의 밝기를 가늠한다
    const gEnd = F.hillTop * 1.03 + F.camShift * 0.5;
    const at = (y) => {
      const u = clamp(y / gEnd);
      return u < 0.55 ? mixc(F.sky[0], F.sky[1], u / 0.55) : mixc(F.sky[1], F.sky[2], (u - 0.55) / 0.45);
    };
    const cover = smooth(0.3, 1, p.cloud);
    this.inkLum = lerp(lum(at(this.h * 0.17)), lum(mid), cover * 0.5);
    this.themeColor = mixc(at(0), mid, cover * 0.9);
    this.gEnd = gEnd;
  }

  maybeEmit() {
    if (this.t < this.nextEmit) return;
    this.nextEmit = this.t + 0.2;
    const want = this.inkNow === 'navy' ? (this.inkLum > 0.7 ? 'navy' : 'white') : (this.inkLum > 0.76 ? 'navy' : 'white');
    if (want !== this.inkNow || !this.inkSent) {
      this.inkNow = want;
      this.inkSent = true;
      this.emit('ink', want);
    }
    const hexColor = toHex(this.themeColor);
    if (hexColor !== this.themeNow) {
      this.themeNow = hexColor;
      this.emit('theme', hexColor);
    }
  }

  // ── 그리기 ──

  draw(ctx, { hill = true } = {}) {
    const F = this.F;
    const { w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, this.gEnd);
    g.addColorStop(0, css(F.sky[0]));
    g.addColorStop(0.55, css(F.sky[1]));
    g.addColorStop(1, css(F.sky[2]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const parallax = F.camShift * 0.2;
    ctx.save();
    ctx.translate(0, parallax);
    this.celestial.drawStars(ctx, F);
    this.celestial.drawSun(ctx, F);
    this.celestial.drawMoon(ctx, F);
    this.celestial.drawRainbow(ctx, F);
    ctx.restore();
    this.clouds.drawBand(ctx, F, 0);
    ctx.save();
    ctx.translate(0, parallax);
    this.clouds.drawLayers(ctx, F, 0, 0);
    ctx.restore();

    if (hill) this.terrain.drawFar(ctx, F, F);
    if (!this.stillMode) this.fx.drawBolt(ctx, F);

    ctx.save();
    ctx.translate(0, parallax);
    this.clouds.drawLayers(ctx, F, 1, 2);
    ctx.restore();
    this.clouds.drawBand(ctx, F, 1);
    this.fx.drawCloudGlow(ctx, F);
    if (this.stillMode) this.fx.drawBolt(ctx, F);

    this.fx.drawBackRain(ctx, F);
    this.fx.drawSnow(ctx, F, false);

    if (hill) {
      ctx.save();
      ctx.translate(0, F.camShift);
      this.terrain.drawNear(ctx, F, F);
      this.terrain.drawFlowers(ctx, F, F, this.t);
      this.figure.drawSnowman(ctx, F);
      this.terrain.drawTree(ctx, F, F);
      this.figure.draw(ctx, F);
      this.figure.drawLantern(ctx, F);
      ctx.restore();
    }

    this.fx.drawFrontRain(ctx, F);
    this.fx.drawSnow(ctx, F, true);
    this.fx.drawEffects(ctx, F);
    this.fx.drawFlash(ctx, F);
  }

  // 한 장면을 정지 상태로 만든다 (카드 이미지용)
  settle(id) {
    this.stillMode = true;
    this.fx.still = true;
    this.setWeather(id, true);
    this.hourInit = false;
    this.update(0.016);
    this.t = 4.3;
    this.update(0.016);
    this.clouds.items.forEach((it) => { it.vis = smooth(it.thr - 0.01, it.thr + 0.04, this.p[1]); });
    this.terrain.growth = this.terrain.growthTarget;
    if (this.targetKey === 'thunder') {
      this.fx.strike(this.F);
      this.fx.bolt.age = 0.03;
      this.fx.bolt.dur = 99;
    }
    this.update(0);
  }
}
