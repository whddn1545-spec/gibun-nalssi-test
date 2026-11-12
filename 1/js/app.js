// 기분날씨 앱의 화면과 동작

import { dowOf, formatDate, formatDateLong, hash, haptic, pad, parseKey, pick, rng, todayKey } from './util.js';
import * as store from './store.js';
import { AMBIENT, W, WEATHERS, tileGradient } from './weather.js';
import { iconSVG, UI } from './icons.js';
import { DAYLIGHT, SkyScene, timeOfDay } from './sky.js';
import { arrivedWeek, buildForecast, listWeeks, weekLabel } from './forecast.js';
import { CARD_W, cardBlob, paintCard } from './card.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const stage = $('#stage');

const ui = {
  tab: 'today',
  today: todayKey(),
  mode: 'pick', // pick → compose → done
  bloomed: false,
  announceBloom: false,
  cal: null,
};

let scene;
let chips = [];
const arch = $('#arch');
const picker = $('#picker');
const input = $('#memo-input');

/* ── 화면 크기와 키보드 ─────────────────────────────────────────────────── */
let baseH = 0;
let lastW = 0;
let layoutQueued = false;

function requestLayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => {
    layoutQueued = false;
    layoutArch();
    layoutChips();
    layoutForecast();
  });
}

function syncViewport() {
  const vv = window.visualViewport;
  if (vv && Math.abs(vv.scale - 1) > 0.01) return;
  const h = Math.round(vv ? vv.height : window.innerHeight);
  const w = Math.round(window.innerWidth);
  if (w !== lastW) {
    lastW = w;
    baseH = 0;
  }
  baseH = Math.max(baseH, h);
  root.style.setProperty('--vh', `${h}px`);
  // 창 크기만 줄어든 경우(PC, 화면 분할)는 키보드로 보지 않는다
  const typing = document.activeElement?.tagName === 'INPUT' && window.matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('kb-open', typing && baseH - h > 120);
  if (window.scrollY) window.scrollTo(0, 0);
  requestLayout();
}

function layoutArch() {
  const slot = $('#sky-slot');
  const sw = slot.clientWidth;
  const sh = slot.clientHeight;
  if (!sw || !sh) return;
  const availH = Math.max(110, sh - 6);
  const w = Math.min(sw - 6, Math.round(availH * 0.9), 372);
  const h = Math.min(availH, Math.round(w * 1.32));
  arch.style.setProperty('--aw', `${w}px`);
  arch.style.setProperty('--ah', `${h}px`);
  scene?.resize(w, h);
}

function layoutChips() {
  if (!chips.length) return;
  const W_ = picker.clientWidth;
  if (!W_) return;
  const styles = getComputedStyle(root);
  const chipH = parseFloat(styles.getPropertyValue('--chip-h')) || 86;
  const headH = 44;
  const isGrid = picker.dataset.mode === 'grid';
  const compact = document.body.classList.contains('kb-open');
  chips.forEach((c, i) => {
    let x;
    let y;
    let w;
    let h;
    let ic;
    if (isGrid) {
      const gap = 8;
      w = (W_ - gap * 3) / 4;
      h = chipH;
      x = (i % 4) * (w + gap);
      y = headH + Math.floor(i / 4) * (h + 8);
      ic = Math.min(46, chipH - (chipH < 60 ? 24 : 36));
    } else {
      const gap = Math.max(3, Math.min(7, (W_ - 8 * 36) / 7));
      w = h = Math.min(44, (W_ - gap * 7) / 8);
      x = i * (w + gap);
      y = compact ? 40 : 76;
      ic = w - 6;
    }
    c.style.setProperty('--x', `${x}px`);
    c.style.setProperty('--y', `${y}px`);
    c.style.setProperty('--w', `${w}px`);
    c.style.setProperty('--h', `${h}px`);
    c.style.setProperty('--ic', `${ic}px`);
  });
}

/* ── 테마 ───────────────────────────────────────────────────────────────── */
const ambLayers = $$('.amb');
let ambIndex = 0;
let lastAmbient = '';

