// 하늘 엔진: 장면 상태(날씨×시간대), 전환, 그리기 순서, 품질 조절, 만지기, 저장 연출 (design-spec §5, §6)
import * as P from '../palette.js';
import * as A from './art.js';
import { Rain, Snow } from './particles.js';
import { ease, seg, Spring, SPR } from '../ui/spring.js';
import { rng, mulberry32, hashStr } from '../dates.js';

const TAU = Math.PI * 2;
const BOARD = '#0F1726';
// [프리셋, 앞(1)/먼(0)], y 범위(H 비율), 표류 px/s
const CLOUD_CFG = {
  none: { list: [['C3', 0], ['C3', 0]], y: [0.15, 0.45], v: [4, 4] },
  sunny: { list: [['C3', 0], ['C3', 0]], y: [0.12, 0.34], v: [8, 8] },
  cloudy: { list: [['C1', 1], ['C1', 1], ['C2', 0], ['C2', 0], ['C3', 0], ['C3', 0]], y: [0.1, 0.52], v: [6, 14] },
  rain: { list: [['C1', 1], ['C1', 1], ['C1', 0], ['C2', 0], ['C2', 0]], y: [0.02, 0.24], v: [10, 10] },
  thunder: { list: [['C1', 1], ['C1', 1], ['C1', 0], ['C1', 0], ['C2', 0]], y: [0.04, 0.26], v: [14, 14] },
  snow: { list: [['C2', 1], ['C2', 0]], y: [0.08, 0.3], v: [4, 4] },
  rainbow: { list: [['C2', 1], ['C3', 0], ['C3', 0]], y: [0.4, 0.55], v: [8, 8], edge: true },
};
function boltAlpha(e) { if (e < 0) return 0; if (e < 60) return 1 - 0.7 * (e / 60); if (e < 100) return 0.3 + 0.5 * ((e - 60) / 40); if (e < 260) return 0.8 * (1 - (e - 100) / 160); return 0; }

