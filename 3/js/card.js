// 주간 카드 1080×1350 그리기 (design-spec §8, §5). 하늘·세계는 오늘 화면과 같은 그림 코드(sky/art.js·orb.js·paper.js)를 쓴다.
// 그림은 '휴대폰 단위'로 그려 2.4배 키운다(§8 '§5.4 값 ×2.4'). 글자·도장·등압선은 카드 px로 바로 그린다.
// 메모는 절대 넣지 않는다. 글꼴을 모두 불러온 뒤(loadCardFonts) 그린다.
import * as P from './palette.js';
import * as A from './sky/art.js';
import { drawOrb } from './sky/orb.js';
import { grainTile } from './sky/paper.js';
import { rng, mulberry32 } from './dates.js';

export const CW = 1080, CH = 1350;
export const STAMP = { x: 944, y: 138, size: 188 };
const U = 2.4, PW = CW / U, PH = CH / U;
const TAU = Math.PI * 2;
const CREST = [752, 800, 852];
const X0 = 72, X1 = 1008, COL = 134, ORB = 96, ORB_Y = 876, WD_Y = 980;
// 발표 도장 색(fix2b): 밝은 하늘(글자 잉크가 어두운 카드)은 짙은 인주색, 어두운 하늘(밤·노을, 잉크가 밝은 카드)은 밝은 산호색. 실제 픽셀 대비 측정은 build-notes §15
// fix3: 6종 모두 실제 픽셀 대비 4.5 이상(다른 주 그림에서도)이 되게 #7E1F14→#5A150D, #F49C8A→#F6A493. 측정은 build-notes §16
const RED_ON_LIGHT = '#5A150D', RED_ON_DARK = '#F6A493';
// 카드 글자 크기 단계(fix2b: 카드 안 최소 글자 42px. 360폭 미리보기에서 약 14px)
export const FIT = { sent: [46, 44, 42], next: [44, 43, 42], min: 42 };
const GOWUN = "'GowunBatangSub', 'Gowun Batang', serif";
const PRET = "'PretendardSub', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
const F = (w, px, fam) => `${w} ${px}px ${fam}`;
const SIN12 = Math.sin((12 * Math.PI) / 180), COS12 = Math.cos((12 * Math.PI) / 180);

let fontsP = null;
export function loadCardFonts() {
  if (!fontsP) fontsP = Promise.all([
    document.fonts.load("700 66px 'GowunBatangSub'", '나의 기분 일기예보 0123456789°−'),
    document.fonts.load("600 46px 'PretendardSub'", '이번 주 마음은'),
    document.fonts.load("400 36px 'PretendardSub'", '제1호'),
  ]).then(() => true, () => false);
  return fontsP;
}
const inkOf = (an) => ({ sky: P.skyInk(an.rep, an.tod) === 'dark' ? P.INK_DARK : P.INK_LIGHT, gnd: P.groundInk(an.rep, an.tod) === 'dark' ? P.INK_DARK : P.INK_LIGHT });

