// 주 분석(월~일): 기록 일수, 대표 날씨, 패턴, 눈에 띄는 날, 다음 주 전망, 재미 지표, 호수, 평균 마음 온도 (product-brief 예보, design-spec §8)
// 문장 고르기는 주 키 시드로 고정한다(같은 자료면 다시 열어도 같은 문장). 메모는 읽지도 쓰지도 않는다.
import { WEATHERS } from './palette.js';
import { dayKey, parseKey, addDays, weekKey, hashStr, pad } from './dates.js';
import { fmt } from './copy.js';
import { tempFor } from './ui/today.js';

// 대표 날씨별 카드 시간대(§8 구도 표)
export const REP_TOD = { sunny: 'day', cloudy: 'dawn', rain: 'night', thunder: 'dusk', snow: 'night', rainbow: 'day' };
// 갬 정도: 앞쪽·뒤쪽 비교로 clearing/worsening을 가른다(궂음 0 ~ 갬 1)
const FAIR = { sunny: 1, rainbow: 1, cloudy: 0.5, snow: 0.2, rain: 0, thunder: 0 };
// 눈에 띄는 날 우선순위: 천둥 > 무지개 > 눈 > 비, 그다음 맑음·구름
const EVENT_ORDER = ['thunder', 'rainbow', 'snow', 'rain', 'sunny', 'cloudy'];
const coin = (...p) => hashStr(p.join('|')) / 4294967296;
const valid = (r) => !!(r && WEATHERS.includes(r.w));
// 문장 고르기: 주 키로 고정하되 주 번호만큼 돌려, 같은 종류 문장이 이어진 두 주에 똑같이 나오지 않게 한다
const weekNo = (wk) => Math.round(parseKey(wk).getTime() / 6048e5);
const pickW = (list, wk, seed) => (list && list.length ? list[(hashStr(seed) + weekNo(wk)) % list.length] : '');

// 그 주 카드가 발행되는 시각: 일요일 18시(기기 현지 시각)
export function pubTime(wk) { const m = parseKey(wk); return new Date(m.getFullYear(), m.getMonth(), m.getDate() + 6, 18, 0, 0, 0); }
// 지금 기준으로 가장 최근에 발행된(또는 발행될 차례였던) 주의 키
export function latestPubKey(nowD) { const wk = weekKey(nowD); return nowD >= pubTime(wk) ? wk : dayKey(addDays(parseKey(wk), -7)); }
export function hasRecords(wk, days, nowD) {
  const m = parseKey(wk), tk = dayKey(nowD);
  for (let i = 0; i < 7; i++) { const k = dayKey(addDays(m, i)); if (k <= tk && valid(days[k])) return true; }
  return false;
}

// 기록이 1건 이상인 주 목록(오래된 것부터). 발행 전이면 status 'progress'.
export function cardList(days, nowD) {
  const tk = dayKey(nowD); const set = new Set();
  for (const [k, r] of Object.entries(days || {})) if (valid(r) && k <= tk) set.add(weekKey(parseKey(k)));
  return [...set].sort().map((key) => ({ key, status: nowD >= pubTime(key) ? 'published' : 'progress' }));
}