function applyTheme({ instant = false } = {}) {
  const entry = store.get(ui.today);
  const id = entry ? entry.w : 'none';
  const tod = timeOfDay(new Date());
  const isNight = tod.night > 0.5;
  const def = AMBIENT[id];
  const colors = isNight ? def.night : def.day;
  root.dataset.theme = isNight || def.dark ? 'dark' : 'light';
  const css = `linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
  $('meta[name="theme-color"]').content = colors[0];
  if (css === lastAmbient) return;
  lastAmbient = css;
  const next = ambLayers[ambIndex ^ 1];
  const cur = ambLayers[ambIndex];
  next.style.background = css;
  if (instant) {
    next.style.transition = cur.style.transition = 'none';
    requestAnimationFrame(() => {
      next.style.transition = cur.style.transition = '';
    });
  }
  next.style.opacity = '1';
  cur.style.opacity = '0';
  ambIndex ^= 1;
}

function thunderFlash() {
  $('#thunder-flash').animate(
    [{ opacity: 0 }, { opacity: 0.2, offset: 0.1 }, { opacity: 0 }],
    { duration: 420, easing: 'ease-out' },
  );
  haptic([18, 50, 30]);
}

/* ── 오늘 ───────────────────────────────────────────────────────────────── */
function commentFor(id, key) {
  return pick(W[id].comments, rng(hash(`${key}${id}`)));
}

function gardenList() {
  return store.all().filter((e) => e.key !== ui.today || ui.bloomed);
}

function buildChips() {
  picker.innerHTML = '';
  chips = WEATHERS.map((w, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.w = w.id;
    b.style.setProperty('--i', i);
    b.setAttribute('aria-label', `${w.name}, ${w.feel}`);
    b.innerHTML = `<span class="ic">${iconSVG(w.id)}</span><span class="lb">${w.feel}</span>`;
    b.addEventListener('click', () => chooseWeather(w.id));
    picker.append(b);
    return b;
  });
}

function paintHeader() {
  $('#t-date').textContent = formatDate(ui.today);
  $('#t-dow').textContent = `${dowOf(ui.today)}요일`;
  const s = store.streak();
  const el = $('#t-streak');
  el.hidden = s < 2;
  if (s >= 2) el.innerHTML = `${UI.sun}<span><b>${s}</b>일째</span>`;
}

function paintToday() {
  const e = store.get(ui.today);
  if (!e && ui.mode !== 'pick') ui.mode = 'pick';
  $('#panel').dataset.mode = ui.mode;
  picker.dataset.mode = ui.mode === 'pick' ? 'grid' : 'row';
  layoutChips();
  const compose = ui.mode !== 'done';
  chips.forEach((c) => {
    const on = !!e && ui.mode !== 'pick' && c.dataset.w === e.w;
    c.classList.toggle('is-on', on);
    c.setAttribute('aria-pressed', on ? 'true' : 'false');
    c.tabIndex = compose ? 0 : -1;
  });
  input.tabIndex = ui.mode === 'compose' ? 0 : -1;
  $('.memo-go').tabIndex = ui.mode === 'compose' ? 0 : -1;
  $('#d-change').tabIndex = ui.mode === 'done' ? 0 : -1;
  $('#d-memo').tabIndex = ui.mode === 'done' ? 0 : -1;

  if (!e) {
    arch.querySelector('canvas').setAttribute('aria-label', '오늘의 하늘은 아직 비어 있어요');
    return;
  }
  const def = W[e.w];
  arch.querySelector('canvas').setAttribute('aria-label', `오늘의 하늘: ${def.name}`);
  $('#c-name').textContent = def.name;
  $('#c-comment').textContent = commentFor(e.w, ui.today);
  input.placeholder = def.placeholder;
  input.maxLength = store.MEMO_MAX;
  $('#d-ic').innerHTML = iconSVG(e.w);
  $('#d-name').textContent = def.name;
  $('#d-feel').textContent = `${def.feel} · 마음 기온 ${def.temp}°`;

  const memoBtn = $('#d-memo');
  memoBtn.classList.toggle('is-empty', !e.memo);
  memoBtn.textContent = e.memo ? e.memo : '오늘을 한 줄로 남겨 볼까요?';

  const note = $('#d-note');
  const n = store.count();
  note.innerHTML = `${UI.flower}<span></span>`;
  note.querySelector('span').textContent = n === 1 ? '언덕에 첫 꽃이 피었어요' : `언덕에 꽃 ${n}송이가 피었어요`;
  if (canSuggestInstall()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '홈 화면에 추가';
    b.addEventListener('click', openInstall);
    note.append(b);
  }
}

function archPop() {
  arch.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.028)', offset: 0.32 }, { transform: 'scale(1)' }], {
    duration: 620,
    easing: 'cubic-bezier(.3,.8,.3,1)',
  });
}

function chooseWeather(id) {
  const e = store.get(ui.today);
  haptic(12);
  if (e && e.w === id && ui.mode === 'compose') return;
  if (ui.mode === 'pick') input.value = '';
  ui.mode = 'compose';
  store.set(ui.today, { w: id, memo: e?.memo || '' });
  saveCheck();
  scene.setWeather(id);
  archPop();
}

function finishToday() {
  const e = store.get(ui.today);
  if (!e) return;
  const memo = input.value;
  const firstBloom = !ui.bloomed;
  ui.mode = 'done';
  if (firstBloom) {
    ui.bloomed = true;
    ui.announceBloom = true;
  }
  store.set(ui.today, { w: e.w, memo });
  saveCheck();
  ui.announceBloom = false;
  scene.celebrate();
  archPop();
  haptic([8, 40, 8]);
  celebrateMilestone();
}

function celebrateMilestone() {
  const n = store.count();
  const label = { 7: '일주일', 30: '한 달', 100: '백 일', 365: '일 년' }[n];
  if (label && !store.flag(`milestone-${n}`)) {
    store.setFlag(`milestone-${n}`);
    toast(`${label}치 하늘이 모였어요. 나무가 한 뼘 자랐어요.`);
  }
}

function saveCheck(msg = '저장 공간이 부족해서 기록을 저장하지 못했어요.') {
  if (store.isWritable()) return true;
  toast(msg);
  return false;
}

function reopenCompose(focus) {
  const e = store.get(ui.today);
  if (!e) return;
  input.value = e.memo || '';
  ui.mode = 'compose';
  paintToday();
  if (focus) input.focus();
}

function bindToday() {
  $('#memo-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    // 입력창에서 포커스를 빼야 조합 중인 마지막 한글 글자까지 확정된다
    input.blur();
    setTimeout(finishToday, 0);
  });
  $('#d-change').addEventListener('click', () => reopenCompose(false));
  $('#d-memo').addEventListener('click', () => reopenCompose(true));
  input.addEventListener('blur', () => setTimeout(syncViewport, 60));
  const canvas = arch.querySelector('canvas');
  canvas.addEventListener('pointerdown', (ev) => {
    const r = canvas.getBoundingClientRect();
    scene.tap(ev.clientX - r.left, ev.clientY - r.top);
    haptic(6);
  });
  $('#arrival-banner').addEventListener('click', (ev) => openArrival(ev.currentTarget.dataset.mon));
}

/* ── 탭 ─────────────────────────────────────────────────────────────────── */
const TABS = ['today', 'calendar', 'forecast'];
const viewOf = (name) => $(`#view-${name}`);

function setTab(name) {
  if (name === ui.tab) return;
  const from = TABS.indexOf(ui.tab);
  const to = TABS.indexOf(name);
  const next = viewOf(name);
  const prev = viewOf(ui.tab);
  next.style.transition = 'none';
  next.dataset.side = to > from ? 'right' : 'left';
  void next.offsetWidth;
  next.style.transition = '';
  prev.dataset.side = to > from ? 'left' : 'right';
  prev.classList.remove('is-active');
  prev.inert = true;
  next.classList.add('is-active');
  next.inert = false;
  delete next.dataset.side;
  ui.tab = name;

  $$('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  $('#tabbar').style.setProperty('--tab', to);
  $('#tab-ind').style.setProperty('--tab', to);

  if (name === 'today') scene.start();
  else scene.stop();
  if (name === 'calendar') renderCalendar('up');
  if (name === 'forecast') {
    layoutForecast();
    renderForecast();
  }
  haptic(6);
}

/* ── 달력 ───────────────────────────────────────────────────────────────── */
function currentMonth() {
  const d = parseKey(ui.today);
  return { y: d.getFullYear(), m: d.getMonth() };
}

function renderCalendar(enter = '') {
  const { y, m } = ui.cal;
  const now = currentMonth();
  $('#cal-year').textContent = `${y}년`;
  $('#cal-month').textContent = `${m + 1}월`;
  $('#cal-next').disabled = y === now.y && m === now.m;

  const grid = $('#cal-grid');
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const frag = document.createDocumentFragment();
  for (let i = 0; i < first; i++) frag.append(document.createElement('span'));
  const monthEntries = [];
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    const e = store.get(key);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day';
    b.dataset.key = key;
    b.style.setProperty('--i', d + first);
    const future = key > ui.today;
    if (future) {
      b.disabled = true;
      b.classList.add('is-future');
    } else if (e) {
      b.classList.add('has');
      monthEntries.push(e);
    } else {
      b.classList.add('is-empty');
    }
    if (key === ui.today) b.classList.add('is-today');
    const tileStyle = e ? ` style="background:${tileGradient(e.w)}"` : '';
    const inner = e ? iconSVG(e.w, { animated: false }) : key === ui.today ? `<span class="tile-plus">${UI.plus}</span>` : '';
    b.innerHTML = `<span class="tile"${tileStyle}>${inner}</span><span class="num">${d}</span>`;
    const name = e ? `${W[e.w].name}${e.memo ? ', 메모 있음' : ''}` : future ? '아직 오지 않은 날' : '기록 없음';
    b.setAttribute('aria-label', `${m + 1}월 ${d}일, ${name}`);
    if (!future) b.addEventListener('click', () => openDaySheet(key));
    frag.append(b);
  }
  grid.replaceChildren(frag);
  grid.classList.remove('enter-l', 'enter-r', 'enter-up');
  if (enter) {
    void grid.offsetWidth;
    grid.classList.add(`enter-${enter}`);
  }
  paintSummary(monthEntries);
}

function paintSummary(list) {
  const box = $('#cal-summary');
  if (!list.length) {
    box.innerHTML = '<div class="cal-sum-row"><span>기록을 남기면 창문에 그날의 하늘이 켜져요</span></div>';
    return;
  }
  const counts = {};
  list.forEach((e) => (counts[e.w] = (counts[e.w] || 0) + 1));
  const order = Object.entries(counts).sort((a, b) => b[1] - a[1] || W[b[0]].temp - W[a[0]].temp);
  const avg = Math.round(list.reduce((s, e) => s + W[e.w].temp, 0) / list.length);
  const bar = order
    .map(([id, c]) => `<i style="flex:${c};background:${W[id].tile[0]}" title="${W[id].name} ${c}일"></i>`)
    .join('');
  box.innerHTML = `<div class="cal-sum-row"><span>가장 많았던 날씨 <b>${W[order[0][0]].name}</b></span><span>평균 마음 기온 <b>${avg}°</b></span></div><div class="cal-bar" aria-hidden="true">${bar}</div>`;
}

function moveMonth(delta) {
  const now = currentMonth();
  const d = new Date(ui.cal.y, ui.cal.m + delta, 1);
  if (d.getFullYear() > now.y || (d.getFullYear() === now.y && d.getMonth() > now.m)) return;
  ui.cal = { y: d.getFullYear(), m: d.getMonth() };
  renderCalendar(delta > 0 ? 'r' : 'l');
  haptic(6);
}

function bindCalendar() {
  $('#cal-prev').innerHTML = UI.chevL;
  $('#cal-next').innerHTML = UI.chevR;
  $('#cal-prev').addEventListener('click', () => moveMonth(-1));
  $('#cal-next').addEventListener('click', () => moveMonth(1));
  const wrap = $('#cal-wrap');
  let sx = 0;
  let sy = 0;
  let active = false;
  wrap.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
    active = true;
  });
  const end = (e) => {
    if (!active) return;
    active = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) moveMonth(dx < 0 ? 1 : -1);
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', () => (active = false));
}

