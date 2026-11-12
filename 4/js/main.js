// 기분날씨 — 앱 시작과 화면 연결
import * as store from './store.js';
import { WEATHERS, W, INIT_LINE, INIT_PH, againLine, ro } from './weather.js';
import * as D from './dates.js';
import { icon, TONE } from './icons.js';
import { sceneSVG, friendSVG } from './art.js';
import { createScene } from './scene.js';
import { $, $$, toast, hideToast, haptic, createSheet, downloadBlob, reducedMotion } from './ui.js';
import { summarize, josa } from './forecast-text.js';
import { renderCardBlob } from './card.js';
import * as install from './install.js';

store.load();

const app = {
  todayK: D.todayKey(),
  tab: 'today',
  calMonth: new Date(D.today().getFullYear(), D.today().getMonth(), 1),
  fcMonday: D.mondayOf(D.today()),
  sheetKey: null,
  sheetEditing: false,
  sheetUndo: null, // 시트에서 처음 바꾸기 전 기록 (되돌리기용)
  memoDraft: null, // 오늘 메모칸에 쓰다 만 글 (탭을 오가도 지키기)
};

if (install.isStandalone()) document.documentElement.classList.add('standalone');
if (install.isIOS()) document.documentElement.classList.add('ios');
const phaseNow = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : 'night';
};
document.body.dataset.phase = phaseNow();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (s, n) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n).join('')}…` : s);
const toneStyle = (w) => (w && TONE[w] ? `--tint:${TONE[w].tint};--deep:${TONE[w].deep};--glow:${TONE[w].glow}` : '');
const THEME = { initial: '#FFF6EC', sunny: '#FFF7E6', rainbow: '#FFF5F1', cloudy: '#FAF5F0', snow: '#F8F6FC', rain: '#F4F4F8', thunder: '#F6F1F8' };
const setTheme = (w) => document.querySelector('meta[name="theme-color"]').setAttribute('content', THEME[w || 'initial']);

/** 알림: 시트가 열려 있으면 화면 위, 오늘 화면이면 날짜 줄 아래, 아니면 탭바 위 */
function notify(msg, opts = {}) {
  const sheetOpen = document.documentElement.classList.contains('has-sheet');
  toast(msg, { ...opts, place: !sheetOpen && app.tab === 'today' ? 'today' : 'top' });
}

// ================================================================ 날씨 고르기 버튼
function pickerHTML(selected) {
  return WEATHERS.map((w, i) => `
    <button type="button" class="wbtn" data-weather="${w.id}" aria-pressed="${selected === w.id}"
      aria-label="${w.name}, ${w.mood}" style="--i:${i};${toneStyle(w.id)}">
      <span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5.5 12.5l4 4 9-9.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      ${icon(w.id)}
      <span class="wname">${w.name}</span><span class="wmood">${w.mood}</span>
    </button>`).join('');
}
const markPicker = (root, selected) =>
  $$('.wbtn', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.weather === selected)));

// ================================================================ 몽글이 대사
let typeT = 0;
function say(text, { instant = false } = {}) {
  const ghost = $('#talk-ghost');
  const live = $('#talk-live');
  const talk = $('#talk');
  clearInterval(typeT);
  ghost.textContent = text;
  $('#talk-sr').textContent = `몽글이: ${text}`;
  if (instant || reducedMotion() || app.tab !== 'today') {
    live.textContent = text;
    return;
  }
  const chars = Array.from(text);
  let i = 0;
  live.textContent = '';
  talk.classList.remove('bump');
  void talk.offsetWidth;
  talk.classList.add('bump');
  typeT = setInterval(() => {
    live.textContent = chars.slice(0, ++i).join('');
    if (i >= chars.length) clearInterval(typeT);
  }, 34);
}

// ================================================================ 오늘
const scene = createScene($('#sky'), {
  label: (w) => (w ? `내 작은 하늘: ${W[w].name}, ${W[w].mood}` : '내 작은 하늘: 아직 고르지 않았어요'),
});

function renderToday({ talk = false } = {}) {
  const e = store.getEntry(app.todayK);
  $('#today-date').textContent = D.fmtFull(D.parseKey(app.todayK));
  markPicker($('#today-picker'), e?.w);
  $('#today-picker').classList.toggle('is-first', store.count() === 0);
  const memo = $('#memo-input');
  if (document.activeElement !== memo) memo.value = app.memoDraft ?? (e?.m || '');
  memo.placeholder = e ? W[e.w].ph : INIT_PH;
  updateMemoUI();
  renderSaved();
  renderLetter();
  renderGreeting(e?.w || null);
  renderInstallNudge();
  setTheme(e?.w);
  if (talk) say(todayLine(), { instant: true });
}

const ASK = '오늘 <span class="hl">마음 하늘</span>은<br>어떤 날씨예요?';
let greetFor;
/** 제목: 고르기 전엔 질문, 고른 뒤엔 답 (예: 오늘 마음 하늘은 / 무지개예요) */
function renderGreeting(w, { animate = false } = {}) {
  const el = $('#today-greeting');
  if (greetFor === w && !animate) return;
  greetFor = w;
  if (!w) { el.innerHTML = ASK; return; }
  const name = W[w].name;
  el.innerHTML = `오늘 <span class="hl">마음 하늘</span>은<br><span class="ans"${animate ? '' : ' style="animation:none"'}><b>${name}</b>${josa(name, '이에요', '예요')}</span>`;
}

function todayLine() {
  const e = store.getEntry(app.todayK);
  if (!$('#weekly-banner').hidden && !e) return '지난주 일기예보가 도착했어요! 편지를 눌러 봐요';
  if (!e) return INIT_LINE;
  if (e.m) return `‘${short(e.m, 13)}’ 잘 간직하고 있어요`;
  return againLine(e.w, app.todayK);
}

function renderSaved() {
  const e = store.getEntry(app.todayK);
  $('#saved').classList.toggle('on', !!e);
  const n = e ? store.streak(app.todayK, D.keyOf, D.addDays, D.parseKey) : 0;
  $('#saved-text').textContent = n >= 2 ? `연속 ${n}일째` : '저장됨';
}

function pickToday(w) {
  const prev = store.getEntry(app.todayK);
  haptic(10);
  if (prev && prev.w === w) {
    scene.react();
    notify(`오늘은 ${W[w].name} · ${W[w].mood}`);
    return;
  }
  const first = store.count() === 0;
  const typed = store.cleanMemo($('#memo-input').value);
  // 메모칸에 저장 안 한 글이 있으면 날씨와 함께 저장 (처음 기록이든 다시 고르든 똑같이)
  const withMemo = !!typed && typed !== (prev?.m || '');
  const ok = store.setEntry(app.todayK, withMemo || !prev ? { w, m: typed || (prev?.m ?? '') } : { w });
  if (!ok) {
    markPicker($('#today-picker'), prev?.w);
    notify('저장 공간이 부족해 기록을 저장하지 못했어요. 설정에서 백업해 주세요', { tone: 'warn', duration: 4500 });
    return;
  }
  scene.set(w);
  markPicker($('#today-picker'), w);
  $('#today-picker').classList.remove('is-first');
  say(W[w].line);
  $('#memo-input').placeholder = W[w].ph;
  updateMemoUI();
  renderSaved();
  const saved = $('#saved');
  saved.classList.remove('bump');
  void saved.offsetWidth;
  saved.classList.add('bump');
  setTheme(w);
  renderGreeting(w, { animate: true });
  if (withMemo) {
    app.memoDraft = null;
    $('#memo-input').value = typed;
    updateMemoUI();
    notify('한 줄 메모도 함께 남겼어요');
  }
  if (first) {
    store.requestPersistence();
    setTimeout(() => {
      if (app.tab !== 'today') return;
      say('첫 날씨를 남겼어요! 내일도 하늘 보러 와요');
      confetti($('#sky'));
    }, 1600);
  }
  if (!prev && !first) celebrateStreak();
  setTimeout(renderInstallNudge, 2600);
}

$('#today-picker').innerHTML = pickerHTML(store.getEntry(app.todayK)?.w);
$('#today-picker').addEventListener('click', (e) => {
  const b = e.target.closest('[data-weather]');
  if (b) pickToday(b.dataset.weather);
});

// 연속 기록 축하 (3·7·14일…)
const MILESTONES = [3, 7, 14, 21, 30, 50, 100, 200, 365];
function celebrateStreak() {
  const n = store.streak(app.todayK, D.keyOf, D.addDays, D.parseKey);
  if (!MILESTONES.includes(n)) return;
  setTimeout(() => {
    if (app.tab !== 'today') return;
    say(n >= 30 ? `${n}일 연속이라니! 몽글이가 정말 감동했어요` : `와, ${n}일 연속 기록이에요! 매일 와 줘서 고마워요`);
    const chip = $('#saved');
    chip.classList.remove('is-party');
    void chip.offsetWidth;
    chip.classList.add('is-party');
    confetti($('#sky'));
  }, 1700);
}

/** 색종이 터뜨리기 */
function confetti(host) {
  if (reducedMotion() || !host) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  box.setAttribute('aria-hidden', 'true');
  const cols = ['#FF97A5', '#FFC94F', '#9ADDB2', '#8EC7F2', '#BDA6F1', '#FF8B6D'];
  for (let i = 0; i < 22; i++) {
    const a = (Math.PI * 2 * i) / 22 + Math.random() * 0.3;
    const r = 80 + Math.random() * 90;
    const piece = document.createElement('i');
    piece.style.cssText = `background:${cols[i % cols.length]};--x:${(Math.cos(a) * r).toFixed(1)}px;--y:${(Math.sin(a) * r - 40).toFixed(1)}px;--r:${Math.round(Math.random() * 540 - 270)}deg;--d:${(Math.random() * 0.12).toFixed(2)}s`;
    box.appendChild(piece);
  }
  host.appendChild(box);
  setTimeout(() => box.remove(), 1600);
}

function updateMemoUI() {
  const input = $('#memo-input');
  const e = store.getEntry(app.todayK);
  const raw = input.value;
  const v = store.cleanMemo(raw);
  const savedMemo = e?.m || '';
  const btn = $('#memo-save');
  const same = v === savedMemo;
  btn.disabled = same;
  btn.dataset.state = same && v ? 'saved' : '';
  btn.querySelector('[data-label]').textContent = same && v ? '저장됨' : !v && savedMemo ? '지우기' : '남기기';
  // 입력칸의 40자 제한과 같은 기준으로 센다(이모지는 2칸)
  $('#memo-count').textContent = `${raw.length}/${store.MEMO_MAX}`;
  input.closest('.memo-field').classList.toggle('typing', raw.length > 0 && !same);
}

$('#memo-input').addEventListener('input', () => {
  const v = $('#memo-input').value;
  app.memoDraft = store.cleanMemo(v) === (store.getEntry(app.todayK)?.m || '') ? null : v;
  updateMemoUI();
});
$('#memo-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const input = $('#memo-input');
  const v = store.cleanMemo(input.value);
  const cur = store.getEntry(app.todayK);
  if (!cur) {
    notify('먼저 오늘의 날씨를 골라 주세요', { tone: 'warn' });
    say('위에서 오늘 마음 날씨부터 골라 줄래요? 메모는 그대로 둘게요');
    const p = $('#today-picker');
    p.classList.remove('is-nudge');
    void p.offsetWidth;
    p.classList.add('is-nudge');
    return;
  }
  if (v === (cur.m || '')) return;
  const ok = store.setEntry(app.todayK, { m: v });
  if (!ok) {
    notify('저장 공간이 부족해 메모를 저장하지 못했어요', { tone: 'warn' });
    return;
  }
  input.value = v;
  app.memoDraft = null;
  input.blur();
  updateMemoUI();
  // 알림 대신 버튼('저장됨')과 몽글이 말로 알려 준다 (제목을 가리지 않게)
  say(v ? '소중한 한 줄, 잘 간직할게요' : '메모는 지웠어요. 날씨는 그대로예요');
  scene.react();
});

// 키보드가 떠 있는 동안만 아래 탭바를 숨긴다 (키보드 위에 뜨지 않게).
// '뒤로'로 키보드만 닫고 입력칸에 포커스가 남아도 화면 높이가 돌아오면 탭바도 돌아온다.
let fullH = window.innerHeight;
const isTextFocused = () => !!(document.activeElement && document.activeElement.matches && document.activeElement.matches('input[type="text"]'));
function syncKeyboard() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  if (!isTextFocused()) fullH = Math.max(window.innerHeight, h);
  const open = isTextFocused() && (vv ? h < fullH - 120 : true);
  document.documentElement.classList.toggle('is-typing', open);
}
document.addEventListener('focusin', () => setTimeout(syncKeyboard, 250));
document.addEventListener('focusout', () => setTimeout(syncKeyboard, 50));
if (window.visualViewport) window.visualViewport.addEventListener('resize', syncKeyboard);
window.addEventListener('orientationchange', () => setTimeout(() => { fullH = window.innerHeight; syncKeyboard(); }, 400));

// ================================================================ 지난주 예보 도착 (편지)
function lastWeekInfo() {
  const thisMon = D.mondayOf(D.parseKey(app.todayK));
  const lastMon = D.addDays(thisMon, -7);
  const n = D.weekKeys(lastMon).filter((k) => store.getEntry(k)).length;
  return { lastMon, lastKey: D.keyOf(lastMon), n };
}

function renderLetter() {
  const { lastKey, n } = lastWeekInfo();
  $('#weekly-banner').hidden = !(n > 0 && store.getMeta('seenWeek') !== lastKey);
}

$('#weekly-banner').addEventListener('click', () => {
  const letter = $('#weekly-banner');
  if (letter.classList.contains('is-opening')) return;
  const { lastMon, lastKey } = lastWeekInfo();
  store.setMeta('seenWeek', lastKey);
  app.fcMonday = lastMon;
  haptic(12);
  const go = () => {
    letter.classList.remove('is-opening');
    showTab('forecast');
    renderLetter();
    const card = $('#forecast-card');
    if (!reducedMotion()) {
      card.classList.remove('is-arriving');
      void card.offsetWidth;
      card.classList.add('is-arriving');
      card.addEventListener('animationend', (ev) => { if (ev.target === card) card.classList.remove('is-arriving'); });
      setTimeout(() => confetti(card), 380);
    }
  };
  if (reducedMotion()) { go(); return; }
  letter.classList.add('is-opening');
  setTimeout(go, 380);
});

// ================================================================ 홈 화면에 추가 권유 (첫 기록 뒤, 7일에 한 번)
function renderInstallNudge() {
  const el = $('#install-nudge');
  const last = store.getMeta('installNudgeAt');
  const quiet = last && (D.parseKey(app.todayK) - D.parseKey(last)) / 86400000 < 7;
  const possible = install.canPrompt() || install.isIOS() || !!install.inAppBrowser();
  el.hidden = install.isStandalone() || store.count() < 1 || !$('#weekly-banner').hidden || quiet || !possible || !!store.getMeta('installed');
}
install.onInstallChange(renderInstallNudge);
$('#install-nudge').addEventListener('click', async () => {
  store.setMeta('installNudgeAt', app.todayK);
  $('#install-nudge').hidden = true;
  if (install.canPrompt()) {
    const r = await install.promptInstall();
    if (r === 'accepted') {
      store.setMeta('installed', true);
      notify('홈 화면에 몽글이가 생겼어요!');
    }
    return;
  }
  settingsSheet.open();
  showInstallGuide();
});

// ================================================================ 탭
const views = { today: $('[data-view="today"]'), calendar: $('[data-view="calendar"]'), forecast: $('[data-view="forecast"]') };
const ORDER = ['today', 'calendar', 'forecast'];
let ignoreTabPop = false;

function showTab(t, { fromHistory = false } = {}) {
  if (t === app.tab) {
    if (t === 'forecast') renderForecast();
    if (t === 'calendar') renderCalendar();
    views[t].scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    return;
  }
  const from = app.tab;
  const dir = ORDER.indexOf(t) > ORDER.indexOf(from) ? 1 : -1;
  app.tab = t;
  hideToast();
  $$('.tabbar [data-tab]').forEach((b) => {
    const on = b.dataset.tab === t;
    b.setAttribute('aria-selected', String(on));
    b.classList.toggle('is-active', on);
  });
  if (t === 'calendar') renderCalendar();
  if (t === 'forecast') renderForecast();
  if (t === 'today') renderToday();
  const out = views[from];
  const inn = views[t];
  inn.style.setProperty('--dir', dir);
  out.style.setProperty('--dir', dir);
  inn.classList.remove('is-leaving', 'is-active');
  inn.hidden = false;
  inn.scrollTop = 0;
  void inn.offsetWidth;
  inn.classList.add('is-active');
  out.classList.remove('is-active');
  out.classList.add('is-leaving');
  setTimeout(() => {
    if (app.tab !== from) out.hidden = true;
    out.classList.remove('is-leaving');
  }, reducedMotion() ? 220 : 420);
  scene.setActive(t === 'today');
  if (!fromHistory) {
    if (from === 'today' && t !== 'today') history.pushState({ tab: t }, '');
    else if (t === 'today' && history.state && history.state.tab) {
      ignoreTabPop = true;
      history.back();
    } else history.replaceState({ tab: t }, '');
  }
}

window.addEventListener('popstate', (e) => {
  if (ignoreTabPop) { ignoreTabPop = false; return; }
  if (document.documentElement.classList.contains('has-sheet')) return;
  if (app.tab !== 'today' && !(e.state && (e.state.tab || e.state.sheet))) showTab('today', { fromHistory: true });
});
$$('.tabbar [data-tab]').forEach((b) => b.addEventListener('click', () => { haptic(5); showTab(b.dataset.tab); }));

// ================================================================ 달력
function renderCalendar({ pop = false } = {}) {
  const m = app.calMonth;
  $('#cal-title').textContent = D.fmtYM(m);
  const tK = app.todayK;
  const firstKey = Object.keys(store.entries()).sort()[0] || tK;
  let k2 = 0;
  const html = D.monthGrid(m.getFullYear(), m.getMonth()).map((d) => {
    const k = D.keyOf(d);
    if (d.getMonth() !== m.getMonth()) return '<div class="cal-cell is-out" aria-hidden="true"></div>';
    const future = k > tK;
    const e = future ? null : store.getEntry(k);
    const cls = ['cal-cell', e ? 'has' : '', k === tK ? 'is-today' : '', !e && k < firstKey ? 'is-before' : '', d.getDay() === 0 ? 'sun' : '', d.getDay() === 6 ? 'sat' : ''].join(' ');
    const label = `${D.fmtFull(d)}${k === tK ? ' 오늘' : ''}${e ? `, ${W[e.w].name} ${W[e.w].mood}${e.m ? `, 메모: ${e.m}` : ''}` : future ? '' : ', 기록 없음'}`;
    return `<button type="button" class="${cls}" data-date="${k}" ${e ? `data-weather="${e.w}" style="${toneStyle(e.w)};--k:${k2++}"` : ''}
      ${future ? 'disabled aria-disabled="true"' : ''} aria-label="${esc(label)}">
      <span class="cal-cell__num">${d.getDate()}</span>
      <span class="cal-cell__icon" aria-hidden="true">${e ? icon(e.w) : ''}</span>
    </button>`;
  }).join('');
  const grid = $('#cal-grid');
  grid.innerHTML = html;
  grid.classList.toggle('is-pop', pop && !reducedMotion());
  const now = D.today();
  $('#cal-next').disabled = m.getFullYear() > now.getFullYear() || (m.getFullYear() === now.getFullYear() && m.getMonth() >= now.getMonth());
  renderMonthStats();
}

function renderMonthStats() {
  const m = app.calMonth;
  const prefix = `${m.getFullYear()}-${D.pad(m.getMonth() + 1)}-`;
  const list = Object.entries(store.entries()).filter(([k]) => k.startsWith(prefix) && k <= app.todayK);
  const box = $('#cal-stats');
  if (!list.length) {
    const isNow = m.getFullYear() === D.today().getFullYear() && m.getMonth() === D.today().getMonth();
    box.innerHTML = `<div class="cal-empty">${friendSVG('initial', 86)}<p><b>${m.getMonth() + 1}월에는 아직 남긴 날씨가 없어요</b>${isNow ? '오늘 날씨를 남기면 여기에 하나씩 쌓여요.' : '지난 날짜를 눌러 그날의 날씨를 남길 수 있어요.'}</p></div>`;
    return;
  }
  const counts = {};
  list.forEach(([, e]) => (counts[e.w] = (counts[e.w] || 0) + 1));
  const present = WEATHERS.filter((w) => counts[w.id]);
  const bar = present.map((w, i) => `<span class="mbar__seg" style="flex:${counts[w.id]};background:${TONE[w.id].deep};animation-delay:${i * 60}ms"></span>`).join('');
  const sorted = [...present].sort((a, b) => counts[b.id] - counts[a.id] || b.score - a.score);
  const chips = sorted.map((w) => `<span class="mchip" style="${toneStyle(w.id)}">${icon(w.id)}${w.name} <b>${counts[w.id]}</b></span>`).join('');
  const top = sorted[0];
  const tie = sorted.length > 1 && counts[sorted[1].id] === counts[top.id];
  const good = top.id === 'sunny' || top.id === 'rainbow';
  let sayLine;
  if (store.count() === 1) sayLine = '첫 기록이에요! 하루하루 쌓아 가요.';
  else if (list.length < 4) sayLine = `${m.getMonth() + 1}월엔 ${list.length}일을 남겼어요. 하루하루 쌓여 가요.`;
  else if (tie) sayLine = `${m.getMonth() + 1}월엔 여러 날씨가 골고루 찾아왔어요. 다채로운 달이네요!`;
  else sayLine = `${m.getMonth() + 1}월엔 ${top.name}${josa(top.name, '이', '가')} 가장 많았어요. ${good ? '좋은 달이네요!' : '토닥토닥, 잘 지나왔어요.'}`;
  box.innerHTML = `<div class="cal-stats__head"><b>${m.getMonth() + 1}월의 하늘</b><span>${list.length}일 기록</span></div>
    <div class="mbar" aria-hidden="true">${bar}</div><div class="mchips">${chips}</div><p class="cal-say">${esc(sayLine)}</p>`;
}

function moveMonth(dir) {
  hideToast();
  app.calMonth = D.addMonths(app.calMonth, dir);
  renderCalendar({ pop: true });
  if (!reducedMotion()) {
    $('#cal-grid').animate([{ opacity: 0, transform: `translateX(${dir * 48}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    $('#cal-title').animate([{ opacity: 0, transform: `translateX(${dir * 24}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}
$('#cal-prev').addEventListener('click', () => moveMonth(-1));
$('#cal-next').addEventListener('click', () => moveMonth(1));
$('#cal-grid').addEventListener('click', (e) => {
  const c = e.target.closest('[data-date]');
  if (!c || c.disabled) return;
  haptic(6);
  openDay(c.dataset.date);
});

// 손가락으로 달 넘기기
(() => {
  const g = $('#cal-swipe');
  let x0 = null;
  let y0 = 0;
  g.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  g.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const btn = dx < 0 ? $('#cal-next') : $('#cal-prev');
      if (!btn.disabled) btn.click();
    }
  }, { passive: true });
})();

// ================================================================ 하루 시트
const daySheet = createSheet($('#day-sheet'), {
  onClose: () => {
    saveSheetMemoOnClose();
    app.sheetKey = null;
    app.sheetUndo = null;
  },
});

function openDay(k) {
  app.sheetKey = k;
  app.sheetEditing = !store.getEntry(k);
  app.sheetUndo = null;
  renderDay();
  daySheet.open();
}

/** 닫을 때, 날씨가 있는 날의 메모칸에 쓰다 만 글이 있으면 저장해 둔다 (말없이 사라지지 않게) */
function saveSheetMemoOnClose() {
  const k = app.sheetKey;
  if (!k || !app.sheetEditing) return;
  const e = store.getEntry(k);
  if (!e) return;
  const v = store.cleanMemo($('#sheet-memo').value);
  if (v === (e.m || '')) return;
  if (store.setEntry(k, { m: v })) {
    notify(`${D.fmtMD(D.parseKey(k))} 메모도 저장했어요`);
    afterChange(k);
  }
}

const sheetPh = (w, k) => (k === app.todayK ? W[w].ph : W[w].ph.replace('오늘', '이날'));

function relDays(k) {
  const diff = Math.round((D.parseKey(app.todayK) - D.parseKey(k)) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff === 2) return '그저께';
  if (diff < 7) return `${diff}일 전`;
  if (diff < 31) return `${Math.round(diff / 7)}주 전`;
  if (diff < 365) return `${Math.floor(diff / 30)}달 전`;
  return `${Math.floor(diff / 365)}년 전`;
}

function renderDay() {
  const k = app.sheetKey;
  if (!k) return;
  const e = store.getEntry(k);
  const editing = app.sheetEditing || !e;
  $('#day-title').textContent = D.fmtFull(D.parseKey(k));
  $('#day-sub').textContent = relDays(k);
  $('#day-view').hidden = editing;
  $('#day-edit').hidden = !editing;
  const del = $('#sheet-delete');
  del.dataset.confirm = '';
  del.querySelector('[data-label]').textContent = '지우기';
  if (!editing) {
    $('#day-hero').innerHTML = sceneSVG(e.w, { ratio: 2 });
    const badge = $('#day-badge');
    badge.setAttribute('style', toneStyle(e.w));
    badge.innerHTML = `${icon(e.w)}<span>${W[e.w].name}</span><small>${W[e.w].mood}</small>`;
    const memo = $('#day-memo');
    memo.textContent = e.m || '메모 없이 날씨만 남긴 날이에요.';
    memo.classList.toggle('is-empty', !e.m);
  } else {
    $('#sheet-picker').innerHTML = pickerHTML(e?.w);
    $('#sheet-memo').value = e?.m || '';
    $('#sheet-memo').placeholder = e ? sheetPh(e.w, k) : '이날을 한 줄로 남겨요';
    const title = e ? '이날의 날씨를 고쳐요' : k === app.todayK ? '오늘의 날씨를 남겨요' : '깜빡한 날의 날씨를 남겨요';
    $('#day-edit-title').innerHTML = `${title}<span class="sheet__hint">누르면 바로 저장돼요</span>`;
    $('#sheet-save').disabled = !e;
    $('#sheet-save').textContent = '남기기';
    $('#sheet-undo').hidden = !(app.sheetUndo && app.sheetUndo.k === k);
  }
}

// 오늘 화면처럼 누르면 바로 저장한다. 바꾼 뒤에는 '되돌리기'로 처음 상태로 돌릴 수 있다.
$('#sheet-picker').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-weather]');
  const k = app.sheetKey;
  if (!b || !k) return;
  const w = b.dataset.weather;
  const prev = store.getEntry(k);
  if (prev && prev.w === w) return;
  const ok = store.setEntry(k, { w, m: store.cleanMemo($('#sheet-memo').value) });
  if (!ok) {
    markPicker($('#sheet-picker'), prev?.w);
    notify('저장 공간이 부족해 저장하지 못했어요', { tone: 'warn' });
    return;
  }
  if (!app.sheetUndo || app.sheetUndo.k !== k) app.sheetUndo = { k, prev: prev ? { ...prev } : null };
  markPicker($('#sheet-picker'), w);
  $('#sheet-memo').placeholder = sheetPh(w, k);
  $('#sheet-save').disabled = false;
  $('#sheet-undo').hidden = false;
  haptic(10);
  notify(`${D.fmtMD(D.parseKey(k))}, ${W[w].name}${ro(W[w].name)} ${prev ? '고쳤어요' : '남겼어요'}`);
  afterChange(k);
});

$('#sheet-undo').addEventListener('click', () => {
  const u = app.sheetUndo;
  const k = app.sheetKey;
  if (!u || u.k !== k) return;
  const ok = u.prev ? store.setEntry(k, { w: u.prev.w, m: u.prev.m }) : store.removeEntry(k);
  if (!ok) {
    notify('되돌리지 못했어요. 다시 시도해 주세요', { tone: 'warn' });
    return;
  }
  app.sheetUndo = null;
  renderDay();
  notify(u.prev ? `${D.fmtMD(D.parseKey(k))} 기록을 처음대로 되돌렸어요` : `${D.fmtMD(D.parseKey(k))} 기록을 남기지 않은 걸로 했어요`);
  afterChange(k);
});

$('#sheet-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const k = app.sheetKey;
  const w = store.getEntry(k)?.w;
  if (!k) return;
  if (!w) {
    notify('먼저 이날의 날씨를 골라 주세요', { tone: 'warn' });
    const p = $('#sheet-picker');
    p.classList.remove('is-nudge');
    void p.offsetWidth;
    p.classList.add('is-nudge');
    return;
  }
  const ok = store.setEntry(k, { w, m: $('#sheet-memo').value });
  if (!ok) {
    notify('저장 공간이 부족해 저장하지 못했어요', { tone: 'warn' });
    return;
  }
  notify(`${D.fmtMD(D.parseKey(k))} 기록을 남겼어요`);
  app.sheetEditing = false;
  app.sheetUndo = null;
  renderDay();
  afterChange(k);
});

$('#sheet-edit').addEventListener('click', () => {
  app.sheetEditing = true;
  renderDay();
});

$('#sheet-delete').addEventListener('click', () => {
  const k = app.sheetKey;
  const b = $('#sheet-delete');
  if (b.dataset.confirm !== '1') {
    b.dataset.confirm = '1';
    b.querySelector('[data-label]').textContent = '한 번 더 누르면 지워져요';
    return;
  }
  if (!store.removeEntry(k)) {
    notify('지우지 못했어요. 다시 시도해 주세요', { tone: 'warn' });
    return;
  }
  daySheet.close();
  notify(`${D.fmtMD(D.parseKey(k))} 기록을 지웠어요`);
  afterChange(k);
});

function afterChange(k) {
  if (app.tab === 'calendar') renderCalendar();
  if (app.tab === 'forecast') renderForecast();
  if (k === app.todayK) {
    const e = store.getEntry(k);
    scene.set(e ? e.w : null, { instant: app.tab !== 'today' });
    renderToday({ talk: true });
  } else renderLetter();
}

// ================================================================ 예보
function weekDays(monday) {
  return D.weekKeys(monday).map((k) => ({ key: k, date: D.parseKey(k), future: k > app.todayK, entry: k > app.todayK ? null : store.getEntry(k) }));
}

function renderForecast() {
  const mon = app.fcMonday;
  const thisMon = D.mondayOf(D.parseKey(app.todayK));
  const isCurrent = D.keyOf(mon) === D.keyOf(thisMon);
  const days = weekDays(mon);
  const s = summarize(days, { isCurrent });
  const sun = D.addDays(mon, 6);
  const weeksAgo = Math.round((thisMon - mon) / 604800000);
  $('#fc-range').textContent = `${D.fmtMD(mon)} – ${mon.getMonth() === sun.getMonth() ? `${sun.getDate()}일` : D.fmtMD(sun)}`;
  $('#fc-week-label').textContent = isCurrent ? '이번 주 · 진행 중' : weeksAgo === 1 ? '지난주 일기예보' : `${weeksAgo}주 전 일기예보`;
  $('#fc-stamp').textContent = isCurrent ? '진행 중' : s.recorded ? '도착' : '기록 없음';
  $('#fc-next-week').disabled = isCurrent;
  $('#fc-hero').innerHTML = sceneSVG(s.top || 'initial', { ratio: 2.2 });
  $('#forecast-card').style.setProperty('--fc-accent', s.top ? TONE[s.top].tint : '#ECE4FF');
  $('#forecast-card').dataset.weather = s.top || '';
  $('#fc-headline').textContent = s.headline;
  $('#fc-summary').textContent = s.detail;
  $('#fc-days').innerHTML = days.map((d) => `
    <div class="fc-day ${d.key === app.todayK ? 'is-today' : ''} ${d.future ? 'is-future' : ''}" data-day="${d.key}" ${d.entry ? `data-weather="${d.entry.w}" style="${toneStyle(d.entry.w)}"` : 'data-empty'}>
      <span class="fc-day__dow">${D.DOW[d.date.getDay()]}</span>
      <span class="fc-day__icon" aria-hidden="true">${d.entry ? icon(d.entry.w) : '<i class="fc-dot"></i>'}</span>
      <span class="fc-day__num">${d.date.getDate()}</span>
      <span class="sr-only">${d.entry ? W[d.entry.w].name : d.future ? '아직 오지 않은 날' : '기록 없음'}</span>
    </div>`).join('');
  $('#fc-index').textContent = s.index == null ? '–' : s.index;
  $('#fc-count').textContent = `${s.recorded}/7`;
  $('#fc-best').textContent = s.best ? s.best.text : '–';
  const next = $('#fc-next');
  if (s.next) {
    next.innerHTML = `<span class="fc-next__icon" aria-hidden="true">${icon(s.next.w)}</span>
      <span class="fc-next__body"><b>다음 주 ${esc(s.next.label)} · 맑음 확률 ${s.next.prob}%</b><span>${esc(s.next.line)}</span></span>`;
  } else {
    next.innerHTML = `<span class="fc-next__icon" aria-hidden="true">${icon('cloudy')}</span><span class="fc-next__body"><b>다음 주 예보 준비 중</b><span>${esc(s.nextText)}</span></span>`;
  }
  const empty = s.recorded === 0;
  $('#fc-save').disabled = empty;
  $('#fc-share').disabled = empty;
  $('#fc-hint').textContent = empty ? '이 주에 날씨를 남기면 카드를 저장할 수 있어요.' : '이미지로 저장하거나 친구에게 바로 보내 보세요.';
  app.fcSummary = { days, s, mon, isCurrent };
  // 지난주 카드를 직접 봤다면 '도착' 편지는 거둔다
  const { lastKey, n } = lastWeekInfo();
  if (D.keyOf(mon) === lastKey && n > 0 && store.getMeta('seenWeek') !== lastKey) {
    store.setMeta('seenWeek', lastKey);
    renderLetter();
  }
}

function moveWeek(dir) {
  hideToast();
  app.fcMonday = D.addDays(app.fcMonday, dir * 7);
  renderForecast();
  if (!reducedMotion()) {
    $('#forecast-card').animate([{ opacity: 0.2, transform: `translateX(${dir * 30}px) rotate(${dir * 1.5}deg)` }, { opacity: 1, transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(.34,1.4,.64,1)' });
  }
}
$('#fc-prev-week').addEventListener('click', () => moveWeek(-1));
$('#fc-next-week').addEventListener('click', () => moveWeek(1));

const cardFileName = () => `기분날씨-일기예보-${D.keyOf(app.fcMonday)}.png`;
const makeCard = () => renderCardBlob(app.fcSummary);

/** 연타 막기: 진행 중이거나 막 끝난 직후(1.2초)에는 다시 하지 않는다 */
async function withBusy(btn, fn) {
  if (btn.dataset.busy) return;
  btn.dataset.busy = '1';
  btn.classList.add('is-busy');
  try { await fn(); } finally {
    setTimeout(() => {
      delete btn.dataset.busy;
      btn.classList.remove('is-busy');
    }, 1200);
  }
}

const canShareFile = (file) => !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));

$('#fc-save').addEventListener('click', (ev) => withBusy(ev.currentTarget, async () => {
  let blob;
  try {
    blob = await makeCard();
  } catch (err) {
    console.warn(err);
    notify('이미지를 만들지 못했어요. 다시 시도해 주세요', { tone: 'warn' });
    return;
  }
  if (install.inAppBrowser()) {
    showCardPreview(blob);
    return;
  }
  // 아이폰은 '사진에 저장'이 공유 시트에 있다
  if (install.isIOS()) {
    const file = new File([blob], cardFileName(), { type: 'image/png' });
    if (canShareFile(file)) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    showCardPreview(blob);
    return;
  }
  downloadBlob(blob, cardFileName());
  notify('카드 이미지를 저장했어요');
}));

$('#fc-share').addEventListener('click', (ev) => withBusy(ev.currentTarget, async () => {
  let blob;
  try {
    blob = await makeCard();
  } catch (err) {
    console.warn(err);
    notify('이미지를 만들지 못했어요. 다시 시도해 주세요', { tone: 'warn' });
    return;
  }
  const file = new File([blob], cardFileName(), { type: 'image/png' });
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: '나의 기분 일기예보', text: `이번 주 내 마음 날씨는 '${app.fcSummary.s.headline}' #기분날씨` });
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        downloadBlob(blob, cardFileName());
        notify('공유 대신 이미지로 저장했어요');
      }
    }
    return;
  }
  if (install.isIOS() || install.inAppBrowser()) {
    showCardPreview(blob);
    return;
  }
  downloadBlob(blob, cardFileName());
  notify('바로 공유가 안 되는 브라우저라 이미지로 저장했어요');
}));

