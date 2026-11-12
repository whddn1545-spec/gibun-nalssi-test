// 하늘 엔진 공용 수학·색 도구

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// 목표를 지나쳤다가 돌아오는 스프링 느낌의 이징
export const easeOutBack = (t, s = 1.6) => {
  const u = clamp(t) - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};
export const follow = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── 색: [r, g, b] 배열로 다룬다 ──
export const hex = (c) => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mulc = (c, m) => [c[0] * m[0], c[1] * m[1], c[2] * m[2]];
export const addc = (c, d) => [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
export const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const ch = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
export const css = (c, a = 1) => (a >= 1 ? `rgb(${ch(c[0])},${ch(c[1])},${ch(c[2])})` : `rgba(${ch(c[0])},${ch(c[1])},${ch(c[2])},${a < 0 ? 0 : a.toFixed(3)})`);
export const toHex = (c) => `#${[c[0], c[1], c[2]].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