/* ── 날짜 상세 ──────────────────────────────────────────────────────────── */
function openDaySheet(key) {
  const sh = openSheet('sheet-day');
  let entry = store.get(key);
  let editing = !entry;
  let draftW = entry?.w || null;
  let confirmDelete = false;

  sh.body.innerHTML = `
    <div class="arch ds-arch" style="--aw:150px;--ah:170px"><canvas role="img"></canvas></div>
    <div class="ds-date"></div>
    <div class="ds-content"></div>`;
  $('.ds-date', sh.body).textContent = `${formatDateLong(key)}${key === ui.today ? ' · 오늘' : ''}`;
  const canvas = $('canvas', sh.body);
  const sc = new SkyScene(canvas, { date: parseKey(key), tod: DAYLIGHT, seed: hash(key) % 9973 });
  sc.resize(150, 170);
  sc.setGrowth(store.count(), { instant: true });
  sc.setGarden(store.all().filter((e) => e.key <= key));
  sc.setWeather(draftW, { instant: true });
  sc.start();
  canvas.addEventListener('pointerdown', (ev) => {
    const r = canvas.getBoundingClientRect();
    sc.tap(ev.clientX - r.left, ev.clientY - r.top);
    haptic(6);
  });
  sh.onClose = () => sc.destroy();

  const content = $('.ds-content', sh.body);

  function paint() {
    canvas.setAttribute('aria-label', draftW ? `그날의 하늘: ${W[draftW].name}` : '기록이 없는 하늘');
    if (!editing && entry) {
      const def = W[entry.w];
      content.innerHTML = `
        <h2 class="ds-name"></h2>
        <p class="ds-feel"></p>
        <div class="ds-memo"></div>
        <div class="ds-actions">
          <button class="btn btn-glass" type="button" data-act="edit">고치기</button>
          <button class="btn btn-glass btn-danger" type="button" data-act="del">지우기</button>
        </div>`;
      $('.ds-name', content).textContent = def.name;
      $('.ds-feel', content).textContent = `${def.feel} · 마음 기온 ${def.temp}°`;
      const memo = $('.ds-memo', content);
      memo.classList.toggle('is-empty', !entry.memo);
      memo.textContent = entry.memo || '메모 없이 남긴 날이에요';
      $('[data-act="edit"]', content).addEventListener('click', () => {
        editing = true;
        paint();
      });
      $('[data-act="del"]', content).addEventListener('click', (ev) => {
        if (!confirmDelete) {
          confirmDelete = true;
          ev.currentTarget.textContent = '한 번 더 누르면 지워져요';
          return;
        }
        store.remove(key);
        haptic(14);
        if (saveCheck('저장 공간 문제로 지운 내용을 저장하지 못했어요.')) toast('기록을 지웠어요');
        sh.close();
      });
    } else {
      content.innerHTML = `
        <h2 class="ds-ask"></h2>
        <div class="ds-grid"></div>
        <input class="ds-input" type="text" enterkeyhint="done" aria-label="한 줄 메모" autocomplete="off">
        <div class="ds-actions"><button class="btn btn-ink" type="button" data-act="save">남기기</button></div>`;
      $('.ds-ask', content).textContent = key === ui.today ? '오늘의 하늘은 어때요?' : '이 날의 하늘은 어땠나요?';
      const grid = $('.ds-grid', content);
      const memoInput = $('.ds-input', content);
      memoInput.maxLength = store.MEMO_MAX;
      memoInput.value = entry?.memo || '';
      memoInput.placeholder = draftW ? W[draftW].placeholder : '날씨를 먼저 골라 주세요';
      const saveBtn = $('[data-act="save"]', content);
      const syncSave = () => {
        saveBtn.disabled = !draftW;
        saveBtn.style.opacity = draftW ? '' : '.4';
      };
      syncSave();
      WEATHERS.forEach((w) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `ds-chip${w.id === draftW ? ' is-on' : ''}`;
        b.setAttribute('aria-pressed', w.id === draftW ? 'true' : 'false');
        b.setAttribute('aria-label', `${w.name}, ${w.feel}`);
        b.innerHTML = `<span class="ic">${iconSVG(w.id)}</span>${w.feel}`;
        b.addEventListener('click', () => {
          draftW = w.id;
          $$('.ds-chip', grid).forEach((x) => {
            const on = x === b;
            x.classList.toggle('is-on', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          memoInput.placeholder = w.placeholder;
          sc.setWeather(w.id);
          syncSave();
          haptic(10);
        });
        grid.append(b);
      });
      const commit = () => {
        if (!draftW) return;
        memoInput.blur();
        setTimeout(() => {
          const isToday = key === ui.today;
          if (isToday) {
            if (!ui.bloomed) {
              ui.bloomed = true;
            }
            ui.mode = 'done';
            input.value = memoInput.value;
          }
          store.set(key, { w: draftW, memo: memoInput.value });
          saveCheck();
          entry = store.get(key);
          editing = false;
          confirmDelete = false;
          sc.setGarden(store.all().filter((e) => e.key <= key), { announce: true });
          sc.celebrate();
          haptic([8, 40, 8]);
          paint();
        }, 0);
      };
      saveBtn.addEventListener('click', commit);
      memoInput.addEventListener('keydown', (ev) => {
        // 한글 조합을 끝내는 Enter로는 저장하지 않는다
        if (ev.key === 'Enter' && !ev.isComposing && ev.keyCode !== 229) {
          ev.preventDefault();
          commit();
        }
      });
    }
  }
  paint();
}

/* ── 주간 예보 ──────────────────────────────────────────────────────────── */
let fcDirty = true;
let slides = [];
let activeSlide = 0;

function cardWidth() {
  return parseFloat(getComputedStyle(stage).getPropertyValue('--cw')) || 300;
}

function layoutForecast() {
  const body = $('#fc-body');
  const bw = body.clientWidth;
  const bh = body.clientHeight;
  if (!bw || !bh) return;
  const pad_ = parseFloat(getComputedStyle(body).paddingBottom) || 0;
  const maxH = bh - pad_ - 12 - 26 - 20 - 62;
  const w = Math.max(200, Math.min(bw - 48, Math.round(maxH * 0.8), 384));
  if (Math.abs(cardWidth() - w) > 0.5) {
    stage.style.setProperty('--cw', `${w}px`);
    slides.forEach((s) => (s.painted = false));
    paintVisibleSlides();
  }
}

function renderForecast() {
  if (!fcDirty) {
    paintVisibleSlides();
    return;
  }
  fcDirty = false;
  const weeks = listWeeks();
  const track = $('#fc-track');
  const has = weeks.length > 0;
  $('#fc-body').hidden = !has;
  $('#fc-empty').hidden = has;
  $('#fc-sub').textContent = has ? '한 주의 하늘을 기상 캐스터가 정리했어요' : '매주 일요일, 한 주의 하늘을 정리해 드려요';
  track.innerHTML = '';
  slides = weeks.slice(0, 16).map((mon) => {
    const fc = buildForecast(mon, ui.today);
    const el = document.createElement('div');
    el.className = 'fc-slide';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${weekLabel(mon, ui.today)} 예보: ${fc.headline}. ${fc.body} ${fc.outlook}`);
    const tag = document.createElement('span');
    tag.className = 'fc-tag';
    tag.textContent = `${weekLabel(mon, ui.today)}${fc.complete ? '' : ' · 작성 중'}`;
    el.append(canvas, tag);
    track.append(el);
    return { mon, fc, el, canvas, painted: false, blob: null };
  });
  $('#fc-dots').innerHTML = slides.length > 1 ? slides.map(() => '<i></i>').join('') : '';
  // 새로 도착한 카드가 있으면 그 카드부터, 이번 주 기록이 아직 적으면 다 만들어진 지난주 카드부터 보여 준다
  const arrived = arrivedWeek(ui.today);
  const arrivedAt = arrived ? slides.findIndex((s) => s.mon === arrived) : -1;
  if (arrivedAt >= 0) activeSlide = arrivedAt;
  else activeSlide = slides.length > 1 && !slides[0].fc.complete && slides[0].fc.n < 4 ? 1 : 0;
  if (arrived) {
    store.markSeen(arrived);
    updateArrival();
  }
  syncDots();
  layoutForecast();
  requestAnimationFrame(() => {
    track.scrollLeft = activeSlide * (cardWidth() + 14);
  });
  paintVisibleSlides();
}

let paintChain = Promise.resolve();
function paintSlide(s) {
  if (s.painted) return;
  s.painted = true;
  const px = Math.min(CARD_W, Math.round(cardWidth() * Math.min(3, window.devicePixelRatio || 1)));
  paintChain = paintChain.then(() => paintCard(s.canvas, s.fc, px)).catch((err) => {
    s.painted = false;
    console.error(err);
  });
}

function paintVisibleSlides() {
  [activeSlide, activeSlide + 1, activeSlide - 1].forEach((i) => {
    if (slides[i]) paintSlide(slides[i]);
  });
  prepareBlob(slides[activeSlide]);
}

// iOS는 버튼을 누른 직후에만 공유 창을 열어 주므로 이미지를 미리 만들어 둔다
function prepareBlob(s) {
  if (!s || s.blob) return s?.blob;
  s.blob = paintChain.then(() => cardBlob(s.fc));
  s.blob.catch(() => (s.blob = null));
  return s.blob;
}

function syncDots() {
  $$('#fc-dots i').forEach((d, i) => d.classList.toggle('on', i === activeSlide));
}

function bindForecast() {
  $('#fc-save').innerHTML = `${UI.download}<span>이미지 저장</span>`;
  $('#fc-share').innerHTML = `${UI.share}<span>친구에게 보내기</span>`;
  $('#fc-save').addEventListener('click', () => saveCard(slides[activeSlide]));
  $('#fc-share').addEventListener('click', () => shareCard(slides[activeSlide]));
  $('#fc-start').addEventListener('click', () => setTab('today'));
  const track = $('#fc-track');
  let t = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(t);
    t = requestAnimationFrame(() => {
      const step = cardWidth() + 14;
      const i = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / step)));
      if (i !== activeSlide) {
        activeSlide = i;
        syncDots();
        paintVisibleSlides();
        haptic(4);
      }
    });
  });
}

const fileNameFor = (s) => `기분날씨_예보_${s.mon}.png`;

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

let exporting = false;

async function saveCard(s) {
  if (!s || exporting) return;
  exporting = true;
  try {
    await saveCardNow(s);
  } catch {
    toast('이미지를 만들지 못했어요. 다시 눌러 주세요.');
  } finally {
    exporting = false;
  }
}

async function saveCardNow(s) {
  const blob = await prepareBlob(s);
  const file = new File([blob], fileNameFor(s), { type: 'image/png' });
  // iPhone에서는 공유 창의 '이미지 저장'이 사진 앱에 넣는 유일한 길이다
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (err) {
      if (err.name === 'AbortError') return;
      toast(err.name === 'NotAllowedError' ? '이미지를 준비했어요. 한 번 더 눌러 주세요.' : '저장하지 못했어요. 다시 눌러 주세요.');
    }
    return;
  }
  downloadBlob(blob, file.name);
  toast('이미지를 저장했어요');
}

async function shareCard(s) {
  if (!s || exporting) return;
  exporting = true;
  try {
    await shareCardNow(s);
  } catch {
    toast('이미지를 만들지 못했어요. 다시 눌러 주세요.');
  } finally {
    exporting = false;
  }
}

async function shareCardNow(s) {
  const blob = await prepareBlob(s);
  const file = new File([blob], fileNameFor(s), { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '나의 기분 일기예보' });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.name === 'NotAllowedError') {
        toast('이미지를 준비했어요. 한 번 더 눌러 주세요.');
        return;
      }
    }
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('이미지를 복사했어요. 대화창에 붙여넣어 보내 보세요.');
    return;
  } catch {
    /* 복사를 지원하지 않으면 파일로 저장한다 */
  }
  downloadBlob(blob, file.name);
  toast('이미지를 저장했어요. 친구에게 보내 보세요.');
}

function updateArrival() {
  const mon = arrivedWeek(ui.today);
  const banner = $('#arrival-banner');
  $('#tab-dot').hidden = !mon;
  banner.hidden = !mon;
  if (mon) {
    $('#arrival-text').textContent = `${weekLabel(mon, ui.today)} 기분 일기예보가 도착했어요`;
    banner.dataset.mon = mon;
  }
}

function openArrival(mon) {
  const fc = mon && buildForecast(mon, ui.today);
  if (!fc) return;
  store.markSeen(mon);
  updateArrival();
  const wrap = document.createElement('div');
  wrap.className = 'arrival';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', '도착한 기분 일기예보');
  const availH = stage.clientHeight - 230;
  const w = Math.max(200, Math.min(stage.clientWidth - 48, Math.round(availH * 0.8), 384));
  wrap.style.setProperty('--cw', `${w}px`);
  wrap.innerHTML = `
    <div class="arrival-bg"></div>
    <button class="arrival-close" type="button" aria-label="닫기">${UI.close}</button>
    <div class="arrival-label"></div>
    <div class="arrival-card"><canvas role="img"></canvas></div>
    <div class="arrival-acts">
      <button class="btn btn-glass" type="button" data-a="save">${UI.download}<span>저장</span></button>
      <button class="btn btn-ink" type="button" data-a="share">${UI.share}<span>친구에게 보내기</span></button>
    </div>`;
  $('.arrival-label', wrap).textContent = `${weekLabel(mon, ui.today)} 예보가 도착했어요`;
  const canvas = $('canvas', wrap);
  canvas.setAttribute('aria-label', `${fc.headline}. ${fc.body} ${fc.outlook}`);
  $('#sheets').append(wrap);

  const slide = { mon, fc, blob: null };
  setBackdropInert(true);
  $('.arrival-close', wrap).focus({ preventScroll: true });
  let closed = false;
  paintCard(canvas, fc, Math.min(CARD_W, Math.round(w * Math.min(3, window.devicePixelRatio || 1))))
    .then(() => {
      if (closed) return;
      requestAnimationFrame(() => wrap.classList.add('is-open'));
      haptic([10, 60, 10]);
      prepareBlob(slide);
    })
    .catch(() => close(false));

  history.pushState({ arrival: 1 }, '');
  const close = (fromPop) => {
    if (closed) return;
    closed = true;
    arrivalClose = null;
    wrap.classList.remove('is-open');
    setTimeout(() => wrap.remove(), 420);
    if (!sheetStack.length) setBackdropInert(false);
    if (!fromPop) {
      skipPop++;
      history.back();
    }
  };
  arrivalClose = close;
  $('.arrival-close', wrap).addEventListener('click', () => close(false));
  // 배너를 누른 손가락의 두 번째 탭이 배경에 떨어져 바로 닫히지 않게 잠깐 무시한다
  const openedAt = performance.now();
  $('.arrival-bg', wrap).addEventListener('click', () => {
    if (wrap.classList.contains('is-open') && performance.now() - openedAt > 450) close(false);
  });
  $('[data-a="save"]', wrap).addEventListener('click', () => saveCard(slide));
  $('[data-a="share"]', wrap).addEventListener('click', () => shareCard(slide));
}
let arrivalClose = null;

/* ── 시트 ───────────────────────────────────────────────────────────────── */
const sheetStack = [];
let skipPop = 0;

function setBackdropInert(on) {
  $('.views').inert = on;
  $('#tabbar').inert = on;
}

function openSheet(cls = '') {
  const wrap = document.createElement('div');
  wrap.className = `sheet-wrap ${cls}`;
  wrap.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet" role="dialog" aria-modal="true" tabindex="-1">
      <div class="sheet-grip"><i></i></div>
      <div class="sheet-body"></div>
    </div>`;
  $('#sheets').append(wrap);
  const sheet = $('.sheet', wrap);
  const body = $('.sheet-body', wrap);
  const prevFocus = document.activeElement;
  const api = { wrap, sheet, body, onClose: null, closed: false, prevFocus, close: () => closeSheet(api) };
  sheetStack.push(api);
  history.pushState({ sheet: sheetStack.length }, '');
  setBackdropInert(true);
  void wrap.offsetWidth;
  wrap.classList.add('is-open');
  sheet.focus({ preventScroll: true });
  const openedAt = performance.now();
  $('.sheet-backdrop', wrap).addEventListener('click', () => {
    if (performance.now() - openedAt > 380) api.close();
  });

  const grip = $('.sheet-grip', wrap);
  let startY = 0;
  let startT = 0;
  let dy = 0;
  let dragging = false;
  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = e.clientY;
    startT = e.timeStamp;
    dy = 0;
    sheet.style.transition = 'none';
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    const velocity = dy / Math.max(1, e.timeStamp - startT);
    if (dy > 110 || (dy > 36 && velocity > 0.7)) api.close();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  return api;
}

function closeSheet(api, { fromPop = false } = {}) {
  if (api.closed) return;
  api.closed = true;
  const i = sheetStack.indexOf(api);
  if (i >= 0) sheetStack.splice(i, 1);
  api.wrap.classList.remove('is-open');
  api.onClose?.();
  setTimeout(() => api.wrap.remove(), 460);
  if (!fromPop) {
    skipPop++;
    history.back();
  }
  if (!sheetStack.length) {
    setBackdropInert(false);
    api.prevFocus?.focus?.({ preventScroll: true });
  }
}

window.addEventListener('popstate', () => {
  if (skipPop > 0) {
    skipPop--;
    return;
  }
  if (arrivalClose) {
    arrivalClose(true);
    return;
  }
  const top = sheetStack[sheetStack.length - 1];
  if (top) closeSheet(top, { fromPop: true });
});

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (arrivalClose) {
    arrivalClose(false);
    return;
  }
  const top = sheetStack[sheetStack.length - 1];
  if (top) top.close();
});

/* ── 알림 문구 ──────────────────────────────────────────────────────────── */
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ── 설치 ───────────────────────────────────────────────────────────────── */
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  if (ui.mode === 'done') paintToday();
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  toast('홈 화면에 추가했어요');
  paintToday();
});

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canSuggestInstall = () => !isStandalone() && (!!installEvent || isIOS());

