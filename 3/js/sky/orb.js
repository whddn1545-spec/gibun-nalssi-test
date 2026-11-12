// 하늘 구슬 drawOrb(날씨, d) (design-spec §5.7). 날씨×크기별 오프스크린 캐시.
import { applyGrain } from './paper.js';
import { rgba } from '../palette.js';
const TAU = Math.PI * 2;
export const ORB_BG = { sunny: ['#5BB4EE', '#BFE6F2'], cloudy: ['#8FA6B8', '#C9D4DA'], rain: ['#2E4C68', '#4E7A92'], thunder: ['#1E2533', '#3A3540'], snow: ['#9FC3E0', '#CFE3F2'], rainbow: ['#7FD0C6', '#F7E8B0'] };
const cache = new Map();
const SIN12 = Math.sin(0.21), COS12 = Math.cos(0.21);

function symbol(c, w, d) {
  const small = d < 32;
  if (w === 'sunny') {
    const r = (small ? 0.32 : 0.27) * d, x = 0.04 * d, y = 0.02 * d; // fix2b: 해 중심을 반사광에서 떨어뜨림(오른쪽 아래로 +.08d)
    c.fillStyle = '#E9B23C'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.save(); c.clip(); c.fillStyle = '#FFD257'; c.beginPath(); c.arc(x - r * 0.12, y - r * 0.15, r, 0, TAU); c.fill(); c.restore();
  } else if (w === 'cloudy') {
    const cs = small ? [[-0.13, 0.05, 0.17], [0.11, -0.01, 0.21]] : [[-0.2, 0.07, 0.15], [0.0, -0.05, 0.2], [0.2, 0.07, 0.14]];
    const path = (dx, dy) => { c.beginPath(); for (const [x, y, r] of cs) { c.moveTo((x + r) * d + dx, y * d + dy); c.arc(x * d + dx, y * d + dy, r * d, 0, TAU); } c.rect(-0.3 * d + dx, 0.06 * d + dy, 0.6 * d, 0.14 * d); };
    c.save(); path(0, 0); c.fillStyle = '#D3DDE5'; c.fill(); c.clip(); path(-0.04 * d, -0.05 * d); c.fillStyle = '#FFFFFF'; c.fill(); c.restore();
  } else if (w === 'rain') {
    c.strokeStyle = '#CFE8F5'; c.lineCap = 'round'; c.lineWidth = (small ? 0.08 : 0.05) * d;
    const xs = small ? [-0.1, 0.13] : [-0.17, 0.01, 0.19], ys = small ? [-0.06, 0.05] : [-0.08, 0.06, -0.03];
    c.beginPath();
    for (let i = 0; i < xs.length; i++) { const x0 = xs[i] * d + SIN12 * 0.15 * d, y0 = ys[i] * d - 0.15 * d; c.moveTo(x0, y0); c.lineTo(x0 - SIN12 * 0.3 * d, y0 + COS12 * 0.3 * d); }
    c.stroke();
  } else if (w === 'thunder') {
    const h = (small ? 0.7 : 0.62) * d;
    const pts = [[0.13, -0.5], [-0.2, 0.07], [-0.01, 0.07], [-0.13, 0.5], [0.23, -0.1], [0.04, -0.1]];
    c.fillStyle = '#FFD257'; c.beginPath(); pts.forEach(([x, y], i) => { const X = x * h * 0.95, Y = y * h; if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.closePath(); c.fill();
  } else if (w === 'snow') {
    c.fillStyle = '#FFFFFF';
    c.beginPath(); c.ellipse(0, 0.47 * d, 0.52 * d, 0.22 * d, 0, 0, TAU); c.fill();
    const dots = small ? [[-0.17, -0.18], [0.14, -0.24], [0.2, 0.02], [-0.08, 0.03]] : [[-0.2, -0.2], [0.07, -0.3], [0.24, -0.1], [-0.05, -0.06], [-0.27, 0.06], [0.15, 0.1], [0.0, 0.17]];
    const r = (small ? 0.07 : 0.045) * d;
    c.beginPath(); for (const [x, y] of dots) { c.moveTo(x * d + r, y * d); c.arc(x * d, y * d, r, 0, TAU); } c.fill();
  } else if (w === 'rainbow') {
    const cs = ['#E8695A', '#F6C24C', '#4CA7E3'], rs = [0.4, 0.32, 0.24];
    c.lineWidth = (small ? 0.11 : 0.08) * d;
    for (let i = 0; i < 3; i++) { c.strokeStyle = cs[i]; c.beginPath(); c.arc(0, 0.22 * d, rs[i] * d, Math.PI, TAU); c.stroke(); }
  }
}
// ctx 좌표계(CSS px)에서 (0,0)을 중심으로 그린다. opts: bleed(하늘 mid 색), gloss(-1..1 광택 이동)
export function drawOrb(c, w, d, opts = {}) {
  const r = d / 2;
  if (opts.shadow && d >= 36) { c.fillStyle = 'rgba(10,16,30,.35)'; c.beginPath(); c.ellipse(0, r * 0.98, 0.42 * d, 0.08 * d, 0, 0, TAU); c.fill(); }
  c.save();
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
  const bg = ORB_BG[w] || ORB_BG.cloudy;
  c.save(); if (opts.rot) c.rotate(opts.rot);
  const g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
  c.fillStyle = g; c.fillRect(-r - 1, -r - 1, d + 2, d + 2);
  // 그날 하늘 mid 색 번짐: 아래 40%, α bleedA(기본 .35) (fix1-13)
  const ba = opts.bleed ? (opts.bleedA == null ? 0.35 : opts.bleedA) : 0;
  if (ba > 0.003) { const b = c.createLinearGradient(0, 0.1 * d, 0, r); b.addColorStop(0, rgba(opts.bleed, 0)); b.addColorStop(1, rgba(opts.bleed, ba)); c.fillStyle = b; c.fillRect(-r - 1, 0.1 * d, d + 2, r - 0.1 * d + 1); }
  symbol(c, w, d);
  c.restore();
  c.beginPath(); c.rect(-r - 2, -r - 2, d + 4, d + 4); c.arc(-0.06 * d, -0.09 * d, r, 0, TAU, true); c.fillStyle = 'rgba(10,16,30,.22)'; c.fill('evenodd');
  const hl = (a) => { c.save(); c.translate(-0.22 * d, -0.26 * d); c.rotate(-35 * Math.PI / 180); c.beginPath(); c.ellipse(0, 0, 0.19 * d, 0.11 * d, 0, 0, TAU); c.fillStyle = `rgba(255,255,255,${a})`; c.fill(); c.restore(); };
  if (w === 'sunny') { // fix2b: 해와 겹치는 반사광은 절반(.275)이라 '달걀 프라이'처럼 보이지 않는다
    const sr = (d < 32 ? 0.32 : 0.27) * d, sx = 0.04 * d, sy = 0.02 * d;
    c.save(); c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.clip(); hl(0.275); c.restore();
    c.save(); c.beginPath(); c.rect(-r - 2, -r - 2, d + 4, d + 4); c.arc(sx, sy, sr, 0, TAU, true); c.clip('evenodd'); hl(0.55); c.restore();
  } else hl(0.55);
  const sw = opts.sweep || 0;
  if (sw > 0 && sw < 1) { c.save(); c.translate(-0.28 * d + sw * 0.3 * d, -0.3 * d + sw * 0.3 * d); c.rotate(-35 * Math.PI / 180); c.beginPath(); c.ellipse(0, 0, 0.17 * d, 0.07 * d, 0, 0, TAU); c.fillStyle = `rgba(255,255,255,${(0.5 * Math.sin(Math.PI * sw)).toFixed(3)})`; c.fill(); c.restore(); }
  if (d >= 20) applyGrain(c, -r, -r, d, d, 0.16);
  c.restore();
}
// 캐시된 구슬 그림(정사각, 가운데 기준). size = d + 2*pad
export function orbSprite(w, d, dpr, opts = {}) {
  const key = `${w}|${d}|${dpr}|${opts.bleed || ''}|${opts.shadow ? 1 : 0}`;
  let e = cache.get(key); if (e) return e;
  const pad = opts.shadow ? Math.ceil(d * 0.12) : 1, size = d + pad * 2;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(size * dpr); cv.height = Math.ceil(size * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr); c.translate(size / 2, size / 2); drawOrb(c, w, d, opts);
  e = { cv, size, pad }; cache.set(key, e);
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  return e;
}
// DOM용 작은 캔버스 하나에 구슬을 그린다.
export function orbCanvas(w, d) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas'); cv.width = Math.round(d * dpr); cv.height = Math.round(d * dpr);
  const c = cv.getContext('2d'); c.scale(dpr, dpr); c.translate(d / 2, d / 2); drawOrb(c, w, d);
  cv.dataset.w = w; return cv;
}
