// 기분날씨 — 앱 시작과 화면 연결
import * as store from './store.js';
import { WEATHERS, WEATHER_IDS, W, FEELINGS, FEEL_LABEL, FEEL_MAX, FEEL_REPLY, ALL_FEELINGS, INIT_PH, pickedLine, againLine, greetLine, tapLine, remindText, ro, specialDay } from './weather.js';
import { memoReply, rememberLine, recentLines } from './talk.js';
import * as D from './dates.js';
import { icon, TONE } from './icons.js';
import { sceneSVG, friendSVG } from './art.js';
import { createScene } from './scene.js';
import { $, $$, toast, hideToast, createSheet, closeTopSheet, downloadBlob, reducedMotion } from './ui.js';
import { summarize, josa } from './forecast-text.js';
import { renderCardBlob } from './card.js';
import * as install from './install.js';
import * as N from './native.js';
import { ITEMS, ITEM, wearSVG, wearList, toggleWear, unlockedBy, newGifts, nextItem } from './wardrobe.js';
import { renderInsights } from './insights.js';
import { APP, LINKS } from './config.js';
import { INFO } from './info.js';

const INTRO_KEY = 'kibun-weather:intro';
const NATIVE = N.isNative();

// 앱(네이티브)이면: 웹 저장소가 비었을 때 기기 설정 저장소에서 먼저 되살리고, 저장할 때마다 한 벌 더 저장한다.
if (NATIVE) {
  document.documentElement.classList.add('native', `native-${N.platform()}`);
  // 앱에서는 화면 확대를 막는다(웹에서는 접근성을 위해 그대로 둔다)
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', `${vp.getAttribute('content')}, maximum-scale=1, user-scalable=no`);
  store.reconcile(await N.prefsGet(store.KEY));
  store.onPersist((raw) => N.mirror(store.KEY, raw));
}
store.load();
if (NATIVE && !store.isReadOnly()) N.mirror(store.KEY, store.rawState(), { force: true });
D.setDayStart(store.getMeta('dayStart') ?? 4);

const app = {
  todayK: D.todayKey(),
  tab: 'today',
  calMonth: new Date(D.today().getFullYear(), D.today().getMonth(), 1),
  fcMonday: D.mondayOf(D.today()),
  sheetKey: null,
  sheetEditing: false,
  sheetUndo: null, // 시트에서 처음 바꾸기 전 기록 (되돌리기용)
  memoDraft: null, // 오늘 메모칸에 쓰다 만 글 (탭을 오가도 지키기)
  celebrating: false, // 첫 기록 축하 중에는 선물 편지를 잠시 미룬다
  feelMemo: {}, // 오늘 날씨를 바꿨다 돌아오면 그 날씨에서 골랐던 마음 단어를 되살린다
  sheetMemoDirty: false, // 하루 시트 메모칸을 사용자가 고쳤는지 (다른 창이 바꾼 메모를 덮지 않게)
};

if (install.isStandalone() || NATIVE) document.documentElement.classList.add('standalone');
if (install.isIOS()) document.documentElement.classList.add('ios');
const phaseNow = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : 'night';
};
document.body.dataset.phase = phaseNow();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const short = (s, n) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n).join('')}…` : s);
const toneStyle = (w) => (w && TONE[w] ? `--tint:${TONE[w].tint};--deep:${TONE[w].deep};--glow:${TONE[w].glow}` : '');
const THEME = { initial: '#FFF6EC', sunny: '#FFF5DF', rainbow: '#FFF2EE', cloudy: '#F6F2EE', snow: '#F3F3FB', rain: '#EEF1F7', thunder: '#F2ECF7' };
const PAPER = { cream: '#FFF6EC', mint: '#EAF6EF', lavender: '#F1EDFB', sky: '#EAF3FB' };
const setTheme = (w) => document.querySelector('meta[name="theme-color"]').setAttribute('content', PAPER[store.getMeta('paper')] || THEME[w || 'initial']);
/** 지금 입은 소품 목록(얼굴·머리 칸마다 하나, 열린 것만) */
const wearing = () => wearList(store.getMeta('wear'), store.count());
const hm = (h, m) => `${h < 12 ? '오전' : '오후'} ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;

// ---------------------------------------------------------------- 설정 적용 (글자 크기 · 진동)
const isCalm = () => !!store.getMeta('calm');
/** 아이폰 '더 큰 텍스트' 설정을 따라간다(사용자가 앱에서 고른 적이 없을 때만) */
function systemFontScale() {
  try {
    const el = document.createElement('span');
    el.style.cssText = 'font:-apple-system-body;position:absolute;visibility:hidden;pointer-events:none';
    el.textContent = '가';
    document.body.appendChild(el);
    const px = parseFloat(getComputedStyle(el).fontSize);
    el.remove();
    const r = px / 17;
    return !px || Number.isNaN(r) ? 1 : r >= 1.25 ? 1.3 : r >= 1.1 ? 1.15 : 1;
  } catch {
    return 1;
  }
}
function applyPrefs() {
  const chosen = store.getMeta('fontScale');
  const fs = chosen !== undefined ? Number(chosen) || 1 : N.platform() === 'ios' ? systemFontScale() : 1;
  document.documentElement.dataset.paper = store.getMeta('paper') || '';
  document.documentElement.style.setProperty('--fs', String(fs));
  document.documentElement.classList.toggle('fs-large', fs > 1);
  document.documentElement.classList.toggle('fs-xl', fs >= 1.3);
  document.documentElement.classList.toggle('calm', isCalm());
  N.setHaptics(store.getMeta('haptics') !== false, { calm: isCalm() });
}
applyPrefs();
const buzz = (kind) => N.haptic(kind);

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

// ================================================================ 마음 단어
const feelOpen = { today: false, sheet: false };
/** 칩 목록: (다른 날씨에서 고른 단어) + 이 날씨의 단어 5개 + (펼치면 나머지 모두) + '다른 마음' 버튼 */
function feelIds(w, selected = [], open = false) {
  const own = FEELINGS[w] || [];
  const extra = selected.filter((id) => !own.includes(id));
  const rest = open ? ALL_FEELINGS.filter((id) => !own.includes(id) && !extra.includes(id)) : [];
  return [...extra, ...own, ...rest];
}
function feelHTML(w, selected = [], open = false) {
  if (!w || !FEELINGS[w]) return '';
  const chips = feelIds(w, selected, open).map((id, i) => `<button type="button" class="fchip" data-feel="${id}" aria-pressed="${selected.includes(id)}" style="--i:${i};${toneStyle(w)}">${FEEL_LABEL[id]}</button>`).join('');
  return `${chips}<button type="button" class="fchip fchip--more" data-more="1" aria-expanded="${open}">${open ? '접기' : '+ 다른 마음'}</button>`;
}
/** 칩 줄을 그린다. 모양이 그대로면 눌림 표시만 바꿔 깜빡이지 않게 */
function paintFeel(row, w, selected, open) {
  const sig = `${w}|${open}|${feelIds(w, selected, open).join(',')}`;
  if (row.dataset.sig !== sig) {
    const keep = row.scrollLeft;
    row.innerHTML = feelHTML(w, selected, open);
    row.dataset.sig = sig;
    row.dataset.w = w;
    row.scrollLeft = keep;
    if (row.dataset.drawn) row.classList.add('no-anim');
    row.dataset.drawn = '1';
  } else {
    $$('.fchip[data-feel]', row).forEach((c) => c.setAttribute('aria-pressed', String(selected.includes(c.dataset.feel))));
  }
}
/** 칩을 눌렀을 때 새 목록 (최대 3개, 넘치면 null) */
function toggleFeel(cur, id) {
  const f = [...(cur || [])];
  const at = f.indexOf(id);
  if (at >= 0) { f.splice(at, 1); return f; }
  if (f.length >= FEEL_MAX) return null;
  f.push(id);
  return f;
}
function renderTodayFeel({ animate = false } = {}) {
  const e = store.getEntry(app.todayK);
  const row = $('#feel-row');
  if (!e) { row.hidden = true; return; }
  const chips = $('#feel-chips');
  if (chips.dataset.w !== e.w) { chips.scrollLeft = 0; feelOpen.today = false; chips.classList.remove('no-anim'); delete chips.dataset.drawn; }
  paintFeel(chips, e.w, e.f || [], feelOpen.today);
  const wasHidden = row.hidden;
  row.hidden = false;
  if (animate && wasHidden && !reducedMotion()) row.classList.add('is-in');
  if (wasHidden) ensureMemoVisible();
}