// 저장한 이미지를 크게 보여 준다 (아이폰: 길게 눌러 '사진에 저장')
const previewSheet = createSheet($('#preview-sheet'));
function showCardPreview(blob) {
  const img = $('#preview-img');
  if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  const url = URL.createObjectURL(blob);
  img.dataset.url = url;
  img.src = url;
  previewSheet.open();
}

// ================================================================ 설정
const settingsSheet = createSheet($('#settings-sheet'), { onOpen: renderSettings });
$('#settings-btn').addEventListener('click', () => settingsSheet.open());

function renderSettings() {
  $('#install-row').hidden = install.isStandalone();
  ['#ios-install-guide', '#other-install-guide', '#inapp-install-guide'].forEach((s) => { $(s).hidden = true; });
  const inApp = install.inAppBrowser();
  $('#install-sub').textContent = inApp ? `${inApp} 밖의 브라우저에서 추가해요` : install.isIOS() ? '두 번만 누르면 끝' : '앱처럼 홈 화면에서 바로 열어요';
  $('#data-count').textContent = `기록 ${store.count()}일 · 이 기기에만 저장`;
  const lb = store.getMeta('lastBackup');
  $('#backup-sub').textContent = lb ? `마지막 백업 ${D.fmtMD(D.parseKey(lb))} · 파일로 보관` : '아직 백업한 적 없어요 · 파일로 보관';
  $('#ios-evict-warn').hidden = !(install.isIOS() && !install.isStandalone() && store.count() > 0);
  $('#reset-confirm-row').hidden = true;
}

