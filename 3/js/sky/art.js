// 그림: 구름·언덕·나무·집·백엽상·해·달·별·미리내·무지개·번개·구름 친구 (design-spec §5)
// 규칙: 빛은 왼쪽 위, 2단 음영(칼로 자른 경계), 외곽선·shadowBlur 없음, 손맛 흔들림 ±1.2(시드 고정)
import { mix, rgba, SUN, MOON, FRIEND, RAINBOW, STAR, MILKY, WINDOW } from '../palette.js';
const TAU = Math.PI * 2;

export function mkCanvas(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr)); c.height = Math.max(1, Math.ceil(h * dpr));
  const x = c.getContext('2d'); x.scale(dpr, dpr); return [c, x];
}
function smoothClosed(c, pts, dx = 0, dy = 0) {
  const n = pts.length; const a0 = pts[n - 1], b0 = pts[0];
  c.moveTo((a0[0] + b0[0]) / 2 + dx, (a0[1] + b0[1]) / 2 + dy);
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; c.quadraticCurveTo(a[0] + dx, a[1] + dy, (a[0] + b[0]) / 2 + dx, (a[1] + b[1]) / 2 + dy); }
  c.closePath();
}
function circlePts(cx, cy, r, rand, amp = 1.2) {
  const n = Math.max(12, Math.round(r * 0.8)); const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const rr = r + (rand() * 2 - 1) * amp; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return pts;
}
function rrectPts(x0, y0, x1, y1, r, rand, amp = 1.2) {
  const pts = []; const add = (x, y) => pts.push([x + (rand() * 2 - 1) * amp, y + (rand() * 2 - 1) * amp]);
  const arc = (cx, cy, a0) => { for (let k = 0; k < 4; k++) { const a = a0 + (k / 4) * (Math.PI / 2); add(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } };
  for (let x = x0 + r; x < x1 - r; x += 7) add(x, y0);
  arc(x1 - r, y0 + r, -Math.PI / 2);
  for (let y = y0 + r; y < y1 - r; y += 7) add(x1, y);
  arc(x1 - r, y1 - r, 0);
  for (let x = x1 - r; x > x0 + r; x -= 7) add(x, y1);
  arc(x0 + r, y1 - r, Math.PI / 2);
  for (let y = y1 - r; y > y0 + r; y -= 7) add(x0, y);
  arc(x0 + r, y0 + r, Math.PI);
  return pts;
}

// ---------- 구름 ----------
export const PRESETS = {
  C1: { w: 180, c: [[-62, -24, 24], [-28, -40, 34], [14, -44, 40], [52, -28, 26], [74, -16, 16]], r: [-80, -16, 84, 0, 16] },
  C2: { w: 120, c: [[-38, -18, 18], [-6, -30, 26], [30, -20, 20]], r: [-52, -12, 50, 0, 12] },
  C3: { w: 70, c: [[-16, -12, 12], [6, -18, 15], [22, -10, 10]], r: [-30, -8, 32, 0, 8] },
};
// col: {light, shade, rim, rimMode}. lit=true면 번개 뒤 밝은 판.
export function cloudSprite(preset, sc, col, dpr, rand, lit = false) {
  const P = PRESETS[preset];
  const polys = P.c.map(([x, y, r]) => circlePts(x * sc, y * sc, r * sc, rand));
  const [x0, y0, x1, y1, rr] = P.r; polys.push(rrectPts(x0 * sc, y0 * sc, x1 * sc, y1 * sc, rr * sc, rand));
  let minX = x0 * sc, maxX = x1 * sc, minY = 0;
  for (const [x, y, r] of P.c) { minX = Math.min(minX, (x - r) * sc); maxX = Math.max(maxX, (x + r) * sc); minY = Math.min(minY, (y - r) * sc); }
  const m = 6, W = maxX - minX + 2 * m, H = -minY + 2 * m;
  const [cv, c] = mkCanvas(W, H, dpr); const ox = -minX + m, oy = -minY + m; c.translate(ox, oy);
  const path = (dx, dy) => { c.beginPath(); for (const p of polys) smoothClosed(c, p, dx, dy); };
  const k = Math.min(P.w * sc, 190) / 120;
  let light = col.light, shade = col.shade, rim = col.rim;
  if (lit) { light = mix(light, '#FFF6D6', 0.25); shade = mix(shade, '#FFF6D6', 0.14); }
  c.save(); path(0, 0); c.fillStyle = shade; c.fill(); c.clip(); path(-7 * k, -9 * k); c.fillStyle = light; c.fill(); c.restore();
  // 테두리 빛(fix1-4): 두께 1.5, α.55. 노을은 아랫변 가운데 70%만, 밤은 왼쪽 위 120° 호만(구름 전체를 감싸 외곽선처럼 보이지 않게)
  if (rim && col.rimMode) {
    const [rc, rx] = mkCanvas(W, H, dpr); rx.translate(ox, oy);
    const tr = (dx, dy) => { rx.beginPath(); for (const p of polys) smoothClosed(rx, p, dx, dy); };
    tr(0, 0); rx.fillStyle = rim; rx.fill();
    rx.globalCompositeOperation = 'destination-out'; if (col.rimMode === 'bottom') tr(0, -1.5); else tr(1.06, 1.06); rx.fill();
    rx.globalCompositeOperation = 'destination-in'; rx.beginPath();
    if (col.rimMode === 'bottom') { const sp = maxX - minX; rx.rect(minX + 0.15 * sp, minY - 8, 0.7 * sp, 16 - minY); }
    else { const mx = (minX + maxX) / 2, my = minY / 2; rx.moveTo(mx, my); rx.arc(mx, my, maxX - minX - minY, (165 * Math.PI) / 180, (285 * Math.PI) / 180); rx.closePath(); }
    rx.fill();
    c.save(); c.globalAlpha = 0.55; c.drawImage(rc, -ox, -oy, W, H); c.restore(); rc.width = rc.height = 0;
  }
  return { cv, ox, oy, w: W, h: H, width: P.w * sc };
}

// ---------- 언덕 ----------
const HILL = [[14, 430, 5, 170], [12, 360, 4, 140], [8, 520, 3, 210]];
export function hillSpec(i, L, rand) { const s = L.s, p = HILL[i]; return { crest: L.crest[i], A1: p[0] * s, l1: p[1] * s, A2: p[2] * s, l2: p[3] * s, p1: rand(), p2: rand() }; }
export function hillY(h, x) { return h.crest + h.A1 * Math.sin(TAU * (x / h.l1 + h.p1)) + h.A2 * Math.sin(TAU * (x / h.l2 + h.p2)); }
export function hillLayer(o) {
  const { h, color, W, y0, y1, dpr, rand, snow, grass, extra } = o; const ox = o.ox || 0;
  const HH = y1 - y0; const [cv, c] = mkCanvas(W + 2 * ox, HH, dpr); c.translate(ox, -y0);
  const pts = []; for (let x = -16; x <= W + 23; x += 7) pts.push([x, hillY(h, x) + (rand() * 2 - 1) * 1.2]);
  const top = (dy) => { c.moveTo(pts[0][0], pts[0][1] + dy); for (let i = 1; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; c.quadraticCurveTo(a[0], a[1] + dy, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + dy); } const l = pts[pts.length - 1]; c.lineTo(l[0], l[1] + dy); };
  const shape = (dy) => { c.beginPath(); top(dy); c.lineTo(W + 23, y1 + 4); c.lineTo(-16, y1 + 4); c.closePath(); };
  shape(0); c.fillStyle = mix(color, '#FFFFFF', 0.12); c.fill();
  shape(2.5); c.fillStyle = color; c.fill();
  if (snow) {
    const ph = rand() * 9, ph2 = rand() * 9;
    const th = (x) => 11 + 2.2 * Math.sin(x / 23 + ph) + 1.2 * Math.sin(x / 9 + ph2);
    const band = (cut) => { c.beginPath(); top(-0.8); for (let i = pts.length - 1; i >= 0; i--) { const [x, y] = pts[i]; c.lineTo(x, y + th(x) - cut); } c.closePath(); };
    band(0); c.fillStyle = snow[1]; c.fill();
    band(1); c.fillStyle = snow[0]; c.fill(); // 밑면 그늘 1px(fix1-11)
  } else if (grass) {
    c.strokeStyle = mix(color, '#FFFFFF', 0.18); c.lineWidth = 1.2; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i < grass; i += 3) {
      const x = rand() * W, y = hillY(h, x) + 2;
      for (let k = -1; k <= 1; k++) { const len = 4 + rand() * 3, a = -Math.PI / 2 + k * 0.42 + (rand() - 0.5) * 0.2; c.moveTo(x + k * 1.5, y); c.lineTo(x + k * 1.5 + Math.cos(a) * len, y + Math.sin(a) * len); }
    }
    c.stroke();
  }
  if (extra) extra(c);
  return { cv, y0, h: HH, ox };
}
export function treeSprite(kind, G, snow, dpr, s, rand) {
  const leaf = mix(G, '#FFFFFF', 0.06), shade = mix(leaf, '#08101A', 0.3), trunk = mix(G, '#000000', 0.3);
  const w = 50 * s, hh = 68 * s; const [cv, c] = mkCanvas(w, hh, dpr); const ox = w / 2, oy = hh - 3 * s; c.translate(ox, oy); c.scale(s, s);
  let path, snowY, top;
  if (kind === 'round') {
    c.fillStyle = trunk; c.fillRect(-1.5, -15, 3, 16);
    const circ = [[-6.5, -25, 12], [1, -39, 15], [8.5, -26, 10]].map(([x, y, r]) => circlePts(x, y, r, rand, 0.8));
    path = (dx, dy) => { c.beginPath(); circ.forEach((p) => smoothClosed(c, p, dx, dy)); };
    snowY = -38; top = -56;
  } else {
    c.fillStyle = trunk; c.fillRect(-1.5, -9, 3, 10);
    const tiers = [[26, 16, -7], [20, 14, -19], [14, 12, -30]];
    path = (dx, dy) => { c.beginPath(); for (const [tw, th, by] of tiers) { c.moveTo(-tw / 2 + dx, by + dy); c.lineTo(0.5 + dx, by - th + dy); c.lineTo(tw / 2 + dx, by + dy); c.closePath(); } };
    snowY = -28; top = -44;
  }
  c.save(); path(0, 0); c.fillStyle = shade; c.fill(); c.clip(); path(-2.6, -3.4); c.fillStyle = leaf; c.fill();
  if (snow) { c.beginPath(); c.moveTo(-22, top - 4); c.lineTo(22, top - 4); for (let x = 22; x >= -22; x -= 4) c.lineTo(x, snowY + 2 * Math.sin(x * 0.7)); c.closePath(); c.fillStyle = snow[0]; c.fill(); }
  c.restore();
  return { cv, ox, oy, w, h: hh, top: -top * s };
}
export function drawHouse(c, x, y, s, hillCol, lit, snow) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const wall = mix(hillCol, '#0B1220', 0.3), roof = mix(hillCol, '#0B1220', 0.46), win = lit ? WINDOW : mix(wall, '#FFFFFF', 0.16);
  c.fillStyle = roof; c.fillRect(6, -33, 3.2, 9);
  c.fillStyle = wall; c.fillRect(-12, -19, 24, 22);
  c.fillStyle = mix(wall, '#0B1220', 0.18); c.fillRect(8, -19, 4, 22);
  c.fillStyle = roof; c.beginPath(); c.moveTo(-15.5, -18); c.lineTo(0, -31); c.lineTo(15.5, -18); c.closePath(); c.fill();
  if (snow) { c.fillStyle = snow[0]; c.beginPath(); c.moveTo(-15.5, -18); c.lineTo(0, -31.5); c.lineTo(15.5, -18); c.lineTo(13, -17); c.lineTo(0, -28.5); c.lineTo(-13, -17); c.closePath(); c.fill(); }
  c.fillStyle = win; for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) c.fillRect(-8.6 + k * 6.4, -15 + r * 7, 3.6, 3.8);
  c.restore();
}
export function drawScreen(c, x, y, s, night, snow) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const body = night ? '#B8C2CF' : '#F4F0E6'; const dark = mix(body, '#1B2433', 0.5), side = mix(body, '#1B2433', 0.15), slat = mix(body, '#1B2433', 0.26);
  c.globalAlpha = 0.5; c.fillStyle = dark; c.fillRect(-7.5, -20, 2, 19); c.fillRect(6.5, -20, 2, 19); c.globalAlpha = 1;
  c.fillStyle = dark; c.fillRect(-10, -20, 2, 21); c.fillRect(8, -20, 2, 21); c.fillRect(-10, -9, 20, 1.4);
  c.fillStyle = side; c.fillRect(-11, -46, 22, 27);
  c.fillStyle = body; c.fillRect(-11, -46, 18.5, 25);
  c.fillStyle = slat; for (let i = 0; i < 5; i++) c.fillRect(-9, -42.5 + i * 4.8, 16.5, 1.5);
  c.fillRect(-0.6, -44, 1.2, 22);
  c.fillStyle = mix(body, '#1B2433', 0.08); c.beginPath(); c.moveTo(-15, -46); c.lineTo(15, -46); c.lineTo(12.5, -50.5); c.lineTo(-12.5, -50.5); c.closePath(); c.fill();
  c.fillStyle = mix(body, '#1B2433', 0.32); c.fillRect(-14, -46, 28, 1.2);
  if (snow) { c.fillStyle = snow[0]; c.beginPath(); c.moveTo(-15.5, -49); c.quadraticCurveTo(0, -57, 15.5, -49); c.lineTo(15, -47.6); c.lineTo(-15, -47.6); c.closePath(); c.fill(); }
  c.restore();
}