/** 마음 단어 줄이 생겨 메모칸이 아래 탭바에 가리면 오늘 화면을 그만큼 올린다(작은 휴대폰) */
function ensureMemoVisible() {
  requestAnimationFrame(() => {
    const view = $('[data-view="today"]');
    const form = $('#memo-form');
    const bar = $('.tabbar');
    if (!view || !form || !bar || view.hidden) return;
    const over = form.getBoundingClientRect().bottom + 10 - bar.getBoundingClientRect().top;
    if (over > 0) view.scrollBy({ top: over, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
}
/** 고른 칩이 보이도록 칩 줄을 넘겨 둔다 */
function revealPressedChip(row) {
  const c = row && row.querySelector('.fchip[aria-pressed="true"]');
  if (c) row.scrollLeft = Math.max(0, c.offsetLeft - 20);
}
$('#feel-chips').addEventListener('click', (ev) => {
  if (checkDayChange()) return;
  if (ev.target.closest('[data-more]')) {
    feelOpen.today = !feelOpen.today;
    buzz('select');
    renderTodayFeel();
    return;
  }
  const c = ev.target.closest('[data-feel]');
  const e = store.getEntry(app.todayK);
  if (!c || !e) return;
  const next = toggleFeel(e.f, c.dataset.feel);
  if (!next) {
    notify(`마음 단어는 ${FEEL_MAX}개까지 고를 수 있어요`, { tone: 'warn' });
    buzz('warn');
    return;
  }
  if (!store.setEntry(app.todayK, { f: next })) {
    notify('저장 공간이 부족해 저장하지 못했어요', { tone: 'warn' });
    return;
  }
  buzz('select');
  const added = next.includes(c.dataset.feel);
  renderTodayFeel();
  if (added) {
    say(FEEL_REPLY[c.dataset.feel] || '마음을 알려 줘서 고마워요');
    scene.react();
  }
  afterChange(app.todayK, { skipToday: true });
});

// ================================================================ 몽글이 대사
let typeT = 0;
let greetT = 0; // 켜자마자의 인사(0.7초 뒤) — 그 전에 다른 말을 하면 취소한다
function say(text, { instant = false } = {}) {
  clearTimeout(greetT);
  const ghost = $('#talk-ghost');
  const live = $('#talk-live');
  const talk = $('#talk');
  clearInterval(typeT);
  ghost.textContent = text;
  $('#talk-sr').textContent = `몽글이: ${text}`;
  if (instant || reducedMotion() || isCalm() || app.tab !== 'today') {
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
  }, 30);
}

// ================================================================ 오늘
const scene = createScene($('#sky'), {
  label: (w) => (w ? `내 작은 하늘: ${W[w].name}, ${W[w].mood}. 몽글이를 누르면 말을 걸어요` : '내 작은 하늘: 아직 고르지 않았어요. 몽글이를 누르면 말을 걸어요'),
});

function renderWear() {
  $('#wear').innerHTML = wearSVG(wearing());
}

function renderToday({ talk = false } = {}) {
  const e = store.getEntry(app.todayK);
  $('#today-date').textContent = `${D.fmtFull(D.parseKey(app.todayK))}${D.isLateNight() ? ' 밤' : ''}`;
  markPicker($('#today-picker'), e?.w);
  $('#today-picker').classList.toggle('is-first', store.count() === 0);
  const memo = $('#memo-input');
  if (document.activeElement !== memo) memo.value = app.memoDraft ?? (e?.m || '');
  memo.placeholder = e ? W[e.w].ph : INIT_PH;
  updateMemoUI();
  renderSaved();
  renderTodayFeel();
  renderWear();
  renderLetters();
  renderGreeting(e?.w || null);
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

function greetCtx() {
  const y = store.getEntry(D.keyOf(D.addDays(D.parseKey(app.todayK), -1)));
  return { birthday: store.getMeta('birthday') || '', yesterday: y, lateNight: D.isLateNight() };
}
function todayLine() {
  const e = store.getEntry(app.todayK);
  if (!e && specialDay(new Date(), store.getMeta('birthday') || '')) return greetLine(new Date(), greetCtx());
  if (!$('#weekly-banner').hidden && !e) return '지난주 일기예보가 도착했어요! 편지를 눌러 봐요';
  if (!$('#gift-banner').hidden) return '선물이 도착했어요! 눌러서 열어 봐요';
  if (!e) return greetLine(new Date(), greetCtx());
  if (e.m) return `‘${short(e.m, 13)}’ 잘 간직하고 있어요`;
  return againLine(e.w, app.todayK);
}

function renderSaved() {
  const e = store.getEntry(app.todayK);
  $('#saved').classList.toggle('on', !!e);
  const n = e ? store.streak(app.todayK, D.keyOf, D.addDays, D.parseKey) : 0;
  $('#saved-text').textContent = n >= 2 ? `연속 ${n}일째` : '저장됨';
}

/** 고른 순간의 말에 필요한 것: 어제 기록, 어제까지 같은 날씨가 이어진 날 수, 밤인지 */
function lineCtx(w) {
  const yk = D.addDays(D.parseKey(app.todayK), -1);
  const prev = store.getEntry(D.keyOf(yk));
  let runBefore = 0;
  if (prev && prev.w === w) {
    let d = yk;
    while (store.getEntry(D.keyOf(d))?.w === w) { runBefore++; d = D.addDays(d, -1); }
  }
  return { key: app.todayK, night: document.body.dataset.phase === 'night', prev, runBefore };
}

function pickToday(w) {
  checkDayChange();
  const prev = store.getEntry(app.todayK);
  const heartsBefore = hearts();
  buzz(w);
  if (prev && prev.w === w) {
    scene.react();
    say(tapLine(w));
    return;
  }
  const first = store.count() === 0;
  const giftsBefore = pendingGifts().length;
  if (prev && prev.f && prev.f.length) app.feelMemo[prev.w] = prev.f;
  const typed = store.cleanMemo($('#memo-input').value);
  // 메모칸에 저장 안 한 글이 있으면 날씨와 함께 저장 (처음 기록이든 다시 고르든 똑같이)
  const withMemo = !!typed && typed !== (prev?.m || '');
  const patch = withMemo || !prev ? { w, m: typed || (prev?.m ?? '') } : { w };
  if (app.feelMemo[w]) patch.f = app.feelMemo[w];
  const ok = store.setEntry(app.todayK, patch);
  if (!ok) {
    markPicker($('#today-picker'), prev?.w);
    notify('저장 공간이 부족해 기록을 저장하지 못했어요. 설정에서 백업해 주세요', { tone: 'warn', duration: 4500 });
    return;
  }
  scene.set(w);
  markPicker($('#today-picker'), w);
  $('#today-picker').classList.remove('is-first');
  say(pickedLine(w, lineCtx(w)));
  $('#memo-input').placeholder = W[w].ph;
  updateMemoUI();
  renderSaved();
  renderTodayFeel({ animate: true });
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
  const giftNow = !prev && pendingGifts().length > giftsBefore;
  if (first) {
    // 몽글이의 공감 한마디를 먼저 충분히 보여 주고(2.6초), 그다음 축하·선물. 알림은 이때 묻지 않는다.
    store.requestPersistence();
    app.celebrating = true;
    setTimeout(() => {
      app.celebrating = false;
      if (app.tab === 'today' && !isCalm()) {
        confetti($('#sky'));
        say(giftNow ? '첫 날씨를 남겼어요! 작은 선물이 도착했어요' : '첫 날씨를 남겼어요! 내일도 하늘 보러 와요');
      }
      renderLetters();
    }, 2600);
  } else if (!prev) {
    celebrateStreak(giftNow);
    if (giftNow) setTimeout(() => renderLetters({ announce: !isCalm() }), 1900);
    const lv = levelUpLine(heartsBefore);
    if (lv && !giftNow) setTimeout(() => { if (app.tab === 'today') { say(lv); heartPop(); } }, 2100);
    else if (store.count() === 4 && !giftNow && !isCalm()) setTimeout(() => { if (app.tab === 'today') say('기록 4일! 달력 아래 돌아보기에 마음 흐름이 그려졌어요'); }, 2400);
    maybeAskRemind({ delay: 3200 });
  }
  if (!prev) scheduleRemind();
}

$('#today-picker').innerHTML = pickerHTML(store.getEntry(app.todayK)?.w);
$('#today-picker').addEventListener('click', (e) => {
  const b = e.target.closest('[data-weather]');
  if (b) pickToday(b.dataset.weather);
});

// ---------------------------------------------------------------- 몽글이와 친해지기
const LEVELS = [[0, '처음 만난 사이'], [5, '인사하는 사이'], [15, '친구'], [30, '단짝'], [60, '베스트 프렌드'], [100, '가족 같은 사이'], [200, '영원한 단짝']];
const hearts = () => store.count() + ((store.getMeta('pet') || {}).n || 0);
function levelOf(h) {
  let i = 0;
  LEVELS.forEach((l, j) => { if (h >= l[0]) i = j; });
  return { i, name: LEVELS[i][1], next: LEVELS[i + 1] || null };
}
/** 하트가 늘어 단계가 오르면 그 말을 돌려준다(아니면 null) */
function levelUpLine(before) {
  const a = levelOf(before);
  const b = levelOf(hearts());
  if (b.i <= a.i) return null;
  return `우리 이제 '${b.name}'${josa(b.name, '이에요', '예요')}! ♥`;
}
function heartPop() {
  if (reducedMotion()) return;
  const h = document.createElement('i');
  h.className = 'heart-pop';
  h.setAttribute('aria-hidden', 'true');
  $('#sky').appendChild(h);
  setTimeout(() => h.remove(), 1300);
}
/** 오늘 처음 쓰다듬으면 하트 +1 하고 고마워한다. 이미 쓰다듬었으면 null */
function petToday() {
  const pet = store.getMeta('pet') || { day: '', n: 0 };
  if (pet.day === app.todayK) return null;
  const before = hearts();
  if (!store.setMeta('pet', { day: app.todayK, n: (pet.n || 0) + 1 })) return null;
  heartPop();
  return levelUpLine(before) || '쓰다듬어 줘서 고마워요! 오늘의 하트 ♥';
}

// 몽글이(하늘)를 누르면 찌그러지며 말을 건다. 하루에 처음 누르면 하트가 쌓인다.
$('#sky-in').addEventListener('click', () => {
  buzz('tap');
  const line = petToday() || tapLine(scene.weather, new Date(), recentLines());
  rememberLine(line);
  say(line);
});

// 연속 기록 축하 (3·7·14일…)
const MILESTONES = [3, 7, 14, 21, 30, 50, 100, 200, 365];
function celebrateStreak(giftNow) {
  const n = store.streak(app.todayK, D.keyOf, D.addDays, D.parseKey);
  if (!MILESTONES.includes(n) || isCalm()) return;
  setTimeout(() => {
    if (app.tab !== 'today') return;
    if (!giftNow) say(n >= 30 ? `${n}일 연속이라니! 몽글이가 정말 감동했어요` : `와, ${n}일 연속 기록이에요! 매일 와 줘서 고마워요`);
    const chip = $('#saved');
    chip.classList.remove('is-party');
    void chip.offsetWidth;
    chip.classList.add('is-party');
    confetti($('#sky'));
  }, 1700);
}

/** 색종이 터뜨리기 */
function confetti(host) {
  if (reducedMotion() || isCalm() || !host) return;
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
  if (checkDayChange()) return;
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
  buzz('success');
  // 알림 대신 버튼('저장됨')과 몽글이 말로 알려 준다 (제목을 가리지 않게)
  say(v ? memoReplyFor(v) : '메모는 지웠어요. 날씨는 그대로예요');
  scene.react();
});

/** 몽글이가 메모에 하는 답 (최근 7일 메모를 기억) */
function memoReplyFor(m) {
  const e = store.getEntry(app.todayK);
  const recent = [];
  for (let i = 1; i <= 7; i++) {
    const k = D.keyOf(D.addDays(D.parseKey(app.todayK), -i));
    const r = store.getEntry(k);
    if (r && r.m) recent.push({ k, m: r.m, w: r.w });
  }
  return memoReply(m, e ? e.w : 'cloudy', recent, app.todayK);
}

// 키보드가 떠 있는 동안만 아래 탭바를 숨긴다 (키보드 위에 뜨지 않게).
// '뒤로'로 키보드만 닫고 입력칸에 포커스가 남아도 화면 높이가 돌아오면 탭바도 돌아온다.
let fullH = window.innerHeight;
const isTextFocused = () => !!(document.activeElement && document.activeElement.matches && document.activeElement.matches('input[type="text"]'));
function syncKeyboard() {
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  if (!isTextFocused()) fullH = Math.max(window.innerHeight, h);
  const coarse = matchMedia('(pointer: coarse)').matches;
  const open = isTextFocused() && (coarse || (vv ? h < fullH - 120 : true));
  document.documentElement.classList.toggle('is-typing', open);
  // 키보드가 입력칸을 가리지 않게: 오늘 화면의 메모칸이 보이도록 스크롤
  if (open && document.activeElement === $('#memo-input')) {
    $('#memo-form').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
document.addEventListener('focusin', () => setTimeout(syncKeyboard, 250));
document.addEventListener('focusout', () => setTimeout(syncKeyboard, 50));
if (window.visualViewport) window.visualViewport.addEventListener('resize', syncKeyboard);
window.addEventListener('orientationchange', () => setTimeout(() => { fullH = window.innerHeight; syncKeyboard(); }, 400));

// ================================================================ 하늘 위 편지들: 선물 > 지난주 예보 > 홈 화면 추가
function lastWeekInfo() {
  const thisMon = D.mondayOf(D.parseKey(app.todayK));
  const lastMon = D.addDays(thisMon, -7);
  const n = D.weekKeys(lastMon).filter((k) => store.getEntry(k)).length;
  return { lastMon, lastKey: D.keyOf(lastMon), n };
}
const pendingGifts = () => newGifts(store.count(), store.getMeta('seenGifts') || []);

function renderLetters({ announce = false } = {}) {
  const pend = app.celebrating ? [] : pendingGifts();
  // 새 선물은 도착한 날(기록하는 날)에만 편지로 알린다. 그 뒤로는 옷장 버튼의 점만 남겨 인사·예보 편지를 가리지 않는다.
  let gd = store.getMeta('giftDay') || {};
  const missing = pend.filter((g) => !gd[g.id]);
  if (missing.length) {
    gd = { ...gd };
    missing.forEach((g) => { gd[g.id] = app.todayK; });
    store.setMeta('giftDay', gd);
  }
  const gifts = pend.filter((g) => gd[g.id] === app.todayK);
  const gift = $('#gift-banner');
  const wasGiftHidden = gift.hidden;
  gift.hidden = !gifts.length;
  if (gifts.length) $('#gift-text').textContent = gifts.length === 1 ? `${gifts[0].name} 선물 도착` : `선물 ${gifts.length}개 도착`;
  $('#closet-dot').hidden = !pendingGifts().length;
  const { lastKey, n } = lastWeekInfo();
  $('#weekly-banner').hidden = !(n > 0 && store.getMeta('seenWeek') !== lastKey);
  renderInstallNudge();
  if (announce && !isCalm() && gifts.length && wasGiftHidden && app.tab === 'today') {
    say(gifts[gifts.length - 1].gift);
    buzz('success');
  }
}

$('#weekly-banner').addEventListener('click', () => {
  const letter = $('#weekly-banner');
  if (letter.classList.contains('is-opening')) return;
  const { lastMon, lastKey } = lastWeekInfo();
  store.setMeta('seenWeek', lastKey);
  app.fcMonday = lastMon;
  buzz('medium');
  const go = () => {
    letter.classList.remove('is-opening');
    showTab('forecast');
    renderLetters();
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

$('#gift-banner').addEventListener('click', () => {
  const letter = $('#gift-banner');
  if (letter.classList.contains('is-opening')) return;
  buzz('success');
  const go = () => {
    letter.classList.remove('is-opening');
    openCloset({ fromGift: true });
  };
  if (reducedMotion()) { go(); return; }
  letter.classList.add('is-opening');
  setTimeout(go, 360);
});

// ---------------------------------------------------------------- 홈 화면에 추가 권유 (웹에서만, 첫 기록 뒤, 7일에 한 번)
function renderInstallNudge() {
  const el = $('#install-nudge');
  const last = store.getMeta('installNudgeAt');
  const quiet = last && (D.parseKey(app.todayK) - D.parseKey(last)) / 86400000 < 7;
  const possible = install.canPrompt() || install.isIOS() || !!install.inAppBrowser();
  el.hidden = NATIVE || install.isStandalone() || store.count() < 1 || !$('#weekly-banner').hidden || !$('#gift-banner').hidden
    || quiet || !possible || !!store.getMeta('installed') || app.celebrating;
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
$$('.tabbar [data-tab]').forEach((b) => b.addEventListener('click', () => { buzz('select'); showTab(b.dataset.tab); }));

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
    const feel = e && e.f && e.f.length ? `, 마음: ${e.f.map((id) => FEEL_LABEL[id]).join('·')}` : '';
    const label = `${D.fmtFull(d)}${k === tK ? ' 오늘' : ''}${e ? `, ${W[e.w].name} ${W[e.w].mood}${feel}${e.m ? `, 메모: ${e.m}` : ''}` : future ? '' : ', 기록 없음'}`;
    return `<button type="button" class="${cls}" data-date="${k}" ${e ? `data-weather="${e.w}" style="${toneStyle(e.w)};--k:${k2++}"` : ''}
      ${future ? 'aria-disabled="true" data-future="1"' : ''} aria-label="${esc(label)}">
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
  renderInsights($('#insights'), { month: m, entries: store.entries(), todayK: app.todayK });
}

function renderMonthStats() {
  const m = app.calMonth;
  const prefix = `${m.getFullYear()}-${D.pad(m.getMonth() + 1)}-`;
  const list = Object.entries(store.entries()).filter(([k]) => k.startsWith(prefix) && k <= app.todayK);
  const box = $('#cal-stats');
  if (!list.length) {
    const isNow = m.getFullYear() === D.today().getFullYear() && m.getMonth() === D.today().getMonth();
    box.innerHTML = `<div class="cal-empty">${friendSVG('initial', 86, wearing())}<p><b>${m.getMonth() + 1}월에는 아직 남긴 날씨가 없어요</b>${isNow ? '오늘 날씨를 남기면 여기에 하나씩 쌓여요.' : '지난 날짜를 눌러 그날의 날씨를 남길 수 있어요.'}</p></div>`;
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
  if (!c) return;
  if (c.dataset.future) {
    buzz('warn');
    notify('아직 오지 않은 날이에요. 그날이 되면 남길 수 있어요');
    c.classList.remove('is-shake');
    void c.offsetWidth;
    c.classList.add('is-shake');
    return;
  }
  buzz('select');
  openDay(c.dataset.date);
});
// 돌아보기의 점·좋았던 날을 누르면 그날을 연다
$('#insights').addEventListener('click', (e) => {
  const c = e.target.closest('[data-date]');
  if (!c) return;
  buzz('select');
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
  if (!k || !app.sheetEditing || !app.sheetMemoDirty) return;
  const e = store.getEntry(k);
  if (!e) return;
  const v = store.cleanMemo($('#sheet-memo').value);
  if (v === (e.m || '')) return;
  if (store.setEntry(k, { m: v })) {
    notify(`${D.fmtMD(D.parseKey(k))} 메모도 저장했어요`);
    afterChange(k);
  } else {
    notify('저장 공간이 부족해 메모를 저장하지 못했어요. 설정에서 백업해 주세요', { tone: 'warn', duration: 4500 });
  }
}
$('#sheet-memo').addEventListener('input', () => { app.sheetMemoDirty = true; });

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

function renderSheetFeel(k) {
  const e = store.getEntry(k);
  const row = $('#sheet-feel-row');
  row.hidden = !e;
  if (!e) return;
  const chips = $('#sheet-feel-chips');
  if (chips.dataset.key !== k || chips.dataset.w !== e.w) { feelOpen.sheet = false; chips.dataset.key = k; chips.dataset.sig = ''; delete chips.dataset.drawn; chips.classList.remove('no-anim'); chips.scrollLeft = 0; }
  paintFeel(chips, e.w, e.f || [], feelOpen.sheet);
  revealPressedChip(chips);
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
    $('#day-hero').innerHTML = sceneSVG(e.w, { ratio: 2, wear: wearing() });
    const badge = $('#day-badge');
    badge.setAttribute('style', toneStyle(e.w));
    badge.innerHTML = `${icon(e.w)}<span>${W[e.w].name}</span><small>${W[e.w].mood}</small>`;
    $('#day-feel').innerHTML = (e.f || []).map((id) => `<span class="ftag" style="${toneStyle(e.w)}">${FEEL_LABEL[id]}</span>`).join('');
    const memo = $('#day-memo');
    memo.textContent = e.m || '메모 없이 날씨만 남긴 날이에요.';
    memo.classList.toggle('is-empty', !e.m);
  } else {
    $('#sheet-picker').innerHTML = pickerHTML(e?.w);
    renderSheetFeel(k);
    $('#sheet-memo').value = e?.m || '';
    app.sheetMemoDirty = false;
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
  const ok = store.setEntry(k, app.sheetMemoDirty || !prev ? { w, m: store.cleanMemo($('#sheet-memo').value) } : { w });
  if (!ok) {
    markPicker($('#sheet-picker'), prev?.w);
    notify('저장 공간이 부족해 저장하지 못했어요', { tone: 'warn' });
    return;
  }
  if (!app.sheetUndo || app.sheetUndo.k !== k) app.sheetUndo = { k, prev: prev ? { ...prev } : null };
  markPicker($('#sheet-picker'), w);
  renderSheetFeel(k);
  $('#sheet-memo').placeholder = sheetPh(w, k);
  $('#sheet-save').disabled = false;
  $('#sheet-undo').hidden = false;
  buzz(w);
  notify(`${D.fmtMD(D.parseKey(k))}, ${W[w].name}${ro(W[w].name)} ${prev ? '고쳤어요' : '남겼어요'}`);
  afterChange(k);
});

$('#sheet-feel-chips').addEventListener('click', (ev) => {
  if (ev.target.closest('[data-more]')) {
    feelOpen.sheet = !feelOpen.sheet;
    if (app.sheetKey) renderSheetFeel(app.sheetKey);
    return;
  }
  const c = ev.target.closest('[data-feel]');
  const k = app.sheetKey;
  const e = k && store.getEntry(k);
  if (!c || !e) return;
  const next = toggleFeel(e.f, c.dataset.feel);
  if (!next) {
    notify(`마음 단어는 ${FEEL_MAX}개까지 고를 수 있어요`, { tone: 'warn' });
    return;
  }
  if (!app.sheetUndo || app.sheetUndo.k !== k) app.sheetUndo = { k, prev: { ...e } };
  if (!store.setEntry(k, { f: next })) {
    notify('저장 공간이 부족해 저장하지 못했어요', { tone: 'warn' });
    return;
  }
  buzz('select');
  renderSheetFeel(k);
  $('#sheet-undo').hidden = false;
  afterChange(k);
});

$('#sheet-undo').addEventListener('click', () => {
  const u = app.sheetUndo;
  const k = app.sheetKey;
  if (!u || u.k !== k) return;
  const ok = u.prev ? store.setEntry(k, { w: u.prev.w, m: u.prev.m, f: u.prev.f || [] }) : store.removeEntry(k);
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
  setTimeout(() => { if (daySheet.isOpen && app.sheetKey === k && !app.sheetEditing) daySheet.close(); }, 1100);
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
    buzz('warn');
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

function afterChange(k, { skipToday = false } = {}) {
  if (app.tab === 'calendar') renderCalendar();
  if (app.tab === 'forecast') renderForecast();
  if (k === app.todayK) {
    if (!skipToday) {
      const e = store.getEntry(k);
      scene.set(e ? e.w : null, { instant: app.tab !== 'today' });
      renderToday({ talk: true });
      scheduleRemind();
    }
  } else renderLetters({ announce: false });
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
  const wear = wearing();
  $('#fc-range').textContent = `${D.fmtMD(mon)} – ${mon.getMonth() === sun.getMonth() ? `${sun.getDate()}일` : D.fmtMD(sun)}`;
  $('#fc-week-label').textContent = isCurrent ? '이번 주 · 진행 중' : weeksAgo === 1 ? '지난주 일기예보' : `${weeksAgo}주 전 일기예보`;
  $('#fc-stamp').textContent = isCurrent ? '진행 중' : s.recorded ? '도착' : '기록 없음';
  $('#fc-next-week').disabled = isCurrent;
  $('#fc-hero').innerHTML = sceneSVG(s.top || 'initial', { ratio: 2.2, wear });
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
  $('#fc-hint').textContent = empty ? '이 주에 날씨를 남기면 카드를 저장할 수 있어요.' : NATIVE ? '사진 앱에 저장하거나 친구에게 바로 보내 보세요.' : '이미지로 저장하거나 친구에게 바로 보내 보세요.';
  app.fcSummary = { days, s, mon, isCurrent, wear };
  // 지난주 카드를 직접 봤다면 '도착' 편지는 거둔다
  const { lastKey, n } = lastWeekInfo();
  if (D.keyOf(mon) === lastKey && n > 0 && store.getMeta('seenWeek') !== lastKey) {
    store.setMeta('seenWeek', lastKey);
    renderLetters();
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
const shareText = () => `이번 주 내 마음 날씨는 '${app.fcSummary.s.headline}' #기분날씨${LINKS.store ? `\n${LINKS.store}` : ''}`;

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

async function cardBlobOrWarn() {
  try {
    return await makeCard();
  } catch (err) {
    console.warn(err);
    notify('이미지를 만들지 못했어요. 다시 시도해 주세요', { tone: 'warn' });
    return null;
  }
}

$('#fc-save').addEventListener('click', (ev) => withBusy(ev.currentTarget, async () => {
  const blob = await cardBlobOrWarn();
  if (!blob) return;
  if (NATIVE) {
    // 앱: 사진 앱에 바로 저장. 안 되면 공유 창으로(아이폰은 '이미지 저장'이 그 안에 있다)
    const r = await N.savePhoto(blob, cardFileName());
    if (r === 'saved') { buzz('success'); notify('사진 앱에 카드를 저장했어요'); return; }
    if (r === 'denied') { notify('사진 저장이 허용되지 않았어요. 휴대폰 설정에서 허용해 주세요', { tone: 'warn', duration: 4200 }); return; }
    const s = await N.shareFile(blob, cardFileName(), { title: '나의 기분 일기예보' });
    if (s === 'error' || s === 'unsupported') notify('저장하지 못했어요. 다시 시도해 주세요', { tone: 'warn' });
    return;
  }
  if (install.inAppBrowser()) {
    showCardPreview(blob);
    return;
  }
  // 아이폰 웹은 '사진에 저장'이 공유 시트에 있다
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
  const blob = await cardBlobOrWarn();
  if (!blob) return;
  if (NATIVE) {
    const r = await N.shareFile(blob, cardFileName(), { title: '나의 기분 일기예보', text: shareText() });
    if (r === 'error' || r === 'unsupported') notify('공유하지 못했어요. 다시 시도해 주세요', { tone: 'warn' });
    return;
  }
  const file = new File([blob], cardFileName(), { type: 'image/png' });
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: '나의 기분 일기예보', text: shareText() });
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        if (install.isIOS() || install.inAppBrowser()) { showCardPreview(blob); return; }
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

// 저장한 이미지를 크게 보여 준다 (아이폰 웹: 길게 눌러 '사진에 저장')
const previewSheet = createSheet($('#preview-sheet'));
function showCardPreview(blob) {
  const img = $('#preview-img');
  if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
  const url = URL.createObjectURL(blob);
  img.dataset.url = url;
  img.src = url;
  previewSheet.open();
}

// ================================================================ 몽글이 옷장
let closetFocus = null;
const closetSheet = createSheet($('#closet-sheet'), {
  onOpen: () => renderCloset(),
  onClose: () => {
    closetFocus = null;
    renderLetters();
    renderSettingsIfOpen();
    maybeAskRemind({ delay: 700 });
  },
});

function renderCloset() {
  const n = store.count();
  const cur = wearing();
  const todayW = store.getEntry(app.todayK)?.w || 'sunny';
  const lv = levelOf(hearts());
  $('#closet-kicker').textContent = n ? `몽글이와 ${lv.name} ♥ ${hearts()} · 소품 ${unlockedBy(n).length}/${ITEMS.length}` : '첫 기록을 남기면 첫 선물이 열려요';
  $('#closet-stage').innerHTML = `<div class="closet-stage__in" style="${toneStyle(todayW)}">${friendSVG(todayW, 190, cur)}</div>`;
  const nx = nextItem(n);
  $('#closet-next').textContent = nx ? `${nx.need - n}일 더 남기면 '${nx.name}'${josa(nx.name, '이', '가')} 열려요` : '모든 소품을 모았어요! 정말 대단해요';
  const none = `<button type="button" class="closet-item ${cur.length ? '' : 'is-on'}" aria-pressed="${!cur.length}" data-item="">
      <span class="closet-item__art">${friendSVG('initial', 74, [])}</span><span class="closet-item__name">모두 벗기</span></button>`;
  $('#closet-grid').innerHTML = none + ITEMS.map((it) => {
    const open = n >= it.need;
    const on = cur.includes(it.id);
    const fresh = closetFocus && closetFocus.includes(it.id);
    return `<button type="button" class="closet-item ${on ? 'is-on' : ''} ${open ? '' : 'is-locked'} ${fresh ? 'is-new' : ''}" aria-pressed="${on}"
      ${open ? '' : 'aria-disabled="true"'} data-item="${it.id}" aria-label="${it.name}${it.slot === 'face' ? '(얼굴)' : '(머리)'}${open ? '' : `, ${it.need}일 기록하면 열려요`}">
      <span class="closet-item__art">${open ? friendSVG('initial', 74, it.id) : `<span class="closet-lock"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.6" fill="#EFE3D6" stroke="#B9A493" stroke-width="1.8"/><path d="M8.6 10.5V8.2a3.4 3.4 0 0 1 6.8 0v2.3" fill="none" stroke="#B9A493" stroke-width="1.8" stroke-linecap="round"/></svg></span>`}</span>
      <span class="closet-item__name">${open ? it.name : `${it.need}일`}</span>${fresh ? '<i class="closet-item__new">NEW</i>' : ''}</button>`;
  }).join('');
  // 연 순간 본 것으로 표시
  const seen = store.getMeta('seenGifts') || [];
  const unlockedIds = unlockedBy(n).map((it) => it.id);
  if (unlockedIds.some((id) => !seen.includes(id))) store.setMeta('seenGifts', [...new Set([...seen, ...unlockedIds])]);
  $('#closet-dot').hidden = true;
}

function openCloset({ fromGift = false } = {}) {
  const gifts = pendingGifts();
  closetFocus = gifts.map((g) => g.id);
  // 받은 선물이 들어갈 칸(머리·얼굴)이 비어 있으면 바로 입혀 준다
  if (fromGift && gifts.length) {
    const pick = gifts[gifts.length - 1];
    const cur = wearing();
    if (!cur.some((id) => ITEM[id].slot === pick.slot)) {
      store.setMeta('wear', toggleWear(cur, pick.id));
      renderWear();
    }
  }
  if (closetSheet.isOpen) renderCloset();
  else closetSheet.open();
  if (fromGift && gifts.length) {
    const g = gifts[gifts.length - 1];
    notify(wearing().includes(g.id) ? `${g.name}${josa(g.name, '을', '를')} 달아 줬어요!` : `'${g.name}'${josa(g.name, '이', '가')} 옷장에 들어왔어요`);
    setTimeout(() => {
      const st = $('#closet-stage .closet-stage__in');
      if (st && !reducedMotion()) { st.classList.remove('is-pop'); void st.offsetWidth; st.classList.add('is-pop'); }
      confetti($('#closet-stage'));
    }, 250);
  }
}

$('#closet-btn').addEventListener('click', () => { buzz('select'); openCloset(); });
$('#closet-open').addEventListener('click', () => { openCloset(); });
$('#closet-grid').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-item]');
  if (!b) return;
  const id = b.dataset.item;
  if (id && store.count() < ITEM[id].need) {
    buzz('warn');
    notify(`${ITEM[id].need - store.count()}일 더 남기면 열려요`, { tone: 'warn' });
    b.classList.remove('is-shake');
    void b.offsetWidth;
    b.classList.add('is-shake');
    return;
  }
  const next = id ? toggleWear(wearing(), id) : [];
  if (!store.setMeta('wear', next)) {
    notify('저장 공간이 부족해 바꾸지 못했어요', { tone: 'warn' });
    return;
  }
  buzz('select');
  renderWear();
  renderCloset();
  if (!reducedMotion()) {
    const st = $('#closet-stage .closet-stage__in');
    st.classList.add('is-pop');
  }
  if (app.tab === 'today') scene.react();
});

// ================================================================ 매일 알림 (앱)
const remindSheet = createSheet($('#remind-sheet'), {
  onClose: () => {
    const r = store.getMeta('remind') || {};
    if (!r.asked) {
      store.setMeta('remind', { ...r, on: false, asked: true });
      notify('설정에서 언제든 알림을 켤 수 있어요');
    }
    setTimeout(() => renderLetters({ announce: true }), 300);
  },
});
const remindPref = () => ({ on: false, h: 21, m: 0, asked: false, ...(store.getMeta('remind') || {}) });
const timeVal = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const parseTime = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(v || '');
  return m ? { h: Math.min(23, Number(m[1])), m: Math.min(59, Number(m[2])) } : null;
};

let askTimer = 0;
/** 아직 묻지 않았으면 한가할 때 한 번만 묻는다(입력 중·다른 시트·소개·축하 중이면 기다렸다가). 물을 예정이면 true */
function maybeAskRemind({ delay = 0 } = {}) {
  if (!N.remindAvailable()) return false;
  const r0 = remindPref();
  if (r0.asked || store.count() < 1) return false;
  clearTimeout(askTimer);
  let tries = 0;
  const busy = () => isTextFocused() || document.documentElement.classList.contains('has-sheet') || intro.open || app.tab !== 'today' || app.celebrating;
  const attempt = () => {
    if (remindPref().asked) return;
    if (busy()) {
      if (++tries < 40) askTimer = setTimeout(attempt, 1500);
      return;
    }
    openRemindAsk();
  };
  askTimer = setTimeout(attempt, delay);
  return true;
}
function openRemindAsk() {
  const r = remindPref();
  if (r.asked) return false;
  // 지금 시각이 저녁(19~23시)이면 그 시각을 30분 단위로, 아니면 밤 9시를 권한다
  const now = new Date();
  let h = 21;
  let m = 0;
  if (now.getHours() >= 19 && now.getHours() <= 23) { h = now.getHours(); m = now.getMinutes() < 30 ? 0 : 30; }
  $('#remind-time').value = timeVal(h, m);
  $('#remind-art').innerHTML = friendSVG('sunny', 150, wearing());
  remindSheet.open();
  return true;
}

async function turnRemindOn(h, m, { fromSheet = false } = {}) {
  const perm = await N.remindPermission({ ask: true });
  if (perm !== 'granted') {
    store.setMeta('remind', { ...remindPref(), on: false, asked: true, h, m });
    notify('알림이 허용되지 않았어요. 휴대폰 설정에서 바꿀 수 있어요', { tone: 'warn', duration: 4200 });
    if (!fromSheet) renderSettingsIfOpen({ denied: true });
    return false;
  }
  store.setMeta('remind', { on: true, asked: true, h, m });
  await scheduleRemind();
  notify(`매일 ${hm(h, m)}에 몽글이가 불러 드릴게요`);
  return true;
}

/**
 * 앞으로 28일 알림을 다시 건다(오늘 이미 기록했거나 시각이 지났으면 오늘은 뺀다).
 * 앱을 열 때마다 다시 거니, 한동안 안 열어도 4주 동안은 불러 준다(그 뒤에는 조르지 않는다).
 * 아이폰은 예약 알림이 64개까지라 28개면 넉넉하다.
 */
const REMIND_DAYS = 28;
async function scheduleRemind() {
  if (!N.remindAvailable()) return;
  const r = remindPref();
  if (!r.on) { await N.cancelReminders(); return; }
  const now = new Date();
  const items = [];
  const ds = D.getDayStart();
  const bday = store.getMeta('birthday') || '';
  for (let i = 0; i < REMIND_DAYS; i++) {
    const d = D.addDays(D.today(), i); // 기록하는 날
    // 하루가 바뀌는 시각(새벽 4시) 전으로 정했으면 그 기록하는 날의 '밤'(다음 날 새벽)에 울린다
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (r.h < ds ? 1 : 0), r.h, r.m, 0);
    if (at <= now) continue;
    if (store.getEntry(D.keyOf(d))) continue;
    items.push({ at, body: remindText(d, { birthday: bday }) });
  }
  await N.scheduleReminders(items, { actions: REMIND_ACTIONS });
}
// 알림을 길게 누르면 나오는 버튼: 앱을 열면서 바로 기록
const REMIND_ACTIONS = [{ id: 'sunny', title: '☀️ 맑음' }, { id: 'cloudy', title: '☁️ 구름' }, { id: 'rain', title: '🌧️ 비' }];

$('#remind-yes').addEventListener('click', async (ev) => {
  const btn = ev.currentTarget; // await 뒤에는 ev.currentTarget이 비어 있다
  const t = parseTime($('#remind-time').value) || { h: 21, m: 0 };
  btn.disabled = true;
  try {
    await turnRemindOn(t.h, t.m, { fromSheet: true });
  } finally {
    btn.disabled = false;
    remindSheet.close();
  }
});
$('#remind-no').addEventListener('click', () => remindSheet.close());

// ================================================================ 설정
const settingsSheet = createSheet($('#settings-sheet'), { onOpen: () => renderSettings() });
$('#settings-btn').addEventListener('click', () => { buzz('select'); settingsSheet.open(); });
const renderSettingsIfOpen = (o) => settingsSheet.isOpen && renderSettings(o);

function renderSettings({ denied = false } = {}) {
  $('#install-row').hidden = NATIVE || install.isStandalone();
  ['#ios-install-guide', '#other-install-guide', '#inapp-install-guide'].forEach((s) => { $(s).hidden = true; });
  const inApp = install.inAppBrowser();
  $('#install-sub').textContent = inApp ? `${inApp} 밖의 브라우저에서 추가해요` : install.isIOS() ? '두 번만 누르면 끝' : '앱처럼 홈 화면에서 바로 열어요';
  $('#data-count').textContent = `기록 ${store.count()}일 · 이 기기에만 저장`;
  const lb = store.getMeta('lastBackup');
  $('#backup-sub').textContent = lb ? `마지막 백업 ${D.fmtMD(D.parseKey(lb))} · 파일로 보관` : '아직 백업한 적 없어요 · 파일로 보관';
  $('#ios-evict-warn').hidden = NATIVE || !(install.isIOS() && !install.isStandalone() && store.count() > 0);
  $('#reset-confirm-row').hidden = true;
  const n = store.count();
  const nx = nextItem(n);
  $('#closet-sub').textContent = `${unlockedBy(n).length}/${ITEMS.length} 열림${nx ? ` · ${nx.need - n}일 뒤 '${nx.name}'` : ' · 모두 모았어요'}`;
  // 알림
  const canRemind = N.remindAvailable();
  $('#remind-row').hidden = !canRemind;
  const r = remindPref();
  $('#remind-toggle').checked = !!r.on;
  $('#remind-time-row').hidden = !canRemind || !r.on;
  $('#remind-time-set').value = timeVal(r.h, r.m);
  $('#remind-sub').textContent = r.on ? `매일 ${hm(r.h, r.m)}에 물어봐요 · 기록한 날은 쉬어요` : '정한 시간에 몽글이가 물어봐요';
  $('#remind-denied').hidden = !denied;
  // 휴대폰 설정에서 알림을 껐으면 앱 설정도 꺼진 것으로 보이게
  if (canRemind && r.on && !denied) {
    N.remindPermission().then((p) => {
      if (p !== 'denied' || !remindPref().on) return;
      store.setMeta('remind', { ...remindPref(), on: false });
      N.cancelReminders();
      if (settingsSheet.isOpen) renderSettings({ denied: true });
    });
  }
  // 글자 크기
  const fs = String(Number(store.getMeta('fontScale')) || 1);
  $$('.seg__btn[data-font]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.font === fs)));
  // 바탕 색 · 차분하게 · 하루가 바뀌는 시각 · 생일
  const pv = store.getMeta('paper') || '';
  $$('.swatch[data-paper]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.paper === pv)));
  $('#calm-toggle').checked = isCalm();
  const dsv = String(D.getDayStart());
  $$('.seg__btn[data-daystart]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.daystart === dsv)));
  $('#daystart-sub').textContent = D.getDayStart() ? `새벽 ${D.getDayStart()}시 전 기록은 전날로 남겨요` : '밤 12시에 새날이 시작돼요';
  const bd = store.getMeta('birthday') || '';
  const [bm, bdd] = bd ? bd.split('-').map(Number) : [0, 0];
  $('#bday-m').value = bm ? String(bm) : '';
  $('#bday-d').value = bdd ? String(bdd) : '';
  $('#bday-sub').textContent = bd ? `${bm}월 ${bdd}일 · 몽글이가 그날 축하해 줘요` : '몽글이가 그날 축하해 줘요 (선택)';
  // 진동
  $('#haptics-row').hidden = !N.hapticsAvailable();
  $('#haptics-toggle').checked = store.getMeta('haptics') !== false;
  $('#app-version').textContent = APP.version;
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
install.onInstallChange(() => renderSettingsIfOpen());

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

$('#remind-toggle').addEventListener('change', async (ev) => {
  const el = ev.currentTarget; // await 뒤에는 ev.currentTarget이 비어 있다
  const on = el.checked;
  const r = remindPref();
  if (on) {
    const ok = await turnRemindOn(r.h, r.m);
    if (!ok) el.checked = false;
  } else {
    store.setMeta('remind', { ...r, on: false, asked: true });
    await N.cancelReminders();
    notify('매일 알림을 껐어요');
  }
  renderSettings({ denied: on && !remindPref().on });
});
$('#remind-time-set').addEventListener('change', async (ev) => {
  const t = parseTime(ev.currentTarget.value);
  if (!t) return;
  store.setMeta('remind', { ...remindPref(), h: t.h, m: t.m });
  await scheduleRemind();
  renderSettings();
  notify(`매일 ${hm(t.h, t.m)}에 알려 드릴게요`);
});

$$('.seg__btn[data-font]').forEach((b) => b.addEventListener('click', () => {
  store.setMeta('fontScale', Number(b.dataset.font));
  applyPrefs();
  buzz('select');
  renderSettings();
}));
$$('.swatch[data-paper]').forEach((b) => b.addEventListener('click', () => {
  store.setMeta('paper', b.dataset.paper);
  applyPrefs();
  setTheme(store.getEntry(app.todayK)?.w);
  buzz('select');
  renderSettings();
}));
$('#calm-toggle').addEventListener('change', (ev) => {
  store.setMeta('calm', ev.currentTarget.checked);
  applyPrefs();
  notify(ev.currentTarget.checked ? '차분하게: 축하 효과와 몽글이 말을 줄였어요' : '몽글이가 다시 신나게 반겨요');
});
$$('.seg__btn[data-daystart]').forEach((b) => b.addEventListener('click', () => {
  const h = Number(b.dataset.daystart);
  store.setMeta('dayStart', h);
  D.setDayStart(h);
  buzz('select');
  if (!checkDayChange()) refreshAll();
  renderSettings();
}));
// 생일: 월·일만(연도는 받지 않는다)
(() => {
  const ms = $('#bday-m');
  const ds = $('#bday-d');
  for (let i = 1; i <= 12; i++) ms.insertAdjacentHTML('beforeend', `<option value="${i}">${i}월</option>`);
  for (let i = 1; i <= 31; i++) ds.insertAdjacentHTML('beforeend', `<option value="${i}">${i}일</option>`);
  const onChange = () => {
    const mm = Number(ms.value);
    const dd = Number(ds.value);
    if (!ms.value && !ds.value) {
      store.setMeta('birthday', '');
      renderSettings();
      scheduleRemind();
      return;
    }
    if (!mm || !dd) return; // 둘 다 고를 때까지 기다린다
    const max = new Date(2024, mm, 0).getDate(); // 2월 29일까지 허용
    const d2 = Math.min(dd, max);
    store.setMeta('birthday', `${mm}-${d2}`);
    renderSettings();
    scheduleRemind();
    notify(`${mm}월 ${d2}일, 기억해 둘게요!`);
  };
  ms.addEventListener('change', onChange);
  ds.addEventListener('change', onChange);
})();
$('#haptics-toggle').addEventListener('change', (ev) => {
  store.setMeta('haptics', ev.currentTarget.checked);
  applyPrefs();
  if (ev.currentTarget.checked) buzz('success');
});

$('#backup-export').addEventListener('click', (ev) => withBusy(ev.currentTarget, async () => {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const name = `기분날씨-백업-${app.todayK}.json`;
  if (NATIVE) {
    const r = await N.shareFile(blob, name, { title: '기분날씨 백업' });
    if (r === 'shared') {
      store.setMeta('lastBackup', app.todayK);
      renderSettingsIfOpen();
      notify(`기록 ${store.count()}일을 백업 파일로 보냈어요`);
    } else if (r !== 'cancel') notify('백업 파일을 만들지 못했어요. 다시 시도해 주세요', { tone: 'warn' });
    return;
  }
  const inApp = install.inAppBrowser();
  if (inApp) {
    notify(`${inApp} 안에서는 파일을 저장할 수 없어요. ⋯ 메뉴 → 다른 브라우저로 열기에서 백업해 주세요`, { tone: 'warn', duration: 5200 });
    return;
  }
  if (install.isIOS() && install.isStandalone()) {
    const r = await N.shareFile(blob, name, { title: '기분날씨 백업' });
    if (r === 'shared') {
      store.setMeta('lastBackup', app.todayK);
      renderSettingsIfOpen();
      notify(`기록 ${store.count()}일을 백업 파일로 보냈어요`);
      return;
    }
    if (r === 'cancel') return;
  }
  downloadBlob(blob, name);
  store.setMeta('lastBackup', app.todayK);
  renderSettingsIfOpen();
  notify(`기록 ${store.count()}일을 백업 파일로 저장했어요`);
}));
$('#backup-import-btn').addEventListener('click', () => $('#backup-import').click());

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
  } else if (r.ok && r.meta) {
    notify('설정과 옷장을 되살렸어요');
  } else if (r.ok && r.future && !r.kept) {
    notify('미래 날짜 기록만 들어 있어 불러오지 않았어요', { tone: 'warn' });
  } else if (r.ok) {
    notify(r.kept ? '지금 기록이 모두 더 최근이라 그대로 뒀어요' : '이미 다 들어 있는 기록이에요');
  } else if (r.reason === 'empty') notify('불러올 기록이 없는 파일이에요', { tone: 'warn' });
  else if (r.reason === 'parse') notify('기분날씨 백업 파일이 아니에요', { tone: 'warn' });
  else notify('저장 공간이 부족해 불러오지 못했어요', { tone: 'warn' });
  refreshAll();
});

$('#reset-all').addEventListener('click', () => { $('#reset-confirm-row').hidden = false; buzz('warn'); });
$('#reset-cancel').addEventListener('click', () => { $('#reset-confirm-row').hidden = true; });
$('#reset-confirm').addEventListener('click', () => {
  const ok = store.clearAll();
  if (ok) N.cleanupCache();
  $('#reset-confirm-row').hidden = true;
  notify(ok ? '모든 기록을 지웠어요' : '지우지 못했어요. 다시 시도해 주세요', { tone: ok ? '' : 'warn' });
  refreshAll();
});

// 정보: 개인정보처리방침 · 도움말 · 라이선스
const infoSheet = createSheet($('#info-sheet'));
$$('[data-info]').forEach((b) => b.addEventListener('click', () => {
  const it = INFO[b.dataset.info];
  if (!it) return;
  $('#info-kicker').textContent = it.kicker;
  $('#info-title').textContent = it.title;
  $('#info-body').innerHTML = it.html();
  $('#info-body').scrollTop = 0;
  infoSheet.open();
  const pre = $('#license-ofl');
  if (pre) {
    fetch('fonts/LICENSE-Pretendard.txt').then((r) => (r.ok ? r.text() : Promise.reject())).then((t) => { pre.textContent = t; })
      .catch(() => { pre.textContent = 'SIL Open Font License, Version 1.1 — https://openfontlicense.org'; });
  }
}));
$('#info-body').addEventListener('click', (ev) => {
  const a = ev.target.closest('a[data-ext]');
  if (!a) return;
  if (a.href.startsWith('mailto:')) return; // 메일 앱은 기본 동작
  ev.preventDefault();
  N.openExternal(a.href);
});

function refreshAll() {
  const e = store.getEntry(app.todayK);
  const w = e ? e.w : null;
  if (scene.weather !== w) scene.set(w, { instant: app.tab !== 'today' });
  applyPrefs();
  renderToday({ talk: true });
  if (app.tab === 'calendar') renderCalendar();
  if (app.tab === 'forecast') renderForecast();
  renderSettingsIfOpen();
  if (daySheet.isOpen && !app.sheetEditing) renderDay();
  if (closetSheet.isOpen) renderCloset();
  scheduleRemind();
}

// 다른 창(설치한 앱·브라우저 탭)에서 바뀌면 화면도 맞춘다
store.subscribe((c) => { if (c.type === 'external') refreshAll(); });

// ================================================================ 날짜가 바뀌면 (자정을 넘겨 켜 둔 경우 · 앱 복귀)
function checkDayChange() {
  const k = D.todayKey();
  if (k === app.todayK) return false;
  const prevK = app.todayK;
  const draft = store.cleanMemo(app.memoDraft || '');
  app.todayK = k;
  app.memoDraft = null;
  if (draft) {
    const pe = store.getEntry(prevK);
    if (pe && pe.m !== draft && store.setEntry(prevK, { m: draft })) notify(`쓰던 메모는 ${D.fmtMD(D.parseKey(prevK))} 기록에 남겼어요`);
    else if (!pe) app.memoDraft = draft; // 어제 기록이 없으면 새날 메모칸에 그대로 둔다
  }
  app.fcMonday = D.mondayOf(D.today());
  app.calMonth = new Date(D.today().getFullYear(), D.today().getMonth(), 1);
  const e = store.getEntry(k);
  scene.set(e ? e.w : null, { instant: true });
  $('#feel-chips').dataset.w = '';
  refreshAll();
  if (!e && app.tab === 'today') say(greetLine(new Date(), greetCtx()), { instant: true });
  return true;
}
const onWake = () => {
  if (!checkDayChange()) scheduleRemind();
  document.body.dataset.phase = phaseNow();
};
setInterval(() => {
  checkDayChange();
  document.body.dataset.phase = phaseNow();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onWake();
});
N.onResume(onWake);

// ================================================================ 처음 소개
const intro = {
  el: $('#intro'),
  i: 0,
  get open() { return !this.el.hidden; },
};
function introArt() {
  $$('.intro__art', intro.el).forEach((a) => {
    const w = a.dataset.art;
    if (w === 'week') {
      const ws = ['sunny', 'cloudy', 'rain', 'sunny', 'rainbow', 'snow', 'sunny'];
      a.innerHTML = `<div class="intro-week"><div class="intro-week__top"><b>나의 기분 일기예보</b><span>맑음 지수 72</span></div>
        <div class="intro-week__days">${ws.map((x, i) => `<span style="${toneStyle(x)}"><small>${D.DOW[(i + 1) % 7]}</small>${icon(x)}</span>`).join('')}</div>
        <div class="intro-week__gift">${friendSVG('rainbow', 120, 'flowers')}<span class="intro-week__tag">선물 도착!</span></div></div>`;
    } else {
      const bubble = a.querySelector('.intro__bubble');
      a.innerHTML = sceneSVG(w, { ratio: 1.25, top: 40 });
      if (bubble) a.appendChild(bubble);
    }
  });
}
function introGo(i) {
  intro.i = Math.max(0, Math.min(2, i));
  if (intro.i === 2) paintIntroPrefs();
  $$('.intro__slide', intro.el).forEach((s, j) => {
    s.classList.toggle('is-on', j === intro.i);
    s.setAttribute('aria-hidden', String(j !== intro.i));
  });
  $$('.intro__dots i', intro.el).forEach((d, j) => d.classList.toggle('is-on', j === intro.i));
  $('#intro-next').textContent = intro.i === 2 ? '시작하기' : '다음';
}
function introFinish() {
  try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* 저장 못 해도 진행 */ }
  intro.el.classList.add('is-leaving');
  buzz('success');
  setTimeout(() => {
    intro.el.hidden = true;
    intro.el.classList.remove('is-leaving');
    document.documentElement.classList.remove('has-intro');
    scene.setActive(app.tab === 'today');
    say(greetLine(new Date(), greetCtx()));
    const first = $('#today-picker .wbtn');
    if (first) first.focus({ preventScroll: true });
  }, reducedMotion() ? 0 : 380);
}
function needIntro() {
  let done = false;
  try { done = localStorage.getItem(INTRO_KEY) === '1'; } catch { done = true; }
  return !done && store.count() === 0;
}
function paintIntroPrefs() {
  const fs = String(store.getMeta('fontScale') ?? 1);
  $$('[data-ifont]', intro.el).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ifont === fs)));
  $$('[data-icalm]', intro.el).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.icalm === (isCalm() ? '1' : '0'))));
}
$$('[data-ifont]', intro.el).forEach((b) => b.addEventListener('click', () => {
  store.setMeta('fontScale', Number(b.dataset.ifont));
  applyPrefs();
  buzz('select');
  paintIntroPrefs();
}));
$$('[data-icalm]', intro.el).forEach((b) => b.addEventListener('click', () => {
  store.setMeta('calm', b.dataset.icalm === '1');
  applyPrefs();
  buzz('select');
  paintIntroPrefs();
}));
$('#intro-next').addEventListener('click', () => {
  buzz('select');
  if (intro.i >= 2) introFinish();
  else introGo(intro.i + 1);
});
$('#intro-skip').addEventListener('click', () => introFinish());
(() => {
  const t = $('#intro-track');
  let x0 = null;
  t.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  t.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) { if (intro.i >= 2) introFinish(); else introGo(intro.i + 1); } else introGo(intro.i - 1);
  }, { passive: true });
})();

// ================================================================ 안드로이드 뒤로 가기
N.onBack(() => {
  if (intro.open) {
    if (intro.i > 0) { introGo(intro.i - 1); return true; }
    return false;
  }
  if (closeTopSheet()) return true;
  if (app.tab !== 'today') { showTab('today'); return true; }
  return false;
});

// ================================================================ 알림에서 바로 기록
N.onReminderAction((id) => {
  checkDayChange();
  if (intro.open) return;
  if (app.tab !== 'today') showTab('today');
  if (!WEATHER_IDS.includes(id)) return;
  const e = store.getEntry(app.todayK);
  if (!e || e.w !== id) pickToday(id);
  setTimeout(() => notify(`알림에서 ${W[id].name}${ro(W[id].name)} 남겼어요. 메모도 써 볼까요?`), 400);
});

// ================================================================ 시작
(function boot() {
  const e = store.getEntry(app.todayK);
  history.replaceState({ tab: null }, '');
  renderToday();
  if (needIntro()) {
    introArt();
    introGo(0);
    intro.el.hidden = false;
    document.documentElement.classList.add('has-intro');
    scene.setActive(false);
  }
  if (e) {
    scene.set(e.w, { instant: true });
    say(todayLine(), { instant: true });
  } else {
    const sc = $('#scene');
    sc.classList.add('pre');
    scene.set(null, { instant: true });
    $('#talk-live').textContent = '';
    setTimeout(() => sc.classList.remove('pre'), 360);
    if (!intro.open) greetT = setTimeout(() => say(todayLine()), 700);
  }
  if (store.loadProblem === 'corrupt') {
    notify('저장된 기록을 읽지 못했어요. 원본은 따로 보관해 두었어요', { tone: 'warn', duration: 6000 });
  } else if (store.loadProblem === 'unavailable') {
    notify('이 브라우저에선 기록을 저장할 수 없어요 (사생활 보호 모드인가요?)', { tone: 'warn', duration: 6000 });
  }
  if (store.count() > 0) store.requestPersistence();
  if (!NATIVE && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[기분날씨] 서비스 워커 등록 실패', err));
  }
  if (store.loadProblem === 'newer') {
    notify('새 버전에서 쓴 기록이에요. 앱을 업데이트하면 이어서 쓸 수 있어요', { tone: 'warn', duration: 6000 });
  }
  if (NATIVE) {
    N.setupChrome();
    N.appInfo().then((info) => { if (info && info.version) APP.version = info.version; });
    scheduleRemind();
    N.cleanupCache();
    requestAnimationFrame(() => N.hideSplash());
    if (!intro.open) maybeAskRemind({ delay: 2500 });
  }
})();