/** 이 브라우저에 맞는 '홈 화면에 추가' 안내를 펼친다 */
function showInstallGuide() {
  const inApp = install.inAppBrowser();
  let g;
  if (inApp) {
    g = $('#inapp-install-guide');
    $('#inapp-title').textContent = `${inApp} 안에서는 추가할 수 없어요`;
    $('#inapp-target').textContent = install.isIOS() ? '사파리' : '크롬';
  } else if (install.isIOS()) {
    g = $('#ios-install-guide');
    $('#ios-where').textContent = install.isIOSChrome() ? '주소창 오른쪽' : '사파리 아래쪽';
    $('#ios-where-sub').hidden = install.isIOSChrome();
  } else {
    g = $('#other-install-guide');
  }
  g.hidden = false;
  return g;
}
install.onInstallChange(() => settingsSheet.isOpen && renderSettings());

$('#install-btn').addEventListener('click', async () => {
  if (install.canPrompt()) {
    const r = await install.promptInstall();
    if (r === 'accepted') {
      store.setMeta('installed', true);
      notify('홈 화면에 추가했어요');
    }
    return;
  }
  const open = ['#ios-install-guide', '#other-install-guide', '#inapp-install-guide'].some((s) => !$(s).hidden);
  if (open) ['#ios-install-guide', '#other-install-guide', '#inapp-install-guide'].forEach((s) => { $(s).hidden = true; });
  else showInstallGuide();
});