// ---------- 해·달·별 ----------
export function sunSprite(tod, r, s, dpr) {
  const [disc, haloC, haloA] = SUN[tod]; const dusk = tod === 'dusk';
  const halo = haloSprite(haloC, haloA, r * 0.9, dusk ? r + 92 * s : 170 * s, dpr);
  const R = dusk ? 200 * s : r + 26 * s;
  const [cv, c] = mkCanvas(R * 2, R * 2, dpr); c.translate(R, R);
  if (dusk) {
    // 지평선 빛 타원 rx200·ry70(fix1-4, 과녁 같은 고리 3개 대신). 스스로 빛나는 것이라 radial 허용
    c.save(); c.scale(1, 0.35); const g = c.createRadialGradient(0, 0, 0, 0, 0, 200 * s); g.addColorStop(0, rgba('#FFB775', 0.4)); g.addColorStop(1, rgba('#FFB775', 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 200 * s, 0, TAU); c.fill(); c.restore();
  } else {
    c.beginPath(); c.arc(0, 0, r + 22 * s, 0, TAU); c.lineWidth = 6 * s; c.strokeStyle = rgba(disc, 0.2); c.stroke();
  }
  const hi = mix(disc, '#FFFFFF', 0.35), lo = mix(disc, '#D97A2B', 0.25);
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
  c.fillStyle = hi; c.fillRect(-r, -r, 2 * r, 2 * r);
  c.beginPath(); c.arc(r * 0.09, r * 0.11, r, 0, TAU); c.fillStyle = disc; c.fill();
  c.beginPath(); c.rect(-r - 2, -r - 2, 2 * r + 4, 2 * r + 4); c.arc(-r * 0.13, -r * 0.16, r, 0, TAU, true); c.fillStyle = lo; c.fill('evenodd');
  c.restore();
  return { halo, disc: { cv, R } };
}
export function haloSprite(color, alpha, r0, R, dpr) {
  const [cv, c] = mkCanvas(R * 2, R * 2, dpr); c.translate(R, R);
  const g = c.createRadialGradient(0, 0, r0, 0, 0, R); g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); return { cv, R };
}
// 실제 위상 달. 위상 <.5면 오른쪽이 밝다(북반구). 삭 근처는 .06으로 고정.
export function moonPhase(date) { const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000; let p = (days / 29.53059) % 1; if (p < 0) p += 1; return p; }
export function drawMoon(c, x, y, r, phase, darkCol, alpha) {
  let ph = phase; if (ph < 0.06) ph = 0.06; if (ph > 0.94) ph = 0.94;
  c.save(); c.globalAlpha = alpha; c.translate(x, y); if (ph >= 0.5) c.scale(-1, 1);
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = MOON.disc; c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(120,108,84,.16)';
  for (const [cx, cy, cr] of [[0.28, -0.22, 0.16], [-0.12, 0.34, 0.12], [0.42, 0.28, 0.09]]) { c.beginPath(); c.arc(cx * r, cy * r, cr * r, 0, TAU); c.fill(); }
  c.beginPath(); c.arc(-r * 0.1, -r * 0.12, r, 0, TAU); c.rect(-r - 2, -r - 2, 2 * r + 4, 2 * r + 4); c.fillStyle = 'rgba(201,195,174,.35)'; c.fill('evenodd');
  c.restore();
  const cs = Math.cos(TAU * ph), rx = Math.max(0.01, Math.abs(cs) * r);
  c.beginPath(); c.moveTo(0, -r); c.arc(0, 0, r + 0.6, -Math.PI / 2, Math.PI / 2, true);
  c.ellipse(0, 0, rx, r + 0.6, 0, Math.PI / 2, -Math.PI / 2, cs > 0);
  c.closePath(); c.fillStyle = darkCol; c.fill();
  c.fillStyle = rgba(MOON.shade, 0.05); c.fill(); // fix1-9
  c.restore();
}
export function makeStars(rand, W, H) {
  const out = [];
  for (let i = 0; i < 120; i++) { const u = rand(); out.push({ x: rand() * W, y: Math.pow(rand(), 1.3) * 0.55 * H, r: u < 0.7 ? 0.6 : u < 0.95 ? 1.0 : 1.6, a: 0.5 + rand() * 0.5, per: 2400 + rand() * 2800, ph: rand(), cross: false }); }
  out.slice().sort((a, b) => b.r - a.r || b.a - a.a).slice(0, 8).forEach((s) => (s.cross = true));
  return out;
}
export function drawStars(c, stars, t, alpha, H, night, suck, still) {
  c.fillStyle = STAR; c.strokeStyle = STAR;
  for (const s of stars) {
    let a = s.a * alpha * (still ? 0.85 : 0.62 + 0.38 * Math.sin(TAU * (t / s.per + s.ph)));
    if (!night) a *= Math.max(0, Math.min(1, 1.25 - s.y / (0.4 * H)));
    if (a <= 0.01) continue;
    let x = s.x, y = s.y;
    if (suck) { x += (suck.x - x) * suck.p; y += (suck.y - y) * suck.p; a *= 1 - suck.p; }
    c.globalAlpha = a;
    if (s.cross) { c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 3.5, y); c.lineTo(x + 3.5, y); c.moveTo(x, y - 3.5); c.lineTo(x, y + 3.5); c.stroke(); c.beginPath(); c.arc(x, y, 1.1, 0, TAU); c.fill(); }
    else if (s.r < 1) c.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    else { c.beginPath(); c.arc(x, y, s.r, 0, TAU); c.fill(); }
  }
  c.globalAlpha = 1;
}
export function makeMilky(rand, W, H, dpr) {
  const hh = H * 0.72; const [cv, c] = mkCanvas(W, hh, dpr);
  const ax = -0.12 * W, ay = 0.6 * H, bx = 1.12 * W, by = 0.06 * H; const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const gauss = () => { let u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand()); };
  for (let i = 0; i < 80; i++) { const tt = rand(), g = gauss() * 30; const x = ax + ux * len * tt + nx * g, y = ay + uy * len * tt + ny * g; const r = 22 + rand() * 34; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(MILKY, 0.045 + rand() * 0.035)); gr.addColorStop(1, rgba(MILKY, 0)); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
  for (let i = 0; i < 260; i++) { const tt = rand(), g = gauss() * 60 * 0.6; const x = ax + ux * len * tt + nx * g, y = ay + uy * len * tt + ny * g; const a = (0.15 + rand() * 0.3) * (1 - Math.min(0.8, Math.abs(g) / 110)); c.fillStyle = rgba(MILKY, a); c.beginPath(); c.arc(x, y, 0.5 + rand() * 0.7, 0, TAU); c.fill(); }
  return cv;
}
// ---------- 무지개 ----------
// 끝은 지름 방향으로 자른다: 가운데 띠가 x = W−40에 닿는 각 a1까지(그 자리를 C2 구름이 가림, fix1-7). 밤은 희뿌연 달무지개(fix1-10)
export function makeRainbow(L, dpr, night) {
  const W = L.W, cx = 0.62 * W, cy = L.crest[0] + 130, R = 0.62 * W, bw = (night ? 10 : 14) * L.s;
  const a1 = TAU - Math.acos(Math.max(-1, Math.min(1, (W - 40 * L.s - cx) / (R - 3 * bw))));
  const pad = night ? 20 * L.s : 4, y0 = cy - R - pad, hh = R + pad + 4; const [cv, c] = mkCanvas(W, hh, dpr); c.translate(0, -y0);
  const cols = night ? RAINBOW.map((x) => mix(x, '#FFFFFF', 0.45)) : RAINBOW;
  if (night) { const g = c.createRadialGradient(cx, cy, R, cx, cy, R + 16 * L.s); g.addColorStop(0, rgba('#CFE0F2', 0.27)); g.addColorStop(1, rgba('#CFE0F2', 0)); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R + 16 * L.s, Math.PI, a1); c.arc(cx, cy, R - 1, a1, Math.PI, true); c.closePath(); c.fill(); }
  c.lineCap = 'butt';
  for (let i = 5; i >= 0; i--) { const rm = R - bw * (5 - i) - bw / 2; c.strokeStyle = cols[i]; c.lineWidth = bw + 0.8; c.beginPath(); c.arc(cx, cy, rm, Math.PI, a1); c.stroke(); }
  return { cv, y0, h: hh, cx, cy, R, bw, a1 };
}
// 미리 그린 그림(미리내)의 달 둘레 고리 평균색 [r,g,b,a] (fix1-9, 한 번만 읽는다)
export function ringColor(cv, dpr, x, y, r) {
  try {
    const R = r + 9, sx = Math.max(0, Math.round((x - R) * dpr)), sy = Math.max(0, Math.round((y - R) * dpr));
    const w = Math.max(1, Math.min(cv.width - sx, Math.round(2 * R * dpr))), h = Math.max(1, Math.min(cv.height - sy, Math.round(2 * R * dpr)));
    const g = cv.getContext('2d').getImageData(sx, sy, w, h).data; let n = 0, sa = 0, sr = 0, sg = 0, sb = 0;
    for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) { const dd = Math.hypot((sx + i) / dpr - x, (sy + j) / dpr - y); if (dd > r + 2 && dd < r + 8) { const o = (j * w + i) * 4, a = g[o + 3] / 255; n++; sa += a; sr += g[o] * a; sg += g[o + 1] * a; sb += g[o + 2] * a; } }
    return n && sa > 0 ? [sr / sa, sg / sa, sb / sa, sa / n] : null;
  } catch (e) { return null; }
}
// ---------- 번개 ----------
function displace(r, pts, amp, iters) {
  for (let it = 0; it < iters; it++) {
    const np = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; const off = (r() * 2 - 1) * amp; np.push([(a[0] + b[0]) / 2 - (dy / l) * off, (a[1] + b[1]) / 2 + (dx / l) * off]); np.push(b); }
    pts = np; amp *= 0.55;
  }
  return pts;
}
export function makeBolt(r, x0, y0, x1, y1, dirOnly) {
  const L0 = Math.hypot(x1 - x0, y1 - y0);
  const pts = displace(r, [[x0, y0], [x1, y1]], L0 * 0.16, 6);
  const branches = []; const nb = r() < 0.4 ? 2 : 1;
  for (let k = 0; k < nb; k++) { const s = pts[Math.floor(pts.length * (0.22 + r() * 0.36))]; const dir = dirOnly || (r() < 0.5 ? -1 : 1); const bl = L0 * 0.35; branches.push(displace(r, [s, [s[0] + dir * bl * (0.4 + r() * 0.3), s[1] + bl * 0.75]], bl * 0.18, 5)); }
  return { pts, branches };
}
export function drawBolt(c, b, alpha) {
  if (alpha <= 0) return;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const poly = (p) => { c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]); };
  for (const [w, col, a] of [[14, '#FFD66B', 0.18], [5, '#FFE59A', 0.5], [2, '#FFF6D6', 1]]) {
    c.globalAlpha = a * alpha; c.strokeStyle = col;
    c.lineWidth = w; c.beginPath(); poly(b.pts); c.stroke();
    c.lineWidth = w * 0.6; c.beginPath(); b.branches.forEach(poly); c.stroke();
  }
  c.restore();
}

