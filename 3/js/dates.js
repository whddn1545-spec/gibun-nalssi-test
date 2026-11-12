// 날짜: 기기 현지 날짜 키 'YYYY-MM-DD'. toISOString은 쓰지 않는다.
import { qaParam } from './qa.js';
let offset = 0;
const fake = qaParam('now'); // 가짜 현재 시각은 시험 서버(--qa)에서만

if (fake) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(fake);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0, 0);
    if (!isNaN(d)) offset = d.getTime() - Date.now();
  }
}

export function now() { return new Date(Date.now() + offset); }
export const pad = (n) => String(n).padStart(2, '0');
export function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
export function monIndex(d) { return (d.getDay() + 6) % 7; }
export function mondayOf(d) { return addDays(d, -monIndex(d)); }
export function weekKey(d) { return dayKey(mondayOf(d)); }
export function weekDays(d) { const m = mondayOf(d); return Array.from({ length: 7 }, (_, i) => addDays(m, i)); }
// 지난달 같은 날(없는 날이면 null)
export function sameDayLastMonth(d) {
  const x = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
  return x.getDate() === d.getDate() ? x : null;
}
// 달력 격자(일요일 시작). 4b에서 쓴다.
export function monthGrid(y, m) {
  const first = new Date(y, m, 1);
  const start = addDays(first, -first.getDay());
  const days = new Date(y, m + 1, 0).getDate();
  const rows = Math.ceil((first.getDay() + days) / 7);
  return Array.from({ length: rows * 7 }, (_, i) => addDays(start, i));
}
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rng(...parts) { return mulberry32(hashStr(parts.join('|'))); }