$('#backup-export').addEventListener('click', (ev) => withBusy(ev.currentTarget, async () => {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  downloadBlob(blob, `기분날씨-백업-${app.todayK}.json`);
  store.setMeta('lastBackup', app.todayK);
  if (settingsSheet.isOpen) renderSettings();
  notify(`기록 ${store.count()}일을 백업 파일로 저장했어요`);
}));

$('#backup-import').addEventListener('change', async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) {
    notify('파일이 너무 커요. 기분날씨 백업 파일을 골라 주세요', { tone: 'warn' });
    return;
  }
  const r = store.importJSON(await f.text(), app.todayK);
  if (r.ok && (r.added || r.updated)) {
    const parts = [];
    if (r.added) parts.push(`${r.added}일 새로`);
    if (r.updated) parts.push(`${r.updated}일 더 최근 것으로`);
    let msg = `${parts.join(', ')} 불러왔어요`;
    if (r.kept) msg += ` (${r.kept}일은 지금 기록이 더 최근이라 그대로)`;
    if (r.future) msg += ` · 미래 날짜 ${r.future}일은 건너뜀`;
    if (r.invalid) msg += ` · 잘못된 항목 ${r.invalid}개는 건너뜀`;
    notify(msg, { duration: 3600 });
  } else if (r.ok) {
    notify(r.kept ? '지금 기록이 모두 더 최근이라 그대로 뒀어요' : '이미 다 들어 있는 기록이에요');
  } else if (r.reason === 'empty') notify('불러올 기록이 없는 파일이에요', { tone: 'warn' });
  else if (r.reason === 'parse') notify('기분날씨 백업 파일이 아니에요', { tone: 'warn' });
  else notify('저장 공간이 부족해 불러오지 못했어요', { tone: 'warn' });
  refreshAll();
});