async function openInstall() {
  if (installEvent) {
    const ev = installEvent;
    installEvent = null;
    ev.prompt();
    await ev.userChoice.catch(() => null);
    paintToday();
    return;
  }
  const sh = openSheet('sheet-install');
  const steps = isIOS()
    ? ['Safari 아래쪽의 <b>공유 버튼</b>을 눌러요', '목록에서 <b>홈 화면에 추가</b>를 골라요', '오른쪽 위의 <b>추가</b>를 누르면 끝이에요']
    : ['브라우저 오른쪽 위의 <b>메뉴</b>를 열어요', '<b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 골라요', '<b>설치</b>를 누르면 끝이에요'];
  sh.body.innerHTML = `<h2 class="set-title">홈 화면에 두기</h2><ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>`;
}

/* ── 설정 ───────────────────────────────────────────────────────────────── */
function openSettings() {
  const sh = openSheet('sheet-settings');
  const installRow = isStandalone()
    ? ''
    : `<div class="set-group"><button class="set-row" type="button" data-s="install"><span>홈 화면에 추가<small>앱처럼 바로 열 수 있어요</small></span><span class="chev">${UI.chevR}</span></button></div>`;
  const demoRow = store.DEMO
    ? `<div class="set-group"><button class="set-row" type="button" data-s="exit-demo"><span>체험 모드 끝내기<small>내 진짜 기록으로 돌아가요</small></span><span class="chev">${UI.chevR}</span></button></div>`
    : '';
  sh.body.innerHTML = `
    <h2 class="set-title">설정</h2>
    ${demoRow}${installRow}
    <div class="set-group">
      <button class="set-row" type="button" data-s="export"><span>기록 내려받기<small>폰을 바꿀 때 쓰는 백업 파일이에요</small></span><span class="chev">${UI.chevR}</span></button>
      <button class="set-row" type="button" data-s="import"><span>기록 가져오기<small>백업 파일을 지금 기록과 합쳐요</small></span><span class="chev">${UI.chevR}</span></button>
    </div>
    <div class="set-group">
      <button class="set-row is-danger" type="button" data-s="clear"><span>모든 기록 지우기</span></button>
    </div>
    <p class="set-foot">기록은 이 기기에만 저장돼요.<br>어디로도 보내지 않아요.</p>
    <input type="file" accept=".json,application/json" hidden data-s="file">`;

  const file = $('[data-s="file"]', sh.body);
  $('[data-s="install"]', sh.body)?.addEventListener('click', () => {
    sh.close();
    setTimeout(openInstall, 60);
  });
  $('[data-s="exit-demo"]', sh.body)?.addEventListener('click', () => {
    location.href = location.pathname;
  });
  $('[data-s="export"]', sh.body).addEventListener('click', () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    downloadBlob(blob, `기분날씨_백업_${ui.today}.json`);
    toast('백업 파일을 내려받았어요');
  });
  $('[data-s="import"]', sh.body).addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const { added, updated } = store.importData(await f.text());
      if (saveCheck('저장 공간 문제로 가져온 기록을 저장하지 못했어요.')) toast(`${added + updated}일의 기록을 가져왔어요`);
    } catch {
      toast('이 파일은 기분날씨 백업이 아니에요');
    }
    file.value = '';
  });
  let armed = false;
  $('[data-s="clear"]', sh.body).addEventListener('click', (ev) => {
    if (!armed) {
      armed = true;
      ev.currentTarget.firstElementChild.textContent = '한 번 더 누르면 모두 지워져요';
      return;
    }
    store.clearAll();
    ui.bloomed = false;
    input.value = '';
    haptic(20);
    if (saveCheck('저장 공간 문제로 지운 내용을 저장하지 못했어요.')) toast('모든 기록을 지웠어요');
    sh.close();
  });
}