// ---------- 글자 배치 ----------
function wrapWords(c, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (!cur || c.measureText(t).width <= maxW) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  return lines;
}
// 어절 단위 줄바꿈(keep-all). maxLines 안에 들 때까지 글자를 줄이고, 줄 길이를 고르게 맞춘다.
export function fitLines(c, text, maxW, sizes, maxLines, weight, fam) {
  for (const fs of sizes) {
    c.font = F(weight, fs, fam); let lines = wrapWords(c, text, maxW);
    if (lines.length > maxLines || lines.some((l) => c.measureText(l).width > maxW + 0.5)) continue;
    const n = lines.length;
    if (n > 1) {
      let lo = maxW * 0.5, hi = maxW;
      for (let it = 0; it < 12; it++) { const mid = (lo + hi) / 2; const t = wrapWords(c, text, mid); if (t.length <= n && t.every((l) => c.measureText(l).width <= mid + 0.5)) hi = mid; else lo = mid; }
      lines = wrapWords(c, text, hi);
    }
    return { fs, lines, ok: true };
  }
  const fs = sizes[sizes.length - 1]; c.font = F(weight, fs, fam);
  return { fs, lines: wrapWords(c, text, maxW).slice(0, maxLines), ok: false };
}
function plan(c, an, C) {
  const { sky, gnd } = inkOf(an); const ops = [];
  const put = (font, text, x, top, lh, color, align, size) => {
    c.font = font; const m = c.measureText(text);
    const fa = m.fontBoundingBoxAscent || size * 0.92, fd = m.fontBoundingBoxDescent || size * 0.24;
    const y = top + (lh - (fa + fd)) / 2 + fa;
    const x0 = align === 'right' ? x - m.width : align === 'center' ? x - m.width / 2 : x;
    const aa = m.actualBoundingBoxAscent || size * 0.8, ad = m.actualBoundingBoxDescent || size * 0.12;
    ops.push({ font, text, x, y, align, color, box: { x: x0, y: y - aa, w: m.width, h: aa + ad, ink: color, text, fs: size } });
  };
  put(F(700, 66, GOWUN), C.app.card_title, X0, 72, 80, sky, 'left', 66);
  put(F(600, 42, PRET), an.period, X0, 160, 50, sky, 'left', 42);
  put(F(700, 190, GOWUN), C.weather[an.rep].name, 64, 222, 200, sky, 'left', 190);
  // 평균 마음 온도: 오른쪽 끝 1008(천둥은 번개 자리를 비워 872). °는 46% 크기, 윗선 맞춤
  const right = an.rep === 'thunder' ? 872 : X1;
  const num = (an.avgT < 0 ? '−' : '') + Math.abs(an.avgT);
  c.font = F(700, 48, GOWUN); const dw = c.measureText('°').width;
  put(F(700, 48, GOWUN), '°', right, 278, 48, sky, 'right', 48);
  put(F(700, 104, GOWUN), num, right - dw - 2, 268, 104, sky, 'right', 104);
  // 캐스터 문장 3줄(천둥·무지개는 폭 800: 번개·호 자리를 비운다)
  const s = fitLines(c, an.sentence, an.rep === 'thunder' || an.rep === 'rainbow' ? 800 : X1 - X0, FIT.sent, 3, 600, PRET);
  const lh = Math.round((s.fs * 66) / 46);
  s.lines.forEach((ln, i) => put(F(600, s.fs, PRET), ln, X0, 444 + i * lh, lh, sky, 'left', s.fs));
  C.misc.weekdays_mon_first.forEach((d, i) => put(F(600, 42, PRET), d, X0 + COL * i + COL / 2, WD_Y - 2, 50, gnd, 'center', 42));
  put(F(700, 44, GOWUN), an.stat, X0, 1040, 56, gnd, 'left', 44);
  // 다음 주 전망: 한 줄이 기본, 42px로도 넘치면 두 줄(앱 이름 줄 1228 위에서 끝난다)
  let nx = fitLines(c, an.next, X1 - X0, FIT.next, 1, 600, PRET); if (!nx.ok) nx = fitLines(c, an.next, X1 - X0, [FIT.min], 2, 600, PRET);
  nx.lines.forEach((ln, i) => put(F(600, nx.fs, PRET), ln, X0, 1108 + i * 52, 52, gnd, 'left', nx.fs));
  put(F(700, 42, GOWUN), C.app.name, X0, 1228, 50, gnd, 'left', 42);
  put(F(400, 42, PRET), an.issueText, X1, 1228, 50, gnd, 'right', 42);
  return ops;
}
const hits = (boxes, x, y, w, h) => boxes.some((b) => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);