// ---------- 구름 친구 (키 56 기준, 바닥 y=0) ----------
const FACE = FRIEND.face;
function bodyPath(c, spiky, dx, dy) {
  c.beginPath();
  c.ellipse(dx, -22 + dy, 23, 19, 0, 0, TAU);
  if (spiky) {
    for (const [a, b, d] of [[[-15, -33], [-10, -51], [-3, -37]], [[-6, -38], [1, -57], [9, -38]], [[5, -36], [13, -50], [18, -31]]]) { c.moveTo(a[0] + dx, a[1] + dy); c.lineTo(b[0] + dx, b[1] + dy); c.lineTo(d[0] + dx, d[1] + dy); c.closePath(); }
  } else {
    for (const [x, y, r] of [[-10, -38, 9], [1, -42, 11], [12, -36, 8]]) { c.moveTo(x + r + dx, y + dy); c.arc(x + dx, y + dy, r, 0, TAU); }
  }
}
function twoTone(c, pathFn, light, shade, k) { c.save(); pathFn(0, 0); c.fillStyle = shade; c.fill(); c.clip(); pathFn(-7 * k, -9 * k); c.fillStyle = light; c.fill(); c.restore(); }
function hand(c, x, y, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, 3.3, 0, TAU); c.fill(); }
// p: { tod, w, t, blink, look, up, jump, sx, sy, rot, dx, propS, eyes, mouth, spiky, lantern, step, wave, mini, heel, cloudCol, glow }
export function drawFriend(c, x, y, f, p) {
  const [bodyC, shadeC] = FRIEND[p.tod];
  c.save(); c.translate(x + p.dx * f, y);
  const js = Math.max(0.35, 1 - p.jump / 40);
  c.fillStyle = 'rgba(8,12,20,.25)'; c.beginPath(); c.ellipse(0, 0, 22 * f * js, 3 * f * js, 0, 0, TAU); c.fill();
  c.translate(0, -(p.jump + p.heel) * f);
  c.scale(f * p.sx, f * p.sy); c.rotate(p.rot);
  // 등불 빛무리(뒤)
  if (p.lantern && p.glow) c.drawImage(p.glow.cv, -24 - p.glow.R / f, -9 - p.glow.R / f, (p.glow.R * 2) / f, (p.glow.R * 2) / f);
  // 발
  c.fillStyle = shadeC; c.beginPath(); c.ellipse(-8, -2 - p.step * 2, 5, 3.5, 0, 0, TAU); c.ellipse(8, -2 + p.step * 2, 5, 3.5, 0, 0, TAU); c.fill();
  if (p.w === 'rain' && p.propS > 0.01) { c.save(); c.translate(12, -49); c.scale(p.propS, p.propS); c.rotate(-0.16); c.strokeStyle = '#3A4252'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 18); c.arc(2.6, 18, 2.6, Math.PI, 0, true); c.stroke(); c.restore(); } // 우산 손잡이는 몸 뒤(fix1-5)
  twoTone(c, (dx, dy) => bodyPath(c, p.spiky, dx, dy), bodyC, shadeC, 56 / 120);
  // 얼굴
  const lx = p.look * 2.4, ly = -p.up * 1.8;
  c.fillStyle = FRIEND.cheek; c.beginPath(); c.ellipse(-12 + lx * 0.6, -20 + ly * 0.5, 4, 2.5, 0, 0, TAU); c.ellipse(12 + lx * 0.6, -20 + ly * 0.5, 4, 2.5, 0, 0, TAU); c.fill();
  c.fillStyle = FACE; c.strokeStyle = FACE; c.lineCap = 'round'; c.lineWidth = 1.6;
  const eyes = p.eyes;
  for (const s of [-1, 1]) {
    const ex = s * 7 + lx, ey = -26 + ly;
    if (eyes === 'happy') { c.beginPath(); c.moveTo(ex - 2.5, ey + 1); c.quadraticCurveTo(ex, ey - 2.8, ex + 2.5, ey + 1); c.stroke(); }
    else if (eyes === 'closed') { c.beginPath(); c.moveTo(ex - 2.5, ey - 0.6); c.quadraticCurveTo(ex, ey + 2.4, ex + 2.5, ey - 0.6); c.stroke(); }
    else {
      const r = eyes === 'big' ? 3.2 : 2.2; const oy = eyes === 'up' ? -1.4 : 0; const ry = Math.max(0.25, r * (1 - 0.85 * p.blink));
      c.beginPath(); c.ellipse(ex, ey + oy, r, ry, 0, 0, TAU); c.fill();
      if (p.blink < 0.4) { c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(ex - r * 0.32, ey + oy - r * 0.38, r * 0.34, 0, TAU); c.fill(); c.fillStyle = FACE; }
    }
  }
  const mx = lx * 0.8, my = ly * 0.6; c.lineWidth = 1.4;
  if (p.mouth === 'flat') { c.beginPath(); c.moveTo(-2.6 + mx, -19.4 + my); c.lineTo(2.6 + mx, -19.4 + my); c.stroke(); }
  else if (p.mouth === 'o') { c.beginPath(); c.ellipse(mx, -18.8 + my, 2.1, 2.6, 0, 0, TAU); c.fill(); }
  else if (p.mouth === 'open') { c.beginPath(); c.ellipse(mx, -18.8 + my, 2.8, 2.5, 0, 0, TAU); c.fill(); c.fillStyle = '#E8695A'; c.beginPath(); c.ellipse(mx, -17.6 + my, 1.6, 1, 0, 0, TAU); c.fill(); c.fillStyle = FACE; }
  else { c.beginPath(); c.moveTo(-3 + mx, -20.4 + my); c.quadraticCurveTo(mx, -16.4 + my, 3 + mx, -20.4 + my); c.stroke(); }
  // 소품
  const ps = p.propS;
  if (ps > 0.01) {
    c.save();
    const prop = (px, py, fn) => { c.save(); c.translate(px, py); c.scale(ps, ps); fn(); c.restore(); };
    if (p.w === 'none') prop(21, -16, () => { c.rotate(-0.16); hand(c, -2, 4, bodyC); const b = '#F4F0E6'; twoTone(c, (dx, dy) => { c.beginPath(); c.rect(-6 + dx, -14 + dy, 12, 16); }, b, mix(b, '#1B2433', 0.18), 0.12); c.fillStyle = '#8A8F99'; c.fillRect(-3, -15.5, 6, 2.6); c.fillStyle = '#A9B0BA'; for (let i = 0; i < 3; i++) c.fillRect(-3.6, -9 + i * 3.4, 7.2 - (i === 2 ? 3 : 0), 1); hand(c, -5, 1, bodyC); });
    else if (p.w === 'sunny') prop(1, -46, () => { const h = '#E7B66A', hs = mix(h, '#7A4A1E', 0.3); c.fillStyle = hs; c.beginPath(); c.ellipse(0, 0.6, 20, 4, 0, 0, TAU); c.fill(); c.fillStyle = h; c.beginPath(); c.ellipse(-0.6, 0, 20, 3.6, 0, 0, TAU); c.fill(); twoTone(c, (dx, dy) => { c.beginPath(); c.arc(dx, dy, 10, Math.PI, 0); c.closePath(); }, h, hs, 0.18); c.fillStyle = '#C8553D'; c.fillRect(-10, -3.4, 20, 2.6); });
    else if (p.w === 'cloudy') { const mx2 = -p.dx * 0.55 + Math.sin(p.t / 900) * 2; prop(mx2, -66 + Math.sin(p.t / 700) * 1.5, () => { const col = p.cloudCol || ['#F2F4F5', '#C5D0D8']; twoTone(c, (dx, dy) => { c.beginPath(); for (const [cx, cy, r] of [[-5, -3.5, 4], [2, -5.5, 4.8], [7, -3, 3.2]]) { c.moveTo(cx + r + dx, cy + dy); c.arc(cx + dx, cy + dy, r, 0, TAU); } c.rect(-9 + dx, -3 + dy, 19, 3); }, col[0], col[1], 0.2); }); }
    else if (p.w === 'rain') prop(12, -49, () => { c.rotate(-0.16); const u = '#F2C14E', us = mix(u, '#7A4A1E', 0.24); twoTone(c, (dx, dy) => { c.beginPath(); c.moveTo(-20 + dx, dy); c.arc(dx, dy, 20, Math.PI, 0); for (let i = 3; i >= 0; i--) { const xa = -20 + i * 10; c.quadraticCurveTo(xa + 5 + dx, -3 + dy, xa + dx, dy); } c.closePath(); }, u, us, 0.3); c.fillStyle = us; c.fillRect(-0.8, -23, 1.6, 4); hand(c, 0, 14, bodyC); c.fillStyle = 'rgba(213,231,242,.85)'; for (let i = 0; i < 3; i++) { const ph = ((p.t / 650) + i / 3) % 1; const sx = (i - 1) * 13; c.globalAlpha = 1 - ph; c.beginPath(); c.arc(sx + (i - 1) * ph * 8, -20 + Math.abs(sx) * 0.35 - Math.sin(ph * Math.PI) * 6, 1.1, 0, TAU); c.fill(); } c.globalAlpha = 1; });
    else if (p.w === 'snow') { prop(0, 0, () => { const r = '#D9534F', rs = mix(r, '#3A1010', 0.22); twoTone(c, (dx, dy) => { c.beginPath(); c.ellipse(dx, -40 + dy, 17, 16, 0, Math.PI, 0); c.rect(-17 + dx, -41 + dy, 34, 5); }, r, rs, 0.25); c.fillStyle = '#F7F2E7'; c.fillRect(-17, -40, 34, 1.6); c.fillRect(-17, -37.4, 34, 1.4); c.beginPath(); c.arc(0, -56, 4, 0, TAU); c.fill(); twoTone(c, (dx, dy) => { c.beginPath(); c.moveTo(-19 + dx, -10 + dy); c.quadraticCurveTo(dx, -5 + dy, 19 + dx, -10 + dy); c.lineTo(19 + dx, -5 + dy); c.quadraticCurveTo(dx, 0 + dy, -19 + dx, -5 + dy); c.closePath(); c.rect(9 + dx, -7 + dy, 6, 13); }, r, rs, 0.2); c.fillStyle = '#F7F2E7'; c.fillRect(9, 1, 6, 1.2); c.fillRect(9, 3.4, 6, 1.2); }); }
    else if (p.w === 'rainbow') prop(20, -15, () => { c.rotate(0.35 + p.wave); hand(c, 0, 4, bodyC); c.fillStyle = '#9B7650'; c.fillRect(-1, -14, 2, 18); const tips = ['#E8695A', '#F5D566', '#5AA9DE']; for (let i = 0; i < 3; i++) { c.fillStyle = tips[i]; c.beginPath(); c.ellipse(0, -16 - i * 2.4, 2.4 - i * 0.4, 1.8, 0, 0, TAU); c.fill(); } hand(c, 0, 4, bodyC); });
    c.restore();
  }
  // 등불
  if (p.lantern) { hand(c, -22, -15, bodyC); c.strokeStyle = '#4A4F5C'; c.lineWidth = 1; c.beginPath(); c.moveTo(-22, -15); c.lineTo(-24, -11); c.stroke(); c.fillStyle = '#7A5A30'; c.fillRect(-27, -12, 6, 1.6); c.fillStyle = WINDOW; c.beginPath(); c.ellipse(-24, -7, 3.8, 4.6, 0, 0, TAU); c.fill(); c.fillStyle = '#FFE7B0'; c.beginPath(); c.ellipse(-25, -8, 1.4, 2, 0, 0, TAU); c.fill(); }
  c.restore();
}