/* ── 데이터가 바뀌었을 때 ───────────────────────────────────────────────── */
function onStoreChange() {
  fcDirty = true;
  paintHeader();
  scene.setGrowth(store.count());
  scene.setGarden(gardenList(), { announce: ui.announceBloom });
  const e = store.get(ui.today);
  if (!e) ui.bloomed = false;
  // 다른 탭이나 백업 가져오기로 오늘 기록이 생긴 경우
  if (e && ui.mode === 'pick') {
    ui.mode = 'done';
    ui.bloomed = true;
    scene.setGarden(gardenList());
  }
  scene.setWeather(e?.w || null);
  applyTheme();
  paintToday();
  updateArrival();
  if (ui.tab === 'calendar') renderCalendar();
  if (ui.tab === 'forecast') renderForecast();
}

/* 앱을 켜 둔 채 자정을 넘겨도 새 날로 넘어간다 */
function checkDay() {
  const now = todayKey();
  if (now === ui.today) {
    applyTheme();
    return;
  }
  // 자정 무렵 메모를 쓰고 있으면 마칠 때까지 기다린다. 그 메모는 어제의 기록이다.
  if (ui.mode === 'compose' && document.activeElement === input) return;
  const prev = store.get(ui.today);
  if (ui.mode === 'compose' && prev && input.value.trim() && input.value !== prev.memo) {
    store.set(ui.today, { w: prev.w, memo: input.value });
  }
  ui.today = now;
  const e = store.get(now);
  ui.mode = e ? 'done' : 'pick';
  ui.bloomed = !!e;
  input.value = '';
  ui.cal = currentMonth();
  scene.setDate(new Date());
  onStoreChange();
  if (ui.tab !== 'today') scene.stop();
}