// ---------- 등압선: 그 주 7일 마음 온도를 정규화해 Catmull-Rom으로 잇는다(빈 날은 앞뒤 평균) ----------
function isoNorm(an) {
  const t = an.cells.map((c) => c.t);
  const f = t.map((v, i) => {
    if (v != null) return v;
    let a = null, b = null;
    for (let j = i - 1; j >= 0; j--) if (t[j] != null) { a = t[j]; break; }
    for (let j = i + 1; j < 7; j++) if (t[j] != null) { b = t[j]; break; }
    return a != null && b != null ? (a + b) / 2 : a != null ? a : b != null ? b : 0;
  });
  const lo = Math.min(...f), hi = Math.max(...f);
  return f.map((v) => (hi > lo ? (v - lo) / (hi - lo) : 0.5));
}
function catmull(c, p) {
  c.moveTo(p[0][0], p[0][1]);
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}
export function drawIsobars(c, an) {
  const n = isoNorm(an); const ink = inkOf(an).sky;
  c.save(); c.lineWidth = 3; c.strokeStyle = P.rgba(ink, 0.22); c.lineCap = 'round'; c.lineJoin = 'round';
  if (an.status !== 'published') c.setLineDash([8, 8]);
  for (let q = 0; q < 4; q++) {
    const base = 664 + 30 * q, amp = 30 + 8 * q; // 하늘 쪽 띠(언덕에 아래가 가려짐, fix1)
    const y = (v) => Math.max(648, Math.min(800, base - (v - 0.5) * amp));
    const pts = [[X0, y(n[0])], ...n.map((v, i) => [X0 + COL * i + COL / 2, y(v)]), [X1, y(n[6])]];
    c.beginPath(); catmull(c, pts); c.stroke();
  }
  c.restore();
}