export function analyze(wk, days, C, nowD, list) {
  const F = C.forecast, mon = parseKey(wk), tk = dayKey(nowD), sun = addDays(mon, 6);
  const status = nowD >= pubTime(wk) ? 'published' : 'progress';
  const cells = Array.from({ length: 7 }, (_, i) => {
    const k = dayKey(addDays(mon, i)); const r = k <= tk ? days[k] : null; const w = valid(r) ? r.w : null;
    return { i, k, w, t: w ? (Number.isFinite(r.t) ? Math.round(r.t) : tempFor(w, k)) : null, future: k > tk };
  });
  const rec = cells.filter((c) => c.w); const count = rec.length;
  const elapsed = cells.filter((c) => !c.future).length, missing = elapsed - count;
  const cnt = {}, last = {};
  for (const c of rec) { cnt[c.w] = (cnt[c.w] || 0) + 1; last[c.w] = c.i; }
  // 대표 날씨: 최다, 동률이면 가장 최근에 나온 날씨
  const rep = count ? Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || last[b] - last[a])[0] : null;
  // 패턴: 대표 5일 이상 steady(작성 중인 주는 지금까지 모두 같으면 steady), 앞쪽 궂고 뒤쪽 갬 clearing, 반대 worsening, 그 외 mixed
  let pattern = 'mixed';
  if (rep && (cnt[rep] >= 5 || (status === 'progress' && cnt[rep] === count))) pattern = 'steady';
  else if (count >= 2) {
    const h = Math.floor(count / 2); const mean = (a) => a.reduce((s, c) => s + FAIR[c.w], 0) / a.length;
    const f = mean(rec.slice(0, h)), b = mean(rec.slice(count - h));
    if (b - f >= 0.45) pattern = 'clearing'; else if (f - b >= 0.45) pattern = 'worsening';
  }
  // 기록 적은 주: 1~2일 few, 3~4일 some. 작성 중인 주는 지난 날 중 빈 날이 있을 때만(월·화에 다 남겼는데 '자주 비었다'고 하지 않게)
  let sparse = count <= 2 ? 'few' : count <= 4 ? 'some' : null;
  if (status === 'progress' && missing < 1) sparse = null;
  // 눈에 띄는 날: 대표와 다르고 그 주에 딱 하루 나온 날씨
  let event = null;
  for (const w of EVENT_ORDER) if (w !== rep && cnt[w] === 1) { const c = rec.find((x) => x.w === w); event = { w, i: c.i, day: C.misc.weekday_names[c.i] }; break; }
  // 캐스터 문장 한 줄(카드 3줄·54자): 기록 적은 주 → sparse, 아니면 패턴 문장, 고른 주(steady·mixed)는 눈에 띄는 날 문장도 쓴다
  let sKind = 'main', list2;
  if (sparse) { sKind = 'sparse'; list2 = F.sparse[sparse]; }
  else if (event && (pattern === 'steady' || pattern === 'mixed') && (event.w === 'thunder' || event.w === 'rainbow' || coin(wk, 'event') < 0.5)) { sKind = 'event'; list2 = F.event[event.w]; }
  else list2 = F.main[rep][pattern];
  const sentence = fmt(pickW(list2, wk, `${sKind}|${sKind === 'event' ? event.w : rep}|${sparse || pattern}`), { day: event ? event.day : '' });
  // 다음 주 전망: 최근 4주(이 주 포함) 중 3주 이상 자료가 있고 같은 요일에 같은 날씨가 2번 이상이면 next_pattern
  let next = null, nKind = 'rep';
  const weeks = [0, 1, 2, 3].map((j) => addDays(mon, -7 * j));
  const withData = weeks.filter((m) => [0, 1, 2, 3, 4, 5, 6].some((i) => { const k = dayKey(addDays(m, i)); return k <= tk && valid(days[k]); })).length;
  if (withData >= 3) {
    let best = null;
    for (let i = 0; i < 7; i++) {
      const tally = {}, here = {};
      weeks.forEach((m, j) => { const k = dayKey(addDays(m, i)); if (k > tk || !valid(days[k])) return; const w = days[k].w; tally[w] = (tally[w] || 0) + 1; if (j === 0) here[w] = 1; });
      for (const [w, n] of Object.entries(tally)) if (n >= 2) { const sc = n * 10 + (here[w] ? 5 : 0) - i * 0.01; if (!best || sc > best.sc) best = { w, i, sc }; }
    }
    if (best) { nKind = 'pattern'; next = fmt(F.next_pattern[best.w], { day: C.misc.weekday_names[best.i] }); }
  }
  if (!next) {
    if (!rep || sparse === 'few') { nKind = 'unknown'; next = pickW(F.next_unknown, wk, 'next|unknown'); }
    else next = pickW(F.next[rep], wk, `next|${rep}`);
  }
  // 재미 지표 1줄: 대표 날씨에 맞는 것(비는 강수확률·우산 중 주 키 시드로)
  const precip = (cnt.rain || 0) + (cnt.thunder || 0) + (cnt.snow || 0);
  const pct = count ? Math.round((precip / count) * 10) * 10 : 0;
  let statKey;
  if (rep === 'sunny') statKey = 'sunny_days';
  else if (rep === 'cloudy') statKey = 'cloudy_days';
  else if (rep === 'rain') statKey = coin(wk, 'stat') < 0.5 ? 'rain_prob' : 'umbrella_days';
  else if (rep === 'thunder') statKey = 'lightning';
  else if (rep === 'snow') statKey = 'snow_days';
  else statKey = 'rainbow_days';
  const statN = { sunny_days: cnt.sunny, cloudy_days: cnt.cloudy, umbrella_days: cnt.rain, lightning: cnt.thunder, snow_days: cnt.snow, rainbow_days: cnt.rainbow }[statKey] || 0;
  const stat = fmt(F.stats[statKey], { n: statN, p: pct });
  // 호수: 첫 기록 주부터, 기록이 있는 주만 센다(빈 주로 번호가 건너뛰어 '끊김'이 보이지 않게)
  const all = list || cardList(days, nowD); const issue = Math.max(1, all.findIndex((x) => x.key === wk) + 1);
  const avgT = count ? Math.round(rec.reduce((s, c) => s + c.t, 0) / count) : null;
  const period = fmt(C.extra.period_format, { m1: pad(mon.getMonth() + 1), d1: pad(mon.getDate()), m2: pad(sun.getMonth() + 1), d2: pad(sun.getDate()) });
  return {
    key: wk, cells, count, elapsed, missing, cnt, rep, tod: REP_TOD[rep] || 'day', pattern, sparse, event, sKind, sentence, next, nKind, statKey, stat, pct,
    issue, issueText: fmt(F.issue, { n: issue }), avgT, status, period,
    fileName: `${C.app.name}_${wk}_${dayKey(sun)}.png`,
  };
}
// 같은 그림이면 같은 서명(다시 그릴지 판단)
export function cardSig(an) { return [an.key, an.status, an.cells.map((c) => `${c.w || '-'}${c.t ?? ''}${c.future ? 'f' : ''}`).join(','), an.sentence, an.next, an.stat, an.issue].join('|'); }