/* ── 시작 ───────────────────────────────────────────────────────────────── */
function boot() {
  store.load();
  root.classList.toggle('ios-standalone', isIOS() && isStandalone());
  ui.today = todayKey();
  ui.cal = currentMonth();
  const entry = store.get(ui.today);
  ui.mode = entry ? 'done' : 'pick';
  ui.bloomed = !!entry;

  buildChips();
  $('#btn-settings').innerHTML = UI.gear;
  $('#btn-settings').addEventListener('click', openSettings);
  const tabIcons = { today: UI.today, calendar: UI.calendar, forecast: UI.forecast };
  $$('.tab').forEach((t) => {
    $('.tab-ic', t).innerHTML = tabIcons[t.dataset.tab];
    t.addEventListener('click', () => setTab(t.dataset.tab));
  });
  $$('.view:not(.is-active)').forEach((v) => {
    v.inert = true;
    v.dataset.side = 'right';
  });

  $('#demo-pill').hidden = !store.DEMO;

  scene = new SkyScene($('#sky'), { onFlash: thunderFlash });
  syncViewport();
  layoutArch();
  layoutChips();

  scene.setGrowth(store.count(), { instant: true });
  scene.setGarden(gardenList());
  scene.setWeather(entry?.w || null, { instant: true });
  applyTheme({ instant: true });

  bindToday();
  bindCalendar();
  bindForecast();
  paintHeader();
  paintToday();
  updateArrival();
  scene.start();

  store.subscribe(onStoreChange);

  window.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  new ResizeObserver(requestLayout).observe($('#sky-slot'));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      scene.stop();
    } else {
      checkDay();
      if (ui.tab === 'today') scene.start();
    }
  });
  setInterval(checkDay, 30000);

  const show = () => stage.classList.add('booted');
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]).then(() => {
    requestAnimationFrame(show);
    requestLayout();
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    // 예전 버전이 깔린 기기는 새 버전이 준비되면 한 번만 다시 연다. 입력 중이거나 창이 열려 있으면 다음 실행 때 바뀐다.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading || document.activeElement === input || sheetStack.length || arrivalClose) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
