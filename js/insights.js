// 이달의 돌아보기: 마음 흐름 · 요일별 하늘 · 자주 느낀 마음 · 좋았던 날의 한 줄
// 색만으로 날씨를 구별하지 않는다(파스텔 6색은 색맹 구별 검사를 통과하지 못함) → 점마다 날씨 아이콘, 글은 잉크색.
import { W, FEEL_LABEL } from './weather.js';
import { josa } from './forecast-text.js';
import { icon } from './icons.js';
import * as D from './dates.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DOW_MON = [1, 2, 3, 4, 5, 6, 0]; // 월요일부터
const avg = (arr) => arr.reduce((s, x) => s + x, 0) / arr.length;

/** 이달 기록 목록 [{k, d, e}] (미래 제외, 날짜순) */
export function monthList(month, entries, todayK) {
  const prefix = `${month.getFullYear()}-${D.pad(month.getMonth() + 1)}-`;
  return Object.entries(entries)
    .filter(([k]) => k.startsWith(prefix) && k <= todayK)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, e]) => ({ k, d: D.parseKey(k), e }));
}

function card(title, body, { cls = '', sub = '' } = {}) {
  return `<section class="ins-card ${cls}"><div class="ins-head"><h3>${title}</h3>${sub ? `<span>${sub}</span>` : ''}</div>${body}</section>`;
}

// ---------------------------------------------------------------- 1. 마음 흐름 (선 하나 · 점 하나 색, 세로축은 날씨 아이콘)
// 이 그림의 일은 '마음의 높낮이가 어떻게 흘렀나'다. 날씨 구별은 세로 위치(위일수록 맑음)와 세로축 아이콘이 맡고, 점을 누르면 그날을 연다.
const TICKS = [[5, 'rainbow'], [4, 'sunny'], [3, 'cloudy'], [2, 'rain'], [1, 'thunder']];
function bandLine(mean) {
  if (mean >= 4.2) return '맑은 날이 많았던 달이에요.';
  if (mean >= 3.5) return '대체로 맑은 편이었어요.';
  if (mean >= 2.8) return '맑음과 구름 사이를 오갔어요.';
  if (mean >= 2) return '구름과 비가 잦았어요. 토닥토닥.';
  return '힘든 날이 많았죠. 잘 버텨 줘서 고마워요.';
}
function flowCard(list, month, endDay) {
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const VW = 320;
  const VH = 164;
  const L = 34;
  const R = 10;
  const T = 12;
  const B = 24;
  const step = (VW - L - R) / Math.max(1, last - 1);
  const xOf = (day) => L + (day - 1) * step;
  const yOf = (s) => T + ((5 - s) / 4) * (VH - T - B);
  const strip = (svg) => svg.replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const grid = TICKS.map(([sc, w]) => `<line x1="${L - 4}" x2="${VW - R}" y1="${yOf(sc)}" y2="${yOf(sc)}" class="ins-grid"/>
    <svg x="4" y="${(yOf(sc) - 10).toFixed(1)}" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">${strip(icon(w))}</svg>`).join('');
  // 이어진 날끼리만 선으로 잇는다(빈 날을 건너뛰어 잇지 않음)
  let path = '';
  let prev = null;
  for (const it of list) {
    const day = it.d.getDate();
    const x = xOf(day).toFixed(1);
    const y = yOf(W[it.e.w].score).toFixed(1);
    path += prev != null && day - prev === 1 ? `L${x} ${y}` : `M${x} ${y}`;
    prev = day;
  }
  const hits = list.map((it) => {
    const x = xOf(it.d.getDate());
    return `<rect class="ins-hit" data-date="${it.k}" x="${(x - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${VH - B + 6}"><title>${D.fmtMD(it.d)} ${W[it.e.w].name}</title></rect>`;
  }).join('');
  const dots = list.map((it) => `<circle class="ins-dot" cx="${xOf(it.d.getDate()).toFixed(1)}" cy="${yOf(W[it.e.w].score).toFixed(1)}" r="4.6"/>`).join('');
  const xlab = [1, Math.round(last / 2), last].map((d) => `<text x="${xOf(d)}" y="${VH - 6}" class="ins-xlab" text-anchor="middle">${d}일</text>`).join('');
  // 한 줄 해석: 달 초반과 요즘(최근 기록 절반)을 비교
  const scores = list.map((it) => W[it.e.w].score);
  const half = Math.floor(scores.length / 2);
  const early = avg(scores.slice(0, half));
  const late = avg(scores.slice(scores.length - half));
  let line;
  if (scores.length >= 4 && late - early >= 0.8) line = '달 초보다 요즘 마음이 맑아지고 있어요.';
  else if (scores.length >= 4 && early - late >= 0.8) line = '요즘 조금 흐려졌어요. 쉬어 가도 괜찮아요.';
  else line = bandLine(avg(scores));
  const sub = endDay < last ? `${endDay}일까지` : '';
  const sr = list.map((it) => `${D.fmtMD(it.d)} ${W[it.e.w].name}`).join(', ');
  return card('마음 흐름', `<p class="ins-say">${line}</p>
    <svg class="ins-flow" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="${esc(`이달의 마음 흐름(위일수록 맑음): ${sr}`)}">${grid}<path d="${path}" class="ins-line"/>${dots}${hits}${xlab}</svg>
    <p class="ins-tip">위로 갈수록 맑은 마음 · 점을 누르면 그날 기록</p>`, { sub });
}