// ---------- 세계(하늘·해달·구름·무지개·언덕·친구·강수·번개) ----------
const EYES = { sunny: 'happy', cloudy: 'up', rain: 'dot', thunder: 'big', snow: 'closed', rainbow: 'happy' };
const MOUTH = { rain: 'flat', thunder: 'o', snow: 'open' };
function crystal(c, x, y, r, rot) {
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = rot + (k * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a);
    c.moveTo(x - ca * r, y - sa * r); c.lineTo(x + ca * r, y + sa * r);
    for (const s of [-1, 1]) {
      const bx = x + s * ca * r * 0.55, by = y + s * sa * r * 0.55;
      for (const t of [-1, 1]) { const b = a + t * 0.8; c.moveTo(bx, by); c.lineTo(bx + s * Math.cos(b) * r * 0.32, by + s * Math.sin(b) * r * 0.32); }
    }
  }
  c.stroke();
}
function world(c, an, k, avoid, withIso) {
  const w = an.rep, tod = an.tod, dpr = U * k, R = rng(an.key, 'card', w);
  const [top, mid, bot] = P.skyStops(w, tod), G = P.ground(w, tod);
  const g = c.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, top); g.addColorStop(0.5, mid); g.addColorStop(0.66, bot); g.addColorStop(1, bot);
  c.fillStyle = g; c.fillRect(0, 0, CW, CH);
  const L = { s: 1, crest: CREST.map((y) => y / U), W: PW, H: PH };
  const hr = rng(an.key, 'card-hills'); const hills = [0, 1, 2].map((i) => A.hillSpec(i, L, hr));
  const hy = (i, x) => A.hillY(hills[i], x / U) * U; // 카드 px
  const night = tod === 'night', snow = w === 'snow' ? P.snowCap(tod) : null;
  const cols = [P.mix(G, bot, 0.55), P.mix(G, bot, 0.25), G];
  const col = P.cloudColors(w, tod); col.rimMode = tod === 'dusk' ? 'bottom' : night ? 'tl' : null;
  const pu = (fn) => { c.save(); c.scale(U, U); fn(); c.restore(); };
  const j = (v) => (R() * 2 - 1) * v;
  // 구름: 후보 자리 중 글자·도장 상자와 겹치지 않는 첫 자리(free면 첫 자리 그대로). lit은 번개 쪽 밝은 판을 얹는 세기
  const cloud = (preset, sc, cands, o = {}) => pu(() => {
    const seed = Math.floor(R() * 1e9); const spr = A.cloudSprite(preset, sc, col, dpr, mulberry32(seed));
    let at = cands[0];
    if (!o.free) for (const [x, y] of cands) { if (!hits(avoid, x - spr.ox * U + 8, y - spr.oy * U + 8, spr.w * U - 16, spr.h * U - 16)) { at = [x, y]; break; } }
    const X = at[0] / U - spr.ox, Y = at[1] / U - spr.oy; c.drawImage(spr.cv, X, Y, spr.w, spr.h);
    if (o.lit) { const l2 = A.cloudSprite(preset, sc, col, dpr, mulberry32(seed), true); c.globalAlpha = o.lit; c.drawImage(l2.cv, X, Y, l2.w, l2.h); c.globalAlpha = 1; }
  });
  const sun = (st, x, y, r, a) => pu(() => { const spr = A.sunSprite(st, r / U, 1, dpr); const X = x / U, Y = y / U; c.globalAlpha = a; c.drawImage(spr.halo.cv, X - spr.halo.R, Y - spr.halo.R, spr.halo.R * 2, spr.halo.R * 2); c.drawImage(spr.disc.cv, X - spr.disc.R, Y - spr.disc.R, spr.disc.R * 2, spr.disc.R * 2); c.globalAlpha = 1; });
  const friendsOn = { 0: [], 1: [], 2: [] };
  const friend = (hill, x, f, o = {}) => friendsOn[hill].push({ x, f, o });
  const drawFriends = (hill) => pu(() => {
    for (const { x: xc, f, o } of friendsOn[hill]) {
      const x = xc / U, base = A.hillY(hills[hill], x) + 2; const lantern = night && w !== 'rain' && w !== 'thunder'; const cc = P.cloudColors('cloudy', tod);
      A.drawFriend(c, x, base, f, { tod, w, t: o.t || 0, blink: 0, look: o.look || 0, up: 0, jump: o.jump || 0, sx: o.sx || 1, sy: 1, rot: o.rot || 0, dx: 0, propS: 1, eyes: EYES[w], mouth: MOUTH[w] || 'smile', spiky: w === 'thunder', lantern, step: 0, wave: o.wave || 0, heel: 0, cloudCol: w === 'cloudy' ? [cc.light, cc.shade] : null, glow: lantern ? A.haloSprite('#FFC66B', 0.3, 2, 28 * f, dpr) : null });
    }
  });
  const layer = (i, extra) => pu(() => {
    const h = hills[i]; const y0 = i === 0 ? L.crest[0] - 72 : i === 1 ? L.crest[1] - 86 : L.crest[2] - 30; const y1 = i < 2 ? L.crest[i + 1] + 40 : PH + 4;
    const Lr = A.hillLayer({ h, color: cols[i], W: PW, y0, y1, dpr, rand: rng(an.key, 'card-hill', i), snow, grass: i === 1 ? 46 : i === 2 ? 36 : 0, extra });
    c.drawImage(Lr.cv, 0, Lr.y0, PW, Lr.h);
  });
  // 강수: 글자 상자와 언덕 아래는 비운다
  const rain = (n, len, wid, color, alpha, ground) => {
    c.save(); c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = wid; c.lineCap = 'round'; c.beginPath();
    for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
      const x = R() * (CW + 60) - 10, y = 30 + R() * 840, x2 = x + SIN12 * len, y2 = y - COS12 * len;
      if (y > ground(x) - 6 || hits(avoid, Math.min(x, x2) - 6, y2 - 6, Math.abs(x2 - x) + 12, y - y2 + 12)) continue;
      c.moveTo(x, y); c.lineTo(x2, y2); i++;
    }
    c.stroke(); c.restore();
  };
  const snowDots = (n, r0, r1, color, alpha, ground, big) => {
    c.save(); c.globalAlpha = alpha; c.fillStyle = color; c.strokeStyle = color; c.lineCap = 'round';
    for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
      const x = R() * CW, y = 20 + R() * 820, r = r0 + R() * (r1 - r0);
      if (y + r > ground(x) - 4 || hits(avoid, x - r - 6, y - r - 6, 2 * r + 12, 2 * r + 12)) continue;
      if (big) { c.lineWidth = Math.max(1.6, r * 0.16); crystal(c, x, y, r, R() * TAU); } else { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
      i++;
    }
    c.restore();
  };

  // 1) 별·미리내(눈 밤)
  if (night && w === 'snow') pu(() => { const mk = A.makeMilky(rng(an.key, 'card-milky'), PW, PH, dpr); c.globalAlpha = 0.85; c.drawImage(mk, 0, 0, PW, PH * 0.72); c.globalAlpha = 1; A.drawStars(c, A.makeStars(rng(an.key, 'card-stars'), PW, PH), 0, 1, PH, true, null, true); });
  // 2) 해·달·먼 구름·무지개 (대표 날씨별 구도 §8)
  if (withIso && w === 'snow') drawIsobars(c, an); // 눈 카드는 보름달보다도 먼저
  let rainbowFoot = 0;
  if (w === 'sunny') {
    sun('day', 1020, 60, 200, 1);
    cloud('C3', 0.95, [[640 + j(30), 330 + j(14)], [700, 420], [560, 150]]); cloud('C3', 0.8, [[200 + j(30), 690 + j(10)], [380, 640]]);
    friend(2, 300, 1, { rot: 0.05 });
  } else if (w === 'cloudy') {
    sun('dawn', 840, 650, 70, 0.95);
    cloud('C2', 0.9, [[650 + j(30), 300 + j(10)], [700, 220], [620, 175]]);
    [[-40, 690], [480, 676], [1040, 700]].forEach(([x, y]) => cloud('C1', 0.75, [[x + j(24), y + j(10)]], { free: true }));
    friend(2, 300, 1);
  } else if (w === 'rain') {
    cloud('C1', 1.45, [[520 + j(30), 96 + j(12)]], { free: true }); cloud('C2', 1.2, [[1010 + j(20), 300 + j(12)]], { free: true }); cloud('C2', 1.1, [[60 + j(20), 330 + j(12)]], { free: true });
    friend(0, 740, 0.62, { t: 220 }); friend(1, 560, 0.8, { t: 430 }); friend(2, 250, 1);
  } else if (w === 'thunder') {
    cloud('C1', 1.45, [[470 + j(30), 100 + j(12)]], { free: true }); cloud('C2', 1.2, [[60 + j(20), 320 + j(12)]], { free: true });
    friend(2, 300, 1, { jump: 6, sx: 1.08 });
  } else if (w === 'snow') {
    const X = 800 / U, Y = 780 / U, rr = 130 / U;
    pu(() => { const halo = A.haloSprite(P.MOON.halo, 0.22, rr * 0.9, rr * 2.2, dpr); c.drawImage(halo.cv, X - halo.R, Y - halo.R, halo.R * 2, halo.R * 2); A.drawMoon(c, X, Y, rr, 0.5, mid, 1); });
    cloud('C2', 1.0, [[460 + j(30), 300 + j(12)], [520, 240], [600, 380]]); cloud('C2', 0.85, [[760 + j(20), 420 + j(10)], [700, 400]]);
    friend(2, 300, 1);
  } else if (w === 'rainbow') {
    // fix2b: 바깥 반지름 1180→1090(도장 중심 (944,138)이 호 바깥, 고리와 약 19 떨어짐). 글자 구역(y≤661)을 지나는 부분은 불투명도 .35(아래는 .7), 621~701에서 부드럽게 잇는다
    const cx = 1150, cy = 1300, Ro = 1090, bw = 30;
    const [rc, rx] = A.mkCanvas(CW, CH, k); rx.lineCap = 'butt';
    for (let i = 5; i >= 0; i--) { const rm = Ro - bw * (5 - i) - bw / 2; rx.strokeStyle = P.RAINBOW[i]; rx.lineWidth = bw + 0.8; rx.beginPath(); rx.arc(cx, cy, rm, Math.PI, TAU); rx.stroke(); }
    const gm = rx.createLinearGradient(0, 621, 0, 701); gm.addColorStop(0, 'rgba(0,0,0,.5)'); gm.addColorStop(1, 'rgba(0,0,0,1)');
    rx.globalCompositeOperation = 'destination-in'; rx.fillStyle = gm; rx.fillRect(0, 0, CW, CH); rx.globalCompositeOperation = 'source-over';
    c.globalAlpha = 0.7; c.drawImage(rc, 0, 0, CW, CH); c.globalAlpha = 1; rc.width = rc.height = 0;
    rainbowFoot = cx - Math.sqrt((Ro - 90) ** 2 - (cy - CREST[0]) ** 2);
    cloud('C3', 0.9, [[700 + j(20), 640 + j(10)], [760, 680], [650, 420], [430, 660]]); cloud('C3', 0.75, [[980 + j(20), 600 + j(10)], [990, 660]]);
    friend(0, rainbowFoot + 150, 0.62, { wave: -0.3 }); friend(1, 560, 0.8, { wave: 0.1 }); friend(2, 260, 1, { wave: 0.2 });
  }
  // 등압선은 언덕보다 먼저 그려 언덕·집·나무에 가려지게(전깃줄처럼 읽히지 않게, fix1). 데이터 곡선은 그대로
  if (withIso && w !== 'snow') drawIsobars(c, an);
  // 3) 맨 뒤 언덕 H1 + 집(밤·새벽·노을 불빛) + 나무
  layer(0, (x) => {
    const h = hills[0], hx = 0.58 * PW; A.drawHouse(x, hx, A.hillY(h, hx) + 3, 1, cols[0], tod !== 'day', snow);
    if (w === 'rain') { const h2 = 0.4 * PW; A.drawHouse(x, h2, A.hillY(h, h2) + 3, 0.8, cols[0], true, snow); }
  });
  pu(() => {
    [['round', 0.12], ['pointy', 0.92]].forEach(([kind, fx], i) => { const tr = A.treeSprite(kind, G, snow, dpr, 1, rng(an.key, 'card-tree', i)); const x = fx * PW, y = A.hillY(hills[0], x) + 2; c.drawImage(tr.cv, x - tr.ox, y - tr.oy, tr.w, tr.h); });
  });
  drawFriends(0);
  if (w === 'cloudy') [[230, 720], [760, 735]].forEach(([x, y]) => cloud('C1', 0.75, [[x + j(24), y + j(8)]], { free: true }));
  if (w === 'thunder') {
    let b = null;
    for (let t = 0; t < 40 && !b; t++) { const cand = A.makeBolt(rng(an.key, 'bolt', t), 1000 / 3, 200 / 3, 930 / 3, 790 / 3); const xs = [...cand.pts, ...cand.branches.flat()].map((p) => p[0] * 3); if (Math.min(...xs) >= 892 && Math.max(...xs) <= 1066) b = cand; }
    if (!b) b = { pts: [[1000 / 3, 200 / 3], [965 / 3, 500 / 3], [930 / 3, 790 / 3]], branches: [] };
    cloud('C2', 1.1, [[968, 262]], { free: true, lit: 0.35 });
    c.save(); c.scale(3, 3); A.drawBolt(c, b, 1); c.restore();
  }
  // 4) 먼 강수
  if (w === 'rain') rain(60, 40, 2, '#A9C7DC', 0.32, (x) => hy(0, x));
  if (w === 'snow') snowDots(50, 3, 5.5, '#EAF2F8', 0.55, (x) => hy(1, x), false);
  // 5) 가운데 언덕 H2 + 백엽상(문틈 불빛)
  layer(1, (x) => A.drawScreen(x, 0.78 * PW, A.hillY(hills[1], 0.78 * PW) + 4, 1, night, snow));
  pu(() => { const x = 0.78 * PW, y = A.hillY(hills[1], x) + 4 - 31; c.fillStyle = '#E8695A'; c.beginPath(); c.arc(x, y, 1.25, 0, TAU); c.fill(); if (tod === 'night' || tod === 'dusk') { c.globalAlpha = 0.22; c.beginPath(); c.arc(x, y, 3.6, 0, TAU); c.fill(); c.globalAlpha = 1; } });
  drawFriends(1);
  if (w === 'rain' || w === 'thunder') cloud('C1', w === 'rain' ? 1.3 : 1.2, [[w === 'rain' ? 190 + j(30) : 620 + j(30), w === 'rain' ? 236 + j(10) : 210 + j(10)]], { free: true });
  // 6) 등압선, 앞 언덕 H3, 구름 친구
  layer(2);
  drawFriends(2);
  // 7) 앞 강수
  if (w === 'rain') rain(80, 60, 3, '#D5E7F2', 0.55, (x) => hy(2, x));
  if (w === 'snow') snowDots(30, 10, 18, '#FFFFFF', 0.9, (x) => hy(2, x), true);
  return { rainbowFoot };
}
function grain(c) {
  const p = c.createPattern(grainTile(), 'repeat');
  try { p.setTransform(new DOMMatrix([2, 0, 0, 2, 0, 0])); } catch (e) { /* 지원 안 함: 1배 결 */ }
  c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.16; c.fillStyle = p; c.fillRect(0, 0, CW, CH); c.restore();
}
function hole(c, cx, cy, d, a) {
  c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.arc(cx, cy, d / 2, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.24)'; c.lineWidth = 2.4; c.beginPath(); c.arc(cx, cy, d / 2 - 1.2, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
  c.strokeStyle = 'rgba(255,251,242,.10)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, d / 2 - 1, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); c.restore();
}
function orbs(c, an) {
  an.cells.forEach((cell, i) => {
    const cx = X0 + COL * i + COL / 2, cy = ORB_Y + ORB / 2;
    if (cell.w) { c.save(); c.translate(cx, cy); drawOrb(c, cell.w, ORB, { shadow: true }); c.restore(); }
    else hole(c, cx, cy, cell.future ? 68 : ORB, cell.future ? 0.6 : 1);
  });
}
// 도장: 발표(붉은 고리 + 잉크 빠짐, −8°) / 작성 중(점선 고리 + '관측 중'). 투명 바탕 정사각 캔버스
export function stampCanvas(an, C, k) {
  const S = STAMP.size; const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(S * k);
  const c = cv.getContext('2d'); c.scale(k, k); c.translate(S / 2, S / 2); c.rotate((-8 * Math.PI) / 180);
  const r = 68; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (an.status !== 'published') {
    const col = inkOf(an).sky; c.strokeStyle = col; c.fillStyle = col; c.globalAlpha = 0.9;
    c.lineWidth = 5; c.setLineDash([12, 10]); c.beginPath(); c.arc(0, 0, r - 3, 0, TAU); c.stroke(); c.setLineDash([]);
    let fs = 40; c.font = F(700, fs, GOWUN);
    while (fs > 28 && c.measureText(C.forecast.in_progress).width > 2 * r - 34) { fs -= 2; c.font = F(700, fs, GOWUN); }
    c.fillText(C.forecast.in_progress, 0, 3);
  } else {
    const red = inkOf(an).sky === P.INK_LIGHT ? RED_ON_DARK : RED_ON_LIGHT; c.strokeStyle = red; c.fillStyle = red;
    c.lineWidth = 6; c.beginPath(); c.arc(0, 0, r - 3, 0, TAU); c.stroke();
    c.font = F(700, 44, GOWUN); c.fillText(C.forecast.stamp, 0, 4);
    const q = rng(an.key, 'stamp'); c.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) { const a = q() * TAU, d = Math.sqrt(q()) * (r + 2); c.globalAlpha = 0.15 + q() * 0.3; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, 0.8 + q() * 2.2, 0, TAU); c.fill(); }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  return cv;
}
// 카드 한 장. o.scale = 기기 px / 카드 px(저장은 1, 화면 표시는 카드 폭×DPR/1080). o.iso·o.stamp·o.text를 끄면 그 층을 뺀다.
export function renderCard(an, C, o = {}) {
  const k = o.scale || 1; const cv = document.createElement('canvas'); cv.width = Math.round(CW * k); cv.height = Math.round(CH * k);
  const c = cv.getContext('2d'); c.scale(k, k);
  const ops = plan(c, an, C);
  const avoid = ops.map((op) => ({ x: op.box.x - 10, y: op.box.y - 10, w: op.box.w + 20, h: op.box.h + 20 }));
  avoid.push({ x: STAMP.x - 74, y: STAMP.y - 74, w: 148, h: 148 });
  world(c, an, k, avoid, o.iso !== false);
  grain(c);
  orbs(c, an);
  if (o.text !== false) { c.textBaseline = 'alphabetic'; for (const op of ops) { c.font = op.font; c.fillStyle = op.color; c.textAlign = op.align; c.fillText(op.text, op.x, op.y); } }
  if (o.stamp !== false) { const S = STAMP.size; const st = stampCanvas(an, C, k); c.drawImage(st, STAMP.x - S / 2, STAMP.y - S / 2, S, S); st.width = st.height = 0; }
  return { cv, boxes: ops.map((op) => op.box) };
}
export function cardBlob(an, C) {
  return loadCardFonts().then(() => new Promise((res, rej) => {
    const { cv } = renderCard(an, C, { scale: 1 });
    cv.toBlob((b) => { cv.width = cv.height = 0; if (b) res(b); else rej(new Error('blob')); }, 'image/png');
  }));
}
