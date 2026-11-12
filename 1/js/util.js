// 공용 도구: 수학, 난수, 한국어 조사, 날짜(항상 사용자의 현지 날짜 기준)

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

// 받침에 맞춰 조사를 붙인다. josa('맑음', '이/가') → '맑음이'
export function josa(word, pair) {
  const code = word.charCodeAt(word.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const final = isHangul ? (code - 0xac00) % 28 : 0;
  const [withFinal, withoutFinal] = pair.split('/');
  if (pair === '으로/로') return word + (final && final !== 8 ? withFinal : withoutFinal);
  return word + (final ? withFinal : withoutFinal);
}

export const pad = (n) => String(n).padStart(2, '0');

// toISOString은 UTC라서 한국 시간 오전에 날짜가 하루 밀린다. 날짜 키는 반드시 현지 값으로 만든다.
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
export const todayKey = () => keyOf(new Date());
export const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
export const mondayOf = (k) => addDays(k, -((parseKey(k).getDay() + 6) % 7));
export const isValidKey = (k) => {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
  return keyOf(parseKey(k)) === k;
};

export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const dowOf = (k) => DOW[parseKey(k).getDay()];

export function formatDate(k) {
  const d = parseKey(k);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function formatDateLong(k) {
  return `${formatDate(k)} ${dowOf(k)}요일`;
}

export const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function haptic(pattern = 10) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* 진동을 지원하지 않는 기기 */
  }
}