// ---------------------------------------------------------------- 2. 요일별 하늘
function weekdayCard(list) {
  const by = new Map(DOW_MON.map((d) => [d, []]));
  list.forEach((it) => by.get(it.d.getDay()).push(it));
  let best = null;
  const cells = DOW_MON.map((dow) => {
    const arr = by.get(dow);
    if (!arr.length) return `<div class="ins-dow is-empty"><span class="ins-dow__d">${D.DOW[dow]}</span><span class="ins-dow__i"><i></i></span><span class="ins-dow__n">–</span></div>`;
    const counts = {};
    arr.forEach((it) => { counts[it.e.w] = (counts[it.e.w] || 0) + 1; });
    const a = avg(arr.map((it) => W[it.e.w].score));
    // 가장 많은 날씨. 같은 횟수면 그 요일 평균 마음에 가장 가까운 날씨(최근 것이 아니라)
    const maxN = Math.max(...Object.values(counts));
    const top = Object.keys(counts).filter((w) => counts[w] === maxN).sort((p, q) => Math.abs(W[p].score - a) - Math.abs(W[q].score - a))[0];
    if (arr.length >= 2 && (!best || a > best.a)) best = { dow, a, n: arr.length };
    return `<div class="ins-dow" data-weather="${top}"><span class="ins-dow__d">${D.DOW[dow]}</span><span class="ins-dow__i">${icon(top)}</span><span class="ins-dow__n">${arr.length}일</span></div>`;
  }).join('');
  const worst = DOW_MON.map((dow) => ({ dow, arr: by.get(dow) })).filter((x) => x.arr.length >= 2)
    .map((x) => ({ dow: x.dow, a: avg(x.arr.map((it) => W[it.e.w].score)) })).sort((p, q) => p.a - q.a)[0];
  let line = '요일마다 가장 많았던 날씨예요.';
  if (best && worst && best.a - worst.a >= 1) line = `${D.DOW[best.dow]}요일 마음이 가장 맑았어요. ${D.DOW[worst.dow]}요일엔 나를 조금 더 챙겨요.`;
  else if (best) line = `${D.DOW[best.dow]}요일 마음이 가장 맑았어요.`;
  return card('요일별 하늘', `<p class="ins-say">${line}</p><div class="ins-week">${cells}</div>`);
}