$('#reset-all').addEventListener('click', () => { $('#reset-confirm-row').hidden = false; });
$('#reset-cancel').addEventListener('click', () => { $('#reset-confirm-row').hidden = true; });
$('#reset-confirm').addEventListener('click', () => {
  const ok = store.clearAll();
  $('#reset-confirm-row').hidden = true;
  notify(ok ? '모든 기록을 지웠어요' : '지우지 못했어요. 다시 시도해 주세요', { tone: ok ? '' : 'warn' });
  refreshAll();
});

function refreshAll() {
  const e = store.getEntry(app.todayK);
  const w = e ? e.w : null;
  if (scene.weather !== w) scene.set(w, { instant: app.tab !== 'today' });
  renderToday({ talk: true });
  if (app.tab === 'calendar') renderCalendar();
  if (app.tab === 'forecast') renderForecast();
  if (settingsSheet.isOpen) renderSettings();
  if (daySheet.isOpen && !app.sheetEditing) renderDay();
}

// 다른 창(설치한 앱·브라우저 탭)에서 바뀌면 화면도 맞춘다
store.subscribe((c) => { if (c.type === 'external') refreshAll(); });

// ================================================================ 날짜가 바뀌면 (자정을 넘겨 켜 둔 경우)
function checkDayChange() {
  const k = D.todayKey();
  if (k === app.todayK) return;
  app.todayK = k;
  app.memoDraft = null;
  app.fcMonday = D.mondayOf(D.today());
  app.calMonth = new Date(D.today().getFullYear(), D.today().getMonth(), 1);
  const e = store.getEntry(k);
  scene.set(e ? e.w : null, { instant: true });
  refreshAll();
}
setInterval(() => {
  checkDayChange();
  document.body.dataset.phase = phaseNow();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkDayChange();
    document.body.dataset.phase = phaseNow();
  }
});

// ================================================================ 시작
(function boot() {
  const e = store.getEntry(app.todayK);
  history.replaceState({ tab: null }, '');
  renderToday();
  if (e) {
    scene.set(e.w, { instant: true });
    say(todayLine(), { instant: true });
  } else {
    const sc = $('#scene');
    sc.classList.add('pre');
    scene.set(null, { instant: true });
    $('#talk-live').textContent = '';
    setTimeout(() => sc.classList.remove('pre'), 360);
    setTimeout(() => say(todayLine()), 700);
  }
  if (store.loadProblem === 'corrupt') {
    notify('저장된 기록을 읽지 못했어요. 원본은 따로 보관해 두었어요', { tone: 'warn', duration: 6000 });
  } else if (store.loadProblem === 'unavailable') {
    notify('이 브라우저에선 기록을 저장할 수 없어요 (사생활 보호 모드인가요?)', { tone: 'warn', duration: 6000 });
  }
  if (store.count() > 0) store.requestPersistence();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[기분날씨] 서비스 워커 등록 실패', err));
  }
})();