export class Sky {
  constructor(cv, o) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.reduced = !!o.reduced; this.key = o.dayKey; this.phase = o.moonPhase;
    this.w = null; this.tod = null; this.t = 0; this.visible = true; this.L = null; this.dpr = 1;
    this.q = 0; this.qWin = { t: 0, n: 0 }; this.qLog = []; this.lastFps = 0;
    this.skyCur = null; this.skyTo = null; this.skyAnim = null; this.skyHex = [BOARD, BOARD, BOARD];
    this.ground = []; this.gCache = new Map(); this.sunCache = new Map();
    this.clouds = []; this.cel = [];
    this.starA = 0; this.starT = 0; this.starTau = 250; this.milkyA = 0; this.milkyT = 0;
    this.rb = null;
    const seed = hashStr(o.dayKey);
    this.rain = new Rain(seed ^ 0x51); this.snow = new Snow(seed ^ 0x77);
    this.bolts = []; this.flash = null; this.lastFlash = -1e9; this.nextBolt = Infinity; this.thunder = false; this.scrubbing = false;
    this.br = mulberry32(seed ^ 0x3131); this.lastBolt = -1e9; this.flick = null; this.nextFlick = 0; this.lastTouchBolt = -1e9; this.staticBolt = null;
    this.fr = { w: 'none', pend: null, propS: new Spring(1, SPR.bounce, 0.002), sx: new Spring(1, SPR.bounce, 0.001), sy: new Spring(1, SPR.bounce, 0.001), jumpT: -1e9, jumpH: 0, jumpD: 360, landed: true, blinkAt: 1800, up: 0, rr: mulberry32(seed ^ 0x99), happyUntil: -1 };
    this.touch = null; this.bloom = null; this.sparks = []; this.sparkI = 0; this.pending = null;
    this.layerOff = [0, 0, 0]; this.friendOff = 0; this.introA = 1; this.intro = null; this.friendS = null;
    this.seal = null; this.breath = 1; this.precipMul = 1; this.blinkFast = -1e9; this.finale = null;
    this.friendBase = 0; this.friendJumpPx = 0;
  }
  resize(L) {
    this.L = L;
    const dpr = this.q >= 2 ? 1 : Math.min(2, window.devicePixelRatio || 1); this.dpr = dpr;
    this.cv.width = Math.round(L.W * dpr); this.cv.height = Math.round(L.H * dpr);
    this.cv.style.width = L.W + 'px'; this.cv.style.height = L.H + 'px';
    const hr = rng(this.key, 'hills'); this.hills = [0, 1, 2].map((i) => A.hillSpec(i, L, hr));
    this.stars = A.makeStars(rng(this.key, 'stars'), L.W, L.H);
    this.milky = A.makeMilky(rng(this.key, 'milky'), L.W, L.H, dpr);
    this.milkyMoon = A.ringColor(this.milky, dpr, L.moon.x, L.moon.y, L.moon.r);
    this.rbSprite = A.makeRainbow(L, dpr); this.rbNight = A.makeRainbow(L, dpr, true);
    this.moonHalo = A.haloSprite(P.MOON.halo, P.MOON.haloA, L.moon.r * 0.9, 140 * L.s, dpr);
    this.lanternGlow = A.haloSprite('#FFC66B', 0.3, 2, 28 * (L.friend.h / 56), dpr);
    this.gCache.clear(); this.sunCache.clear(); this.rain.clear(); this.snow.clear();
    if (this.w !== null) { const w = this.w, tod = this.tod; this.w = null; this.setScene(w, tod, 'instant'); }
  }
  // ---------- 장면 ----------
  setScene(w, tod, mode = 'tap') {
    if (!this.L) { this.w = w; this.tod = tod; return; }
    if (w === this.w && tod === this.tod) return;
    if (this.reduced && mode !== 'instant') mode = 'fade';
    const wChanged = w !== this.w;
    this.w = w; this.tod = tod; this.scrubbing = mode === 'scrub';
    this.skyTarget(P.skyStops(w, tod), mode);
    this.pushGround(this.groundSet(w, tod), mode);
    this.swapClouds(w, tod, mode);
    this.swapCel(w, tod, mode);
    this.starT = this.starTarget(w, tod); this.milkyT = this.milkyTarget(w, tod);
    this.starTau = mode === 'tod' ? 2000 : 250;
    if (mode === 'instant') { this.starA = this.starT; this.milkyA = this.milkyT; }
    if (w === 'rainbow') { if (!this.rb || this.rb.out) this.rb = { t0: this.t, mode, a: mode === 'instant' ? 1 : 0, sweep: mode === 'tap' || mode === 'scrub' ? 0 : 1, out: false }; }
    else if (this.rb && !this.rb.out) { if (mode === 'instant') this.rb = null; else { this.rb.out = true; this.rb.t1 = this.t; this.rb.mode = mode; this.rb.a0 = this.rb.a; } }
    if (w === 'rain') { if (this.rain.target !== 1) this.rain.start(this.t, mode, 500); } else if (this.rain.target === 1) this.rain.stop(mode); else if (mode === 'instant') this.rain.clear();
    if (w === 'snow') { if (this.snow.target !== 1) this.snow.start(this.t, mode, 600); } else if (this.snow.target === 1) this.snow.stop(mode); else if (mode === 'instant') this.snow.clear();
    this.thunder = w === 'thunder'; this.staticBolt = null;
    if (this.thunder) {
      if (this.reduced) this.staticBolt = this.autoBolt(mulberry32(hashStr(this.key + 'sb')));
      this.nextBolt = this.t + (mode === 'instant' ? 900 : mode === 'scrub' ? 400 : 280);
    } else this.nextBolt = Infinity;
    if (wChanged) {
      if (mode === 'instant' || mode === 'fade' || mode === 'tod') { this.fr.w = w; this.fr.pend = null; this.fr.propS.set(1); }
      else this.fr.pend = { w, at: this.t + (mode === 'scrub' ? 60 : 180) };
    }
  }
  setTod(tod, mode = 'tod') { this.setScene(this.w, tod, mode); }
  commit() {
    if (!this.scrubbing) return; this.scrubbing = false;
    if (this.skyAnim && this.skyAnim.follow) this.skyAnim = { from: this.skyCur.map((a) => a.slice()), to: this.skyTo, t0: this.t, dur: 420 };
  }
  stops() { return P.skyStops(this.w || 'none', this.tod || 'day'); }
  starTarget(w, tod) {
    if (tod === 'night') return w === 'rain' || w === 'thunder' ? 0 : w === 'cloudy' ? 0.45 : 1;
    if (tod === 'dawn') return w === 'none' || w === 'sunny' || w === 'rainbow' ? 0.42 : 0;
    if (tod === 'dusk') return w === 'none' || w === 'sunny' ? 0.2 : 0;
    return 0;
  }
  milkyTarget(w, tod) { return tod === 'night' && ['none', 'sunny', 'rainbow', 'snow'].includes(w) ? 1 : 0; }
  skyTarget(stops, mode) {
    const to = stops.map((h) => P.toOklab(h)); this.skyTo = to;
    if (!this.skyCur || mode === 'instant') { this.skyCur = to.map((a) => a.slice()); this.skyAnim = null; this.skyHex = stops.slice(); return; }
    if (mode === 'scrub') { this.skyAnim = { follow: 90 }; return; }
    this.skyAnim = { from: this.skyCur.map((a) => a.slice()), to, t0: this.t, dur: mode === 'tod' ? 6000 : mode === 'fade' ? 240 : 620 };
  }
  updSky(dt) {
    const S = this.skyAnim; if (!S) return;
    if (S.follow) { const k = 1 - Math.exp(-dt / S.follow); for (let i = 0; i < 3; i++) this.skyCur[i] = P.lerp3(this.skyCur[i], this.skyTo[i], k); }
    else { const p = ease.inout(seg(this.t, S.t0, S.dur)); for (let i = 0; i < 3; i++) this.skyCur[i] = P.lerp3(S.from[i], S.to[i], p); if (p >= 1) this.skyAnim = null; }
    this.skyHex = this.skyCur.map((c) => P.rgb2hex(P.fromOklab(c)));
  }
  skyAt(y) { return P.mix(this.skyHex[0], this.skyHex[1], Math.max(0, Math.min(1, y / (0.5 * this.L.H)))); }
  // 달 어두운 면 색(fix1-9): 그 자리 하늘 + 미리내(달 둘레 미리 잰 값) + 달 빛무리를 같은 순서로 겹친 색. 화면을 다시 읽지 않는다
  moonDark(x, y, r, a) {
    let col = P.hex2rgb(this.skyAt(y));
    const mk = this.milkyMoon; if (mk && this.milkyA > 0.01) { const k = mk[3] * this.milkyA * this.introA * this.sealStarK(); col = col.map((v, i) => v * (1 - k) + mk[i] * k); }
    const r0 = r * 0.9, R = 140 * this.L.s, ha = P.MOON.haloA * a * Math.max(0, 1 - (r + 5 - r0) / (R - r0)); const hc = P.hex2rgb(P.MOON.halo);
    return P.rgb2hex(col.map((v, i) => v * (1 - ha) + hc[i] * ha));
  }
  // ---------- 땅 ----------
  groundSet(w, tod) {
    const k = w + '|' + tod; let g = this.gCache.get(k);
    if (g) { this.gCache.delete(k); this.gCache.set(k, g); return g; }
    const L = this.L, dpr = this.dpr, s = L.s;
    const G = P.ground(w, tod), bot = P.skyStops(w, tod)[2];
    const cols = [P.mix(G, bot, 0.55), P.mix(G, bot, 0.25), G];
    const snow = w === 'snow' ? P.snowCap(tod) : null;
    const night = tod === 'night', lit = tod !== 'day';
    const layers = [0, 1, 2].map((i) => {
      const h = this.hills[i];
      const y0 = i === 0 ? L.crest[0] - 72 * s : i === 1 ? L.crest[1] - 86 * s : L.crest[2] - 30;
      const y1 = i < 2 ? L.crest[i + 1] + 40 : L.H + 50;
      return A.hillLayer({ h, color: cols[i], W: L.W, ox: 8, y0, y1, dpr, rand: rng(this.key, 'hill', i), snow, grass: i === 1 ? 40 : i === 2 ? 30 : 0,
        extra: (c) => { if (i === 0) A.drawHouse(c, L.houseX, A.hillY(h, L.houseX) + 3, s, cols[0], lit, snow); if (i === 1) A.drawScreen(c, L.screenX, A.hillY(h, L.screenX) + 4, s, night, snow); } });
    });
    const trees = [A.treeSprite('round', G, snow, dpr, s, rng(this.key, 'tree', 0)), A.treeSprite('pointy', G, snow, dpr, s, rng(this.key, 'tree', 1))];
    g = { k, layers, trees }; this.gCache.set(k, g);
    while (this.gCache.size > 6) this.gCache.delete(this.gCache.keys().next().value);
    return g;
  }
  pushGround(g, mode) {
    const st = this.ground, top = st[st.length - 1];
    if (top && top.g === g) return;
    if (mode === 'instant' || !top) { this.ground = [{ g, a: 1 }]; return; }
    st.push({ g, a: 0, mode, t0: this.t + (mode === 'tap' ? 60 : 0), dur: mode === 'tod' ? 6000 : mode === 'fade' ? 240 : 660 });
    if (st.length > 4) { st.splice(0, st.length - 4); st[0].a = 1; }
  }
  updGround(dt) {
    const st = this.ground;
    for (let i = 1; i < st.length; i++) { const e = st[i]; if (e.mode === 'scrub') e.a += (1 - e.a) * (1 - Math.exp(-dt / 90)); else e.a = ease.inout(seg(this.t, e.t0, e.dur)); if (e.a > 0.998) e.a = 1; }
    for (let i = st.length - 1; i > 0; i--) if (st[i].a >= 1) { st.splice(0, i); st[0].a = 1; break; }
  }
  drawGround(i) {
    const c = this.ctx;
    for (const e of this.ground) { if (e.a <= 0) continue; const Lr = e.g.layers[i]; c.globalAlpha = e.a; c.drawImage(Lr.cv, -Lr.ox, Lr.y0 + this.layerOff[i], this.L.W + 2 * Lr.ox, Lr.h); } // 언덕 좌우 8 넉넉히(숨 들이쉬기 .985에도 끝이 안 드러남, fix1-8)
    c.globalAlpha = 1;
  }
  drawTrees() {
    const c = this.ctx, L = this.L; const amp = { rain: 4, thunder: 4, cloudy: 2.5, snow: 2.5 }[this.w] || 1.5;
    const sw = this.reduced ? 0 : Math.sin((TAU * this.t) / 2800);
    for (const e of this.ground) {
      if (e.a <= 0) continue; c.globalAlpha = e.a;
      e.g.trees.forEach((tr, j) => {
        const x = L.trees[j], y = A.hillY(this.hills[0], x) + 2 + this.layerOff[0];
        const k = -(amp * sw * (j ? 0.8 : 1)) / (tr.top || 40);
        c.save(); c.translate(x, y); c.transform(1, 0, k, 1, 0, 0); c.drawImage(tr.cv, -tr.ox, -tr.oy, tr.w, tr.h); c.restore();
      });
    }
    c.globalAlpha = 1;
  }
  drawScreenLight() {
    const L = this.L, c = this.ctx, t = this.t;
    const x = L.screenX, y = A.hillY(this.hills[1], x) + 4 + this.layerOff[1] - 31 * L.s;
    const ef = t - this.blinkFast; let on;
    if (ef >= 0 && ef < 360) on = Math.floor(ef / 60) % 2 === 0; else on = this.reduced ? true : t % 3000 < 2200;
    c.fillStyle = on ? '#E8695A' : '#8A4038'; c.beginPath(); c.arc(x, y, 1.25 * L.s, 0, TAU); c.fill();
    if (on && (this.tod === 'night' || this.tod === 'dusk')) { c.globalAlpha = 0.22; c.beginPath(); c.arc(x, y, 3.6 * L.s, 0, TAU); c.fill(); c.globalAlpha = 1; }
  }
  // ---------- 구름 ----------
  cloudGroup(w, tod) {
    const L = this.L, s = L.s, cfg = CLOUD_CFG[w]; const r = rng(this.key, 'clouds', w);
    const col = P.cloudColors(w, tod); col.rimMode = tod === 'dusk' ? 'bottom' : tod === 'night' ? 'tl' : null;
    const n = cfg.list.length; const slots = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    const items = cfg.list.map(([preset, front], i) => {
      const big = (w === 'rain' || w === 'thunder') && preset === 'C1' ? 1.25 + r() * 0.25 : w === 'cloudy' ? (front ? 1.15 : 1.08) : 1;
      const sc = s * big * (front ? 1 + r() * 0.15 : 0.78 + r() * 0.14) * (cfg.edge && i === 0 ? 1.3 : 1);
      const sseed = Math.floor(r() * 1e9);
      const spr = A.cloudSprite(preset, sc, col, this.dpr, mulberry32(sseed));
      const lit = w === 'thunder' ? A.cloudSprite(preset, sc, col, this.dpr, mulberry32(sseed), true) : null;
      const x0 = ((slots[i] + 0.5 + (r() - 0.5) * 0.6) / n) * L.W * 1.2 - L.W * 0.1;
      const y = (cfg.y[0] + (cfg.y[1] - cfg.y[0]) * r()) * L.H;
      const v = (cfg.v[0] + (cfg.v[1] - cfg.v[0]) * (front ? 1 : r() * 0.6)) * s;
      return { spr, lit, x0, y, v, front: !!front, px: new Spring(0, SPR.soft, 0.05), py: new Spring(0, SPR.soft, 0.05) };
    });
    if (w === 'cloudy') { const it = items.find((x) => x.front); it.x0 = L.sun.x - 34 * s; it.y = L.sun.y + 50 * s; it.v = 3 * s; } // 해를 반쯤 가리는 구름 한 덩이
    if (cfg.edge) {
      const cy = L.crest[0] + 130, R = 0.62 * L.W;
      const S0 = this.rbSprite, Rm = S0.R - 3 * S0.bw; items[0].x0 = S0.cx + Rm * Math.cos(S0.a1); items[0].y = S0.cy + Rm * Math.sin(S0.a1) + 36 * s; items[0].v = 0; // 무지개 끝(지름 방향으로 자른 자리)을 가림(fix1-7)
      items[1].x0 = 0.1 * L.W; items[1].y = 0.47 * L.H; items[2].x0 = 0.5 * L.W; items[2].y = 0.4 * L.H;
    }
    return { w, tod, items, a: 1, dx: 0, state: 'live', t0: 0, mode: 'instant' };
  }
  cloudX(it) {
    const span = this.L.W + it.spr.width + 60;
    const x = it.x0 + (this.reduced ? 0 : (it.v * this.t) / 1000) + it.spr.width / 2 + 30;
    return (((x % span) + span) % span) - it.spr.width / 2 - 30;
  }
  swapClouds(w, tod, mode) {
    const g = this.cloudGroup(w, tod);
    if (mode === 'instant') { this.clouds = [g]; return; }
    for (const o of this.clouds) if (o.state !== 'exit') { o.state = 'exit'; o.t0 = this.t; o.mode = mode; o.a0 = o.a; }
    g.state = 'enter'; g.t0 = this.t; g.mode = mode; g.a = 0; this.clouds.push(g);
    const ex = this.clouds.filter((o) => o.state === 'exit'); if (ex.length > 3) this.clouds.splice(this.clouds.indexOf(ex[0]), 1);
  }
  updClouds(dt) {
    const t = this.t, s = this.L.s;
    for (const o of this.clouds) {
      if (o.state === 'enter') {
        if (o.mode === 'tod' || o.mode === 'fade') { o.a = seg(t, o.t0, o.mode === 'tod' ? 6000 : 240); o.dx = 0; if (o.a >= 1) o.state = 'live'; }
        else { const d0 = o.mode === 'scrub' ? 40 : 120; const p = seg(t, o.t0 + d0, 760); o.dx = 80 * s * (1 - ease.out(p)); o.a = ease.out(seg(t, o.t0 + d0, 300)); if (p >= 1) o.state = 'live'; }
      } else if (o.state === 'exit') {
        if (o.mode === 'tod' || o.mode === 'fade') { o.a = o.a0 * (1 - seg(t, o.t0, o.mode === 'tod' ? 6000 : 240)); o.dx = 0; }
        else { o.dx = -this.L.W * 0.9 * ease.in(seg(t, o.t0, 420)); o.a = o.a0 * (1 - ease.in(seg(t, o.t0 + 140, 280))); }
        if (o.a <= 0.001) o.dead = true;
      } else { o.a = 1; o.dx = 0; }
      for (const it of o.items) { it.px.step(dt); it.py.step(dt); }
    }
    this.clouds = this.clouds.filter((o) => !o.dead);
  }
  drawClouds(front) {
    const c = this.ctx, L = this.L;
    const glowA = this.thunder ? Math.max(0, 1 - (this.t - this.lastBolt) / 600) : 0;
    const part = this.finale && this.finale.w === 'cloudy' ? this.finale.part || 0 : 0;
    for (const o of this.clouds) {
      const a = o.a * this.introA; if (a <= 0.003) continue;
      for (let i = 0; i < o.items.length; i++) {
        const it = o.items[i]; if (it.front !== front) continue;
        let x = this.cloudX(it) + o.dx + it.px.x; const y = it.y + it.py.x;
        if (part) x += (x < L.W / 2 ? -1 : 1) * part * Math.max(0, 1 - Math.abs(x - L.W / 2) / (L.W * 0.75));
        c.globalAlpha = a; c.drawImage(it.spr.cv, x - it.spr.ox, y - it.spr.oy, it.spr.w, it.spr.h);
        if (it.lit) {
          let g2 = glowA;
          if (this.flick && this.flick.i === i && o.state !== 'exit') g2 = Math.max(g2, this.flick.a);
          if (this.finale && this.finale.w === 'thunder' && this.finale.ci === i && o.state !== 'exit') g2 = Math.max(g2, this.finale.glow || 0);
          if (g2 > 0.01) { c.globalAlpha = a * g2; c.drawImage(it.lit.cv, x - it.lit.ox, y - it.lit.oy, it.lit.w, it.lit.h); }
        }
      }
    }
    c.globalAlpha = 1;
  }
  // ---------- 해·달 ----------
  celFor(w, tod) {
    if (w === 'rain' || w === 'thunder') return null;
    if (tod === 'night') return { kind: 'moon', a: w === 'cloudy' ? 0.8 : 1 };
    if (w === 'snow') return null;
    return { kind: tod === 'dusk' ? 'dusksun' : 'sun', a: w === 'cloudy' ? 0.72 : 1 };
  }
  swapCel(w, tod, mode) {
    const want = this.celFor(w, tod); const cur = this.cel.find((c) => c.state !== 'exit');
    if (cur && want && cur.kind === want.kind && cur.tod === tod) { cur.target = want.a; return; }
    if (mode === 'instant') { this.cel = want ? [{ ...want, tod, state: 'live', target: want.a, ac: want.a, dy: 0 }] : []; return; }
    if (cur) { cur.state = 'exit'; cur.t0 = this.t; cur.mode = mode; cur.a0 = cur.ac; }
    if (want) this.cel.push({ ...want, tod, state: 'enter', t0: this.t, mode, target: want.a, ac: 0, dy: mode === 'tod' || mode === 'fade' ? 0 : 40 });
  }
  updCel(dt) {
    const t = this.t;
    for (const c of this.cel) {
      if (c.state === 'enter') {
        if (c.mode === 'tod' || c.mode === 'fade') { const d = c.mode === 'tod' ? 6000 : 240; const p = seg(t, c.t0, d); c.ac = c.target * p; c.dy = 0; if (p >= 1) c.state = 'live'; }
        else { const p = seg(t, c.t0 + 120, 760); c.dy = 40 * (1 - ease.out(p)); c.ac = c.target * ease.out(seg(t, c.t0 + 120, 420)); if (p >= 1) c.state = 'live'; }
      } else if (c.state === 'exit') {
        const d = c.mode === 'tod' ? 6000 : c.mode === 'fade' ? 240 : 420; const p = seg(t, c.t0, d);
        if (c.mode === 'tod' || c.mode === 'fade') c.ac = c.a0 * (1 - p); else { const q = ease.in(p); c.dy = 40 * q; c.ac = c.a0 * (1 - q); }
        if (p >= 1) c.dead = true;
      } else { c.ac += (c.target - c.ac) * (1 - Math.exp(-dt / 200)); c.dy = 0; }
    }
    this.cel = this.cel.filter((c) => !c.dead);
  }
  drawCel() {
    const c = this.ctx, L = this.L, t = this.t;
    const breath = this.reduced ? 1 : 1 + 0.03 * Math.sin((TAU * t) / 6000);
    const haloK = this.finale && this.finale.w === 'sunny' ? 1 + 0.4 * (this.finale.halo || 0) : 1;
    for (const b of this.cel) {
      const a = b.ac * this.introA; if (a <= 0.005) continue;
      if (b.kind === 'moon') {
        const m = L.moon, y = m.y + b.dy, H0 = this.moonHalo, hs = breath * haloK;
        c.globalAlpha = a; c.drawImage(H0.cv, m.x - H0.R * hs, y - H0.R * hs, H0.R * 2 * hs, H0.R * 2 * hs); c.globalAlpha = 1;
        A.drawMoon(c, m.x, y, m.r * (this.reduced ? 1 : 1 + 0.01 * Math.sin((TAU * t) / 6000)), this.phase, this.moonDark(m.x, y, m.r, a), a);
      } else {
        const dusk = b.kind === 'dusksun'; const pos = dusk ? L.duskSun : L.sun; const tod = dusk ? 'dusk' : b.tod === 'dusk' ? 'day' : b.tod;
        const key = tod + '|' + pos.r.toFixed(2); let spr = this.sunCache.get(key);
        if (!spr) { spr = A.sunSprite(tod, pos.r, L.s, this.dpr); this.sunCache.set(key, spr); }
        const y = dusk ? A.hillY(this.hills[0], pos.x) + 2 + this.layerOff[0] + b.dy : pos.y + b.dy;
        const hk = breath * haloK, k = this.reduced ? 1 : 1 + 0.01 * Math.sin((TAU * t) / 6000);
        c.globalAlpha = a;
        c.drawImage(spr.halo.cv, pos.x - spr.halo.R * hk, y - spr.halo.R * hk, spr.halo.R * 2 * hk, spr.halo.R * 2 * hk);
        c.drawImage(spr.disc.cv, pos.x - spr.disc.R * k, y - spr.disc.R * k, spr.disc.R * 2 * k, spr.disc.R * 2 * k);
        c.globalAlpha = 1;
      }
    }
  }
  updStars(dt) { const k = 1 - Math.exp(-dt / Math.max(1, this.starTau)); this.starA += (this.starT - this.starA) * k; this.milkyA += (this.milkyT - this.milkyA) * k; }
  // ---------- 무지개 ----------
  updRainbow() {
    const R = this.rb; if (!R) return; const t = this.t;
    if (!R.out) {
      if (R.mode === 'tap') { R.sweep = ease.out(seg(t, R.t0 + 120, 800)); R.a = 1; }
      else if (R.mode === 'scrub') { R.sweep = ease.out(seg(t, R.t0, 420)); R.a = 1; }
      else if (R.mode === 'tod' || R.mode === 'fade') { R.a = seg(t, R.t0, R.mode === 'tod' ? 6000 : 240); R.sweep = 1; }
      else { R.a = 1; R.sweep = 1; }
    } else { const d = R.mode === 'tod' ? 6000 : R.mode === 'fade' ? 240 : 420; R.a = R.a0 * (1 - ease.in(seg(t, R.t1, d))); if (seg(t, R.t1, d) >= 1) this.rb = null; }
  }
  drawRainbow() {
    const R = this.rb; if (!R || R.sweep <= 0) return; const night = this.tod === 'night', S = night ? this.rbNight : this.rbSprite, c = this.ctx;
    const base = (night ? 0.3 : 0.7) * R.a * this.introA; if (base <= 0.005) return; // 밤은 희뿌연 달무지개(fix1-10)
    c.save();
    if (R.sweep < 1) { c.beginPath(); c.moveTo(S.cx, S.cy); c.arc(S.cx, S.cy, S.R + 20, Math.PI, Math.PI + (S.a1 - Math.PI) * R.sweep); c.closePath(); c.clip(); }
    c.globalAlpha = base; c.drawImage(S.cv, 0, S.y0, this.L.W, S.h); c.restore();
  }
  // ---------- 번개 ----------
  updBolts() {
    const t = this.t;
    if (this.thunder && !this.reduced && t >= this.nextBolt) { this.spawnBolt(null, null); this.nextBolt = t + 3500 + this.br() * 3500; }
    if (this.bolts.length) this.bolts = this.bolts.filter((b) => t - b.t0 < 280);
    if (this.flash && t - this.flash.t0 > 200) this.flash = null;
    if (this.thunder && !this.reduced && !this.scrubbing) {
      if (!this.flick && t > this.nextFlick) {
        const g = this.clouds.find((o) => o.state !== 'exit'); const far = g ? g.items.map((it, i) => (it.front ? -1 : i)).filter((i) => i >= 0) : [];
        if (far.length && t - this.lastBolt > 900) this.flick = { i: far[Math.floor(this.br() * far.length)], t0: t, a: 0 };
        this.nextFlick = t + 1200 + this.br() * 1600;
      }
      if (this.flick) { const e = t - this.flick.t0; this.flick.a = e < 340 ? 0.55 * Math.sin((Math.PI * e) / 340) * (0.7 + 0.3 * Math.sin(e / 16)) : 0; if (e >= 340) this.flick = null; }
    } else this.flick = null;
  }
  // 자동 번개(fix1-2): 글자 오른쪽 끝 선(W−130) 밖. 시작 x ∈ [W−120, W−24], 구름 아랫변(.22H)에서, 끝 x = 시작 ±40, 곁가지는 오른쪽만
  autoBolt(r) {
    const L = this.L, W = L.W, lim = W - 130, top = 0.49 * L.H, y0 = 0.22 * L.H, y1 = L.crest[0] + 4;
    const ok = (b) => [b.pts, ...b.branches].every((ps) => ps.every(([x, y]) => y > top || x >= lim));
    for (let k = 0; k < 6; k++) { const x0 = W - 120 + r() * 96; const b = A.makeBolt(r, x0, y0, x0 + (r() * 2 - 1) * 40, y1, 1); if (ok(b)) return b; }
    const b = A.makeBolt(r, W - 70, y0, W - 70, y1, 1); [b.pts, ...b.branches].forEach((ps) => ps.forEach((p) => { if (p[1] <= top) p[0] = Math.max(p[0], lim); })); return b;
  }
  spawnBolt(tx, ty) {
    const r = this.br, touch = tx != null;
    this.bolts.push({ ...(touch ? A.makeBolt(r, tx + (r() - 0.5) * 70, -4, tx, ty) : this.autoBolt(r)), t0: this.t });
    this.lastBolt = this.t;
    if (!this.scrubbing && !this.reduced && this.t - this.lastFlash >= 1500) { this.flash = { t0: this.t }; this.lastFlash = this.t; }
    if (this.fr.w === 'thunder' && !this.seal) { this.friendJump(6, 200); this.fr.sx.set(1.1); this.fr.sx.to(1, SPR.bounce); }
  }
  // ---------- 구름 친구 ----------
  friendJump(h, d = 360) { if (this.reduced) { this.fr.happyUntil = this.t + 1800; return; } this.fr.jumpT = this.t; this.fr.jumpH = h; this.fr.jumpD = d; this.fr.landed = false; }
  friendTap() { this.friendJump(24, 380); this.fr.happyUntil = Math.max(this.fr.happyUntil, this.t + 900); }
  updFriend(dt) {
    const F = this.fr, t = this.t;
    if (F.pend && t >= F.pend.at) { F.w = F.pend.w; F.pend = null; F.propS.set(0); F.propS.to(1, SPR.bounce); }
    F.propS.step(dt); F.sx.step(dt); F.sy.step(dt);
    if (!F.landed && t - F.jumpT >= F.jumpD) { F.landed = true; F.sy.set(0.9); F.sy.to(1, SPR.bounce); }
    if (!this.reduced && t > F.blinkAt + 120) F.blinkAt = t + 2800 + F.rr() * 3200;
  }
  pose() {
    const F = this.fr, t = this.t, w = F.w;
    const p = { tod: this.tod, w, t, blink: 0, look: 0, up: F.up, jump: 0, sx: F.sx.x, sy: F.sy.x, rot: 0, dx: 0, propS: F.propS.x, eyes: 'dot', mouth: 'smile', spiky: w === 'thunder', lantern: this.tod === 'night' && w !== 'rain' && w !== 'thunder', step: 0, wave: 0, heel: 0, cloudCol: null, glow: this.lanternGlow };
    if (!this.reduced) {
      p.sy *= 1 + 0.012 * Math.sin((TAU * t) / 2600);
      const be = t - F.blinkAt; if (be >= 0 && be < 120) p.blink = 1 - Math.abs(be / 60 - 1);
      if (w === 'none') p.look = Math.max(-1, Math.min(1, Math.sin((TAU * t) / 3000) * 1.8));
      else if (w === 'sunny') p.rot = ((4 * Math.PI) / 180) * Math.sin((TAU * t) / 2400);
      else if (w === 'cloudy') { p.dx = 8 * Math.sin((TAU * t) / 7000); p.look = 0.4 * Math.cos((TAU * t) / 7000); }
      else if (w === 'rain') { p.step = Math.sin((TAU * t) / 700); p.rot = 0.02 * p.step; }
      else if (w === 'thunder') p.dx = 0.5 * Math.sin(t / 37);
      else if (w === 'snow') p.rot = 0.07 * Math.sin((TAU * t) / 1600);
      else if (w === 'rainbow') { p.wave = ((6 * Math.PI) / 180) * Math.sin((TAU * t) / 1800); p.rot = 0.03 * Math.sin((TAU * t) / 1800 + 1); }
      const e = t - F.jumpT; if (e >= 0 && e < F.jumpD) p.jump = F.jumpH * Math.sin((Math.PI * e) / F.jumpD);
    }
    p.eyes = { none: 'dot', sunny: 'happy', cloudy: 'up', rain: 'dot', thunder: 'big', snow: 'closed', rainbow: 'happy' }[w] || 'dot';
    p.mouth = { rain: 'flat', thunder: 'o', snow: 'open' }[w] || 'smile';
    if (t < F.happyUntil) { p.eyes = 'happy'; p.mouth = 'smile'; }
    if (F.up > 0.02) { p.heel = 4 * F.up; if (F.up > 0.4) { if (p.eyes !== 'closed') p.eyes = 'dot'; p.mouth = 'open'; } }
    if (w === 'cloudy') { const col = P.cloudColors('cloudy', this.tod); p.cloudCol = [col.light, col.shade]; }
    return p;
  }
  drawFriend() {
    const L = this.L, c = this.ctx; const f = L.friend.h / 56, x = L.friend.x;
    const base = A.hillY(this.hills[2], x) + 2 + this.layerOff[2];
    const p = this.pose();
    if (this.friendOff > 0.05) { c.save(); c.beginPath(); c.rect(-20, -20, L.W + 40, base + 21); c.clip(); A.drawFriend(c, x, base + this.friendOff, f, p); c.restore(); }
    else A.drawFriend(c, x, base + this.friendOff, f, p);
    this.friendBase = base; this.friendJumpPx = p.jump * f;
  }
  friendRest() { const L = this.L; return { x: L.friend.x, base: A.hillY(this.hills[2], L.friend.x) + 2, h: L.friend.h }; }
  friendHead() {
    const L = this.L, f = L.friend.h / 56, base = this.friendRest().base;
    const extra = { sunny: 10, snow: 12, rain: 24, thunder: 8, cloudy: 18 }[this.fr.w] || 0; // 소품 높이(fix1-6)
    return { x: L.friend.x, top: base - (53 + extra) * f - this.friendJumpPx, base, f };
  }
  // ---------- 만지기 (§6.3) ----------
  pointer(type, x, y) {
    const t = this.t;
    if (type === 'down') { this.touch = { x, y, down: true, t0: t, lt: t, vx: 0, vy: 0 }; this.touchStart(x, y); }
    else if (type === 'move') { const T = this.touch; if (!T || !T.down) return; const dt = Math.max(8, t - T.lt); T.vx = ((x - T.x) / dt) * 1000; T.vy = ((y - T.y) / dt) * 1000; T.x = x; T.y = y; T.lt = t; this.touchMove(x, y); }
    else if (type === 'up') { const T = this.touch; if (!T) return; T.down = false; T.vx = T.vy = 0; this.touchEnd(); }
  }
  moveLater(x, y) { this.pending = { x, y }; }
  touchStart(x, y) {
    const w = this.w;
    if (w === 'sunny' || w === 'none') this.bloom = { x, y, t0: this.t, t1: -1, k: w === 'sunny' ? 1 : 0.5 };
    if (w === 'thunder') this.touchBolt(x, y);
    if (w === 'rainbow') this.addSpark(x, y, true);
    if (w === 'cloudy') this.pushClouds(x, y);
  }
  touchMove(x, y) {
    const w = this.w;
    if (this.bloom && this.bloom.t1 < 0 && !this.reduced) { this.bloom.x = x; this.bloom.y = y; }
    if (w === 'thunder') this.touchBolt(x, y);
    if (w === 'rainbow' && !this.reduced) this.addSpark(x, y);
    if (w === 'cloudy' && !this.reduced) this.pushClouds(x, y);
  }
  touchEnd() {
    if (this.bloom && this.bloom.t1 < 0) this.bloom.t1 = this.t;
    for (const o of this.clouds) for (const it of o.items) { if (this.reduced) { it.px.set(0); it.py.set(0); } else { it.px.to(0, SPR.soft); it.py.to(0, SPR.soft); } }
  }
  touchBolt(x, y) {
    if (this.t - this.lastTouchBolt < 300) return; this.lastTouchBolt = this.t;
    if (this.reduced) { this.staticBolt = A.makeBolt(this.br, x + 20, -4, x, y); return; }
    this.spawnBolt(x, y);
  }
  addSpark(x, y, force) { const S = this.sparks, l = S[S.length - 1]; if (!force && l && Math.hypot(l.x - x, l.y - y) < 9) return; S.push({ x, y, t0: this.t, ci: this.sparkI++ % 6 }); if (S.length > 12) S.shift(); }
  pushClouds(x, y) {
    for (const o of this.clouds) {
      if (o.state === 'exit') continue;
      for (const it of o.items) {
        const cx = this.cloudX(it) + o.dx, cy = it.y - it.spr.h * 0.35; const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy); const R = 110 + it.spr.width * 0.3;
        if (d < R) { const f = 1 - d / R, ux = d > 0.1 ? dx / d : 1, uy = d > 0.1 ? dy / d : 0; it.px.to(ux * 60 * f, SPR.soft); it.py.to(uy * 30 * f, SPR.soft); if (this.reduced) { it.px.set(it.px.target); it.py.set(it.py.target); } }
        else if (!this.reduced) { it.px.to(0); it.py.to(0); }
      }
    }
  }
  drawTouchFx() {
    const c = this.ctx, t = this.t, B = this.bloom;
    if (B) {
      const grow = this.reduced ? 1 : ease.out(seg(t, B.t0, 240)); const fade = B.t1 < 0 ? 1 : this.reduced ? 0 : 1 - seg(t, B.t1, 400);
      if (fade <= 0) this.bloom = null;
      else { const r = 120 * grow; if (r > 1) { const g = c.createRadialGradient(B.x, B.y, 0, B.x, B.y, r); g.addColorStop(0, P.rgba('#FFF1B8', 0.35 * B.k * fade)); g.addColorStop(1, P.rgba('#FFF1B8', 0)); c.fillStyle = g; c.fillRect(B.x - r, B.y - r, 2 * r, 2 * r); } }
    }
    const T = this.touch;
    if (T && T.down && this.w === 'rain') { c.strokeStyle = '#D5E7F2'; c.lineWidth = 1.4; c.globalAlpha = 0.45; c.beginPath(); c.arc(T.x, T.y, 56, -Math.PI * 0.84, -Math.PI * 0.6); c.stroke(); c.beginPath(); c.arc(T.x, T.y, 56, -Math.PI * 0.4, -Math.PI * 0.16); c.stroke(); c.globalAlpha = 1; }
    if (this.sparks.length) {
      for (const s of this.sparks) { const q = this.reduced ? 0.3 : (t - s.t0) / 720; if (q >= 1) continue; const r = 8.5 * (1 - q * 0.55); c.globalAlpha = 1 - q; c.fillStyle = P.RAINBOW[5 - s.ci]; c.beginPath(); c.moveTo(s.x, s.y - r); c.quadraticCurveTo(s.x, s.y, s.x + r, s.y); c.quadraticCurveTo(s.x, s.y, s.x, s.y + r); c.quadraticCurveTo(s.x, s.y, s.x - r, s.y); c.quadraticCurveTo(s.x, s.y, s.x, s.y - r); c.fill(); c.fillStyle = '#FFFBF2'; c.beginPath(); c.arc(s.x, s.y, 1.6 * (1 - q * 0.5), 0, TAU); c.fill(); }
      c.globalAlpha = 1; if (!this.reduced) this.sparks = this.sparks.filter((s) => t - s.t0 < 720);
    }
  }
  // ---------- 첫 실행 (§6.4) ----------
  introStart() {
    if (this.reduced || !this.L) return;
    this.intro = { t0: this.t };
    this.skyCur = [BOARD, BOARD, BOARD].map((h) => P.toOklab(h)); this.skyHex = [BOARD, BOARD, BOARD];
    this.skyAnim = { from: this.skyCur.map((a) => a.slice()), to: this.skyTo, t0: this.t, dur: 300 };
    this.offS = [0, 1, 2].map(() => new Spring(28, SPR.soft, 0.05)); this.layerOff = [28, 28, 28];
    this.friendS = new Spring(this.L.friend.h + 8, SPR.bounce, 0.05); this.friendOff = this.friendS.x; this.introA = 0;
  }
  updIntro(dt) {
    const I = this.intro; if (!I) return; const e = this.t - I.t0;
    this.introA = ease.out(seg(e, 0, 300));
    this.offS.forEach((s, i) => { if (e >= i * 80 && s.target !== 0) s.to(0, SPR.soft); s.step(dt); this.layerOff[i] = s.x; });
    if (e >= 480 && this.friendS.target !== 0) this.friendS.to(0, SPR.bounce);
    this.friendS.step(dt); this.friendOff = this.friendS.x;
    if (e > 1800) { this.intro = null; this.layerOff = [0, 0, 0]; this.friendOff = 0; this.introA = 1; }
  }
  // ---------- 저장 연출 (§6.2) ----------
  sealStart(cx, cy) {
    const r = mulberry32(hashStr(this.key + 'frag')); const frags = [];
    const live = this.clouds.filter((o) => o.state !== 'exit').flatMap((o) => o.items.map((it) => [o, it]));
    for (let i = 0; i < 36 && live.length; i++) { const [o, it] = live[Math.floor(r() * live.length)]; const x = this.cloudX(it) + o.dx + (r() - 0.5) * it.spr.width * 0.85; frags.push({ x: Math.max(-6, Math.min(this.L.W + 6, x)), y: it.y - r() * it.spr.h * 0.55, r: 1.6 + r() * 0.8 }); }
    // 빨려드는 조각 36개·r 1.6~2.4, 어두운 하늘에서는 별빛 색(fix1-13)
    this.seal = { t0: this.t, cx, cy, w: this.w, frags, col: this.tod === 'night' || this.tod === 'dusk' ? P.STAR : P.cloudColors(this.w, this.tod).light, p: 0, consumed: false, jumped: false, blinked: false };
    this.finale = null;
  }
  updSeal() {
    const S = this.seal; if (!S) return; const e = this.t - S.t0;
    this.breath = e < 1100 ? 1 - 0.015 * ease.out(seg(e, 0, 260)) : 1 - 0.015 * (1 - ease.out(seg(e, 1100, 460)));
    this.precipMul = e < 1100 ? 1 - 0.65 * ease.out(seg(e, 0, 260)) : 0.35 + 0.65 * ease.out(seg(e, 1100, 460));
    S.p = e < 520 ? ease.in(seg(e, 120, 400)) : 0;
    if (e >= 520 && !S.consumed) { S.consumed = true; this.rain.clear(); this.snow.clear(); }
    this.fr.up = e < 1100 ? ease.out(seg(e, 120, 400)) : 1 - ease.out(seg(e, 1100, 300));
    if (e >= 1060 && !S.blinked) { S.blinked = true; this.blinkFast = this.t; }
    if (e >= 1100 && !S.jumped) {
      S.jumped = true; this.friendJump(14, 320);
      const g = this.clouds.find((o) => o.state !== 'exit');
      this.finale = { w: S.w, t0: this.t, ci: g ? g.items.findIndex((it) => !it.front) : -1 };
      if (S.w === 'snow' && !this.reduced) this.snow.burst(this.L.W / 2, this.L.H * 0.46, 40);
    }
    if (e >= 1800) { this.seal = null; this.breath = 1; this.precipMul = 1; this.fr.up = 0; }
  }
  sealStarK() { const S = this.seal; if (!S) return 1; const e = this.t - S.t0; if (e < 520) return 1; if (e < 1100) return 0; return seg(e, 1100, 460); }
  updFinale() {
    const F = this.finale; if (!F) return; const e = this.t - F.t0;
    F.halo = Math.sin(Math.PI * seg(e, 0, 700)); F.part = 30 * Math.sin(Math.PI * seg(e, 0, 700)); F.glow = 0.7 * Math.sin(Math.PI * seg(e, 0, 500));
    if (e > 950) this.finale = null;
  }
  drawFinale() {
    const F = this.finale; if (!F) return; const c = this.ctx, e = this.t - F.t0, L = this.L;
    if (F.w === 'rain') { const x = L.W * 0.62, y = A.hillY(this.hills[2], x) + 26 * L.s; c.strokeStyle = '#D5E7F2'; c.lineWidth = 1.5; for (let k = 0; k < 2; k++) { const q = seg(e, k * 150, 700); if (q <= 0 || q >= 1) continue; const r = 4 + 36 * ease.out(q); c.globalAlpha = 0.6 * (1 - q); c.beginPath(); c.ellipse(x, y, r, r * 0.28, 0, 0, TAU); c.stroke(); } c.globalAlpha = 1; }
    if (F.w === 'rainbow' && this.rb) { const S = this.tod === 'night' ? this.rbNight : this.rbSprite, rm = S.R - S.bw * 3; c.fillStyle = '#FFFBF2'; for (let i = 0; i < 5; i++) { const q = seg(e, i * 55, 680); if (q <= 0 || q >= 1) continue; const ang = Math.PI + (S.a1 - Math.PI) * ease.inout(q); c.globalAlpha = 0.95 * Math.sin(Math.PI * q); c.beginPath(); c.arc(S.cx + Math.cos(ang) * rm, S.cy + Math.sin(ang) * rm, 2.8 * L.s, 0, TAU); c.fill(); } c.globalAlpha = 1; }
  }
  drawFrags() {
    const S = this.seal; if (!S || !S.p) return; const c = this.ctx; c.fillStyle = S.col;
    for (const f of S.frags) { const x = f.x + (S.cx - f.x) * S.p, y = f.y + (S.cy - f.y) * S.p; c.globalAlpha = 1 - S.p * 0.5; c.beginPath(); c.arc(x, y, f.r * (1 - S.p * 0.7), 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }
  // ---------- 품질 조절 (§5.1-7) ----------
  qual(dt) {
    if (this.reduced || this.q >= 2) return;
    const W0 = this.qWin; W0.t += dt; W0.n++;
    if (W0.t >= 2000) {
      const fps = (W0.n * 1000) / W0.t; this.lastFps = fps;
      if (fps < 50) { this.q++; this.qLog.push({ t: Math.round(this.t), fps: Math.round(fps * 10) / 10, q: this.q }); if (this.q === 1) { this.rain.setLow(true); this.snow.setLow(true); } else this.resize(this.L); }
      W0.t = 0; W0.n = 0;
    }
  }
  // ---------- 프레임 ----------
  frame(dt, t) {
    this.t = t; if (!this.L || !this.visible) return;
    this.qual(dt);
    if (this.pending) { const p = this.pending; this.pending = null; this.pointer('move', p.x, p.y); }
    this.updSky(dt); this.updGround(dt); this.updClouds(dt); this.updCel(dt); this.updStars(dt); this.updRainbow();
    this.updIntro(dt); this.updSeal(); this.updFinale(); this.updFriend(dt); this.updBolts();
    const env = { W: this.L.W, H: this.L.H, hill3: (x) => A.hillY(this.hills[2], x) + this.layerOff[2], crest1: this.L.crest[0], crest2: this.L.crest[1], mul: this.precipMul, still: this.reduced, touch: this.touch && this.touch.down ? this.touch : null };
    this.rain.update(dt, t, env); this.snow.update(dt, t, env);
    this.render();
  }
  render() {
    const c = this.ctx, L = this.L, W = L.W, H = L.H, t = this.t, d = this.dpr;
    c.setTransform(d, 0, 0, d, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const [top, mid, bot] = this.skyHex;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(0.5, mid); g.addColorStop(0.66, bot); g.addColorStop(1, bot);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (this.breath !== 1) { const cx = W / 2, cy = H * 0.36; c.translate(cx, cy); c.scale(this.breath, this.breath); c.translate(-cx, -cy); }
    const S = this.seal; const suck = S && S.p ? { x: S.cx, y: S.cy, p: S.p } : null; const sk = this.sealStarK();
    if (this.milkyA > 0.01) { c.globalAlpha = this.milkyA * this.introA * sk; c.drawImage(this.milky, 0, 0, W, H * 0.72); c.globalAlpha = 1; }
    if (this.starA > 0.01) A.drawStars(c, this.stars, t, this.starA * this.introA * (suck ? 1 : sk), H, this.tod === 'night', suck, this.reduced);
    this.drawCel();
    this.drawClouds(false);
    this.drawRainbow();
    this.drawGround(0); this.drawTrees();
    this.rain.drawLayer(c, false, suck); this.snow.drawLayer(c, false, t, false, suck);
    this.drawGround(1); this.drawScreenLight();
    this.drawClouds(true);
    this.rain.drawLayer(c, true, suck); this.snow.drawLayer(c, true, t, this.tod === 'day' || this.tod === 'dawn', suck);
    this.drawGround(2);
    this.drawFriend();
    this.rain.drawSplash(c);
    this.drawFinale(); this.drawFrags(); this.drawTouchFx();
    if (this.staticBolt) A.drawBolt(c, this.staticBolt, 0.9);
    for (const b of this.bolts) A.drawBolt(c, b, boltAlpha(t - b.t0));
    c.setTransform(d, 0, 0, d, 0, 0);
    if (this.flash) { const e = t - this.flash.t0; const a = 0.35 * Math.sin(Math.PI * Math.min(1, e / 180)); if (a > 0) { c.fillStyle = P.rgba('#FFF6D6', a); c.fillRect(0, 0, W, H); } }
  }
}