// ---------------------------------------------------------------- 3. 자주 느낀 마음
function feelCard(list) {
  const counts = {};
  list.forEach((it) => (it.e.f || []).forEach((id) => { counts[id] = (counts[id] || 0) + 1; }));
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!ranked.length) return '';
  const max = ranked[0][1];
  const rows = ranked.map(([id, n]) => `<li><span class="ins-feel__l">${FEEL_LABEL[id] || id}</span><span class="ins-feel__bar"><i style="width:${Math.max(8, Math.round((n / max) * 100))}%"></i></span><b>${n}번</b></li>`).join('');
  const topLabel = FEEL_LABEL[ranked[0][0]] || '';
  const tie = ranked.length > 1 && ranked[1][1] === ranked[0][1];
  const line = tie ? '여러 마음이 골고루 찾아왔어요.' : `가장 자주 느낀 마음은 '${topLabel}'였어요.`;
  return card('자주 느낀 마음', `<p class="ins-say">${line}</p><ol class="ins-feel">${rows}</ol>`);
}

// ---------------------------------------------------------------- 4. 좋았던 날의 한 줄
function goodCard(list) {
  const good = list.filter((it) => (it.e.w === 'sunny' || it.e.w === 'rainbow') && it.e.m).reverse().slice(0, 3);
  if (!good.length) return '';
  const rows = good.map((it) => `<li><button type="button" class="ins-good" data-date="${it.k}" aria-label="${esc(`${D.fmtMD(it.d)} ${W[it.e.w].name}: ${it.e.m}`)}">
    <span class="ins-good__i">${icon(it.e.w)}</span><span class="ins-good__t"><b>${esc(it.e.m)}</b><small>${D.fmtMD(it.d)} ${D.DOW[it.d.getDay()]}요일</small></span></button></li>`).join('');
  return card('좋았던 날의 한 줄', `<ul class="ins-goods">${rows}</ul>`, { sub: '다시 꺼내 보기' });
}

