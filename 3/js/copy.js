// data/copy.json 읽기. 모든 화면 문구는 여기서 온다.
import { hashStr } from './dates.js';
let C = null;
export async function loadCopy() {
  const r = await fetch('data/copy.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('copy ' + r.status);
  C = await r.json();
  return C;
}
export const copy = () => C;
export function fmt(s, vars = {}) { return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')); }
export function pick(list, seed) { if (!list || !list.length) return ''; return list[hashStr(String(seed)) % list.length]; }
