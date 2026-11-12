// 예시 데이터: 최근 약 9주, 계절에 맞는 분포, 오늘은 비움. 메모리에만 두어 실제 기록과 섞이지 않는다(store.startSample).
import { addDays, dayKey, rng } from './dates.js';
import { tempFor } from './ui/today.js';

const SEASON = {
  winter: { sunny: 30, cloudy: 30, rain: 9, thunder: 2, snow: 14, rainbow: 3 },
  nov: { sunny: 32, cloudy: 32, rain: 14, thunder: 3, snow: 6, rainbow: 4 },
  spring: { sunny: 34, cloudy: 28, rain: 18, thunder: 4, snow: 1, rainbow: 6 },
  summer: { sunny: 28, cloudy: 24, rain: 28, thunder: 10, snow: 0, rainbow: 7 },
  autumn: { sunny: 38, cloudy: 30, rain: 16, thunder: 4, snow: 0, rainbow: 5 },
};
const season = (m) => (m === 11 ? 'nov' : [12, 1, 2].includes(m) ? 'winter' : [3, 4, 5].includes(m) ? 'spring' : [6, 7, 8].includes(m) ? 'summer' : 'autumn');

export function makeSampleDays(today, C) {
  const r = rng(dayKey(today), 'sample'); const memos = (C.extra && C.extra.sample_memos) || [];
  const out = {}; let prev = null, run = 0;
  for (let i = 63; i >= 1; i--) {
    const d = addDays(today, -i), k = dayKey(d);
    if (r() < 0.13) { prev = null; run = 0; continue; }
    const wts = SEASON[season(d.getMonth() + 1)];
    let w = null;
    if (prev && run < 2 && prev !== 'thunder' && prev !== 'rainbow' && r() < 0.28) w = prev;
    else { const tot = Object.values(wts).reduce((a, b) => a + b, 0); let x = r() * tot; for (const [kk, v] of Object.entries(wts)) { x -= v; if (x <= 0) { w = kk; break; } } }
    w = w || 'cloudy'; run = w === prev ? run + 1 : 1; prev = w;
    out[k] = { w, memo: memos.length && r() < 0.62 ? memos[Math.floor(r() * memos.length)] : '', t: tempFor(w, k), at: 1, up: 1 };
  }
  return out;
}