// ---------------------------------------------------------------- 5. 작은 발견 (지금까지의 메모에서)
// 같은 말을 쓴 날이 2번 이상이고 그날들의 날씨가 한쪽(좋음/힘듦)으로 모이면 알려 준다. "왜 기록하지?"에 대한 답.
const PARTICLES = ['에서', '에게', '한테', '으로', '하고', '이랑', '까지', '부터', '처럼', '보다', '은', '는', '이', '가', '을', '를', '에', '도', '만', '와', '과', '랑', '로', '의'];
const WAS = { sunny: '맑았어요', rainbow: '무지개가 떴어요', cloudy: '흐렸어요', snow: '눈이 왔어요', rain: '비가 왔어요', thunder: '천둥이 쳤어요' };
const STOP = new Set(['오늘', '진짜', '너무', '그냥', '정말', '하루', '했다', '있다', '없다', '같다', '좋다', '기분', '많이', '조금', '계속', '다시', '그래도', '근데', '이제', '내일', '어제', '나는', '내가', '우리', '그리고', '하는', '해서', '했는데']);
const VERB_ENDS = ['했는데', '했다', '했어', '했음', '했던', '해서', '하기', '하고', '하는', '함'];
const GOOD_W = new Set(['sunny', 'rainbow']);
const BAD_W = new Set(['rain', 'thunder']);
export function tokensOf(m) {
  return String(m).split(/[\s,.!?~…·'"“”‘’()[\]{}\/:;+=-]+/).map((t) => {
    for (const p of PARTICLES) if (t.length >= p.length + 2 && t.endsWith(p)) return t.slice(0, -p.length);
    return t;
  }).map((t) => {
    // '산책했다'·'산책하고' → '산책' (흔한 끝말만 떼어 낸다)
    for (const v of VERB_ENDS) if (t.length >= v.length + 2 && t.endsWith(v)) return t.slice(0, -v.length);
    return t;
  }).filter((t) => t.length >= 2 && /[가-힣A-Za-z]/.test(t) && !STOP.has(t));
}
export function discoveries(entries) {
  const by = new Map();
  for (const [k, e] of Object.entries(entries)) {
    if (!e.m) continue;
    for (const t of new Set(tokensOf(e.m))) {
      if (!by.has(t)) by.set(t, []);
      by.get(t).push({ k, w: e.w });
    }
  }
  const found = [];
  for (const [t, days] of by) {
    if (days.length < 2) continue;
    const ws = days.map((d) => d.w);
    const same = ws.every((w) => w === ws[0]);
    const say = `'${t}'${josa(t, '이라고', '라고')} 쓴 날은 ${days.length}번`;
    let line = null;
    let tone = '';
    if (same) {
      line = `${say} 모두 ${WAS[ws[0]]}`;
      tone = GOOD_W.has(ws[0]) ? 'good' : BAD_W.has(ws[0]) ? 'bad' : 'mid';
    } else if (ws.every((w) => GOOD_W.has(w))) { line = `${say} 모두 맑거나 무지개였어요`; tone = 'good'; }
    else if (ws.every((w) => BAD_W.has(w))) { line = `${say} 모두 비나 천둥이었어요`; tone = 'bad'; }
    if (line) found.push({ t, n: days.length, line, tone, last: days.map((d) => d.k).sort().pop() });
  }
  found.sort((a, b) => b.n - a.n || (a.last < b.last ? 1 : -1));
  // 좋은 쪽 하나, 힘든 쪽 하나를 먼저 (둘 다 없으면 많이 나온 순)
  const pick = [];
  const g = found.find((f) => f.tone === 'good');
  const b = found.find((f) => f.tone === 'bad');
  if (g) pick.push(g);
  if (b) pick.push(b);
  for (const f of found) if (pick.length < 2 && !pick.includes(f)) pick.push(f);
  return pick;
}
function discoveryCard(entries) {
  const ds = discoveries(entries);
  if (!ds.length) {
    const memos = Object.values(entries).filter((e) => e.m).length;
    if (!memos) return '';
    return card('작은 발견', `<p class="ins-say ins-say--wait">한 줄 메모에 같은 말을 두 번 넘게 쓰면, 그날들의 공통점을 찾아 알려 드릴게요. 예: '산책'이라고 쓴 날은 모두 맑았어요.</p>`, { cls: 'ins-card--wait', sub: '준비 중' });
  }
  const tip = ds.some((d) => d.tone === 'bad') ? '힘든 날의 공통점을 알면 미리 나를 챙길 수 있어요.' : '좋은 날의 공통점, 자주 만들어 봐요.';
  return card('작은 발견', `<ul class="ins-finds">${ds.map((d) => `<li class="ins-find ins-find--${d.tone}">${d.line}</li>`).join('')}</ul><p class="ins-tip ins-tip--left">${tip}</p>`, { sub: '지금까지의 메모에서' });
}

export function renderInsights(box, { month, entries, todayK }) {
  const list = monthList(month, entries, todayK);
  const isNow = todayK.startsWith(`${month.getFullYear()}-${D.pad(month.getMonth() + 1)}-`);
  const endDay = isNow ? Number(todayK.slice(8)) : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  if (!list.length) { box.innerHTML = ''; return; }
  const parts = [];
  if (list.length >= 3) parts.push(flowCard(list, month, endDay));
  else {
    const left = 3 - list.length;
    parts.push(card('마음 흐름', `<p class="ins-say ins-say--wait">${left}일 더 남기면 이달의 마음 흐름을 그려 드릴게요.</p>`, { cls: 'ins-card--wait' }));
  }
  if (list.length >= 5) parts.push(weekdayCard(list));
  parts.push(feelCard(list));
  parts.push(goodCard(list));
  parts.push(discoveryCard(entries));
  const bad = list.filter((it) => it.e.w === 'rain' || it.e.w === 'thunder').length;
  const outro = bad >= 2 ? `<p class="ins-outro">비·천둥 같은 날 ${bad}일도 잘 지나왔어요. 수고했어요.</p>` : '';
  box.innerHTML = `<h3 class="ins-title">${month.getMonth() + 1}월 돌아보기</h3>${parts.join('')}${outro}`;
}

