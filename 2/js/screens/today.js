// 오늘 화면: 날씨 고르기(누르거나 스르륵 밀기), 제목과 문장, 한 줄 메모.
// 고르는 즉시 저장되고, 하늘은 아래 하늘 엔진이 그린다. 이 파일은 글자와 버튼만 다룬다.

import { WEATHERS, WEATHER_IDS, iconURL, lineFor } from '../weather.js';

const TITLE_ASK = '오늘 마음의 날씨는?';
const SAVE_DELAY = 400;

export function mount(root, ctx) {
  const { store, ui } = ctx;
  const { el } = ui;

  // ── 뼈대 ──
  const dateEl = el('div', { class: 'today-date', id: 'today-date' });
  const countEl = el('div', { class: 'today-count', id: 'today-count' });
  const settingsBtn = el('button', {
    class: 'icon-btn glass today-settings pressable', id: 'btn-settings', type: 'button', 'aria-label': '설정',
    onclick: () => { ui.haptic('tap'); ctx.openSettings(); },
  });
  settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.5" cy="12" r="1.5"/></svg>';

  const titleEl = el('h1', { class: 'today-title', id: 'weather-title' }, TITLE_ASK);
  const lineEl = el('p', { class: 'today-line', id: 'weather-line' });

  const memo = el('input', {
    class: 'memo-input', id: 'memo-input', type: 'text', placeholder: '한 줄 남기기',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterKeyHint: 'done', 'aria-label': '오늘의 한 줄 메모',
  });
  memo.spellcheck = false;
  const memoWrap = el('div', { class: 'memo-wrap glass', inert: true }, memo);
  const hint = el('div', { class: 'slide-hint', 'aria-hidden': 'true' }, el('span', { class: 'slide-hint-text' }, '스르륵 밀어 보세요'), el('span', { class: 'slide-hint-track' }, el('span', { class: 'slide-hint-dot' })));

  const orbs = WEATHER_IDS.map((id) => el('button', {
    class: 'orb', type: 'button', role: 'radio', 'aria-checked': 'false', tabIndex: -1, dataset: { weather: id },
    'aria-label': `${WEATHERS[id].name}, ${WEATHERS[id].mood}`,
  }, el('span', { class: 'orb-disc glass' }, el('img', { src: iconURL(id), alt: '', width: 36, height: 36 })), el('span', { class: 'orb-name' }, WEATHERS[id].name)));
  orbs.forEach((orb) => {
    orb.style.setProperty('--c', `var(--c-${orb.dataset.weather})`);
    orb.querySelector('img').draggable = false;
  });
  const orbRow = el('div', { class: 'orbs', role: 'radiogroup', 'aria-label': '오늘 마음의 날씨' }, orbs);

  const today = el(
    'div', { class: 'today' },
    el('header', { class: 'today-top' }, el('div', { class: 'today-top-text' }, dateEl, countEl), settingsBtn),
    el('div', { class: 'today-head' }, titleEl, lineEl),
    el('div', { class: 'today-sky' }),
    el('div', { class: 'today-bottom', id: 'today-bottom' }, el('div', { class: 'memo-slot' }, hint, memoWrap), orbRow),
  );
  root.replaceChildren(today);

  // ── 상태 ──
  let dateKey = store.todayStr();
  let shownId = null; // 지금 제목에 보이는 날씨 (미리보기 포함)
  const swapAnim = new WeakMap();
  let saveTimer = 0;
  let pendingMemo = null; // { date, text }
  let dragging = false;
  let suppressClick = false;
  let hintTimer = 0;
  let activePointer = null; // 날씨 줄을 미는 첫 손가락의 pointerId (두 번째 손가락은 무시)

  const record = () => store.getRecord(dateKey);

  // 글자가 위로 살짝 떠오르며 바뀐다
  function swapText(node, text, { instant = false } = {}) {
    if (node.dataset.text === text) return;
    node.dataset.text = text;
    swapAnim.get(node)?.cancel();
    const set = () => { node.textContent = text; };
    if (instant || ui.prefersReducedMotion() || !node.isConnected || !node.textContent) {
      set();
      if (!instant && !ui.prefersReducedMotion() && node.isConnected) {
        node.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
      return;
    }
    const out = node.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 120, easing: 'ease-in', fill: 'forwards' });
    swapAnim.set(node, out);
    out.finished.then(() => {
      set();
      out.cancel();
      node.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.3,1.25,.5,1)' });
    }).catch(() => {});
  }

  function paintTexts(id, instant = false) {
    shownId = id;
    today.classList.toggle('is-chosen', Boolean(id));
    if (id) {
      swapText(titleEl, WEATHERS[id].name, { instant });
      swapText(lineEl, lineFor(id, dateKey), { instant });
    } else {
      swapText(titleEl, TITLE_ASK, { instant });
      swapText(lineEl, '', { instant: true });
    }
  }

  function paintOrbs(id) {
    orbs.forEach((orb, i) => {
      const on = orb.dataset.weather === id;
      orb.setAttribute('aria-checked', String(on));
      orb.tabIndex = on || (!id && i === 0) ? 0 : -1;
    });
  }

  function paintMeta() {
    dateEl.textContent = store.formatKo(dateKey);
    const total = store.getAll().length;
    countEl.textContent = total > 0 ? `하늘을 기록한 날 ${total}일` : '';
    countEl.classList.toggle('is-on', total > 0);
  }

  // 저장된 기록대로 화면을 맞춘다
  function render({ instant = false } = {}) {
    const rec = record();
    paintMeta();
    paintOrbs(rec?.weather ?? null);
    paintTexts(rec?.weather ?? null, instant);
    memoWrap.classList.toggle('is-in', Boolean(rec));
    memoWrap.inert = !rec;
    if (document.activeElement !== memo) memo.value = rec?.memo ?? '';
    if (rec) hideHint();
  }

  // ── 메모 저장 ──
  function queueMemo() {
    pendingMemo = { date: dateKey, text: memo.value };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushMemo, SAVE_DELAY);
  }

  const tidy = (text) => text.replace(/\s+/g, ' ').trim();

  function flushMemo() {
    clearTimeout(saveTimer);
    if (!pendingMemo) return;
    const { date } = pendingMemo;
    // 입력칸에 있는 가장 최신 글자를 저장한다 (날짜가 같을 때)
    const text = date === dateKey ? memo.value : pendingMemo.text;
    pendingMemo = null;
    if (store.getRecord(date)) store.setRecord(date, { memo: text });
  }

  // 이모지도 60자까지 입력되도록 글자 수가 아니라 사람이 보는 한 글자(조합 이모지 포함) 기준으로 자른다 (조합 중에는 자르지 않는다)
  function capMemo() {
    const clipped = store.clipMemo(memo.value);
    if (clipped !== memo.value) memo.value = clipped;
  }

  // 입력을 마칠 때 앞뒤 공백을 정리한다
  function tidyMemo() {
    if (pendingMemo && pendingMemo.date === dateKey) memo.value = tidy(memo.value);
  }

  memo.addEventListener('input', (e) => {
    if (!e.isComposing) capMemo();
    queueMemo();
  });
  memo.addEventListener('compositionend', () => { capMemo(); queueMemo(); });
  memo.addEventListener('blur', () => { tidyMemo(); flushMemo(); });
  memo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    tidyMemo();
    flushMemo();
    memo.blur();
  });
  // 앱을 닫거나 숨길 때 기다리던 메모를 바로 저장한다
  window.addEventListener('pagehide', flushMemo);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushMemo(); });

  // ── 고르기 ──
  function commit(id) {
    // 자정이 지났으면 새날 상태가 된 뒤에 저장한다
    ctx.syncDay?.();
    if (store.todayStr() !== dateKey) {
      flushMemo();
      dateKey = store.todayStr();
      memo.value = '';
    }
    const prev = record();
    if (prev?.weather === id) { render(); return; }
    flushMemo();
    store.setRecord(dateKey, { weather: id });
    ctx.sky.setWeather(id);
    ui.haptic('select');
    if (store.isPersistent?.() === false) ui.toast('이 브라우저에서는 저장되지 않아요', { duration: 3200 });
    else ui.toast(prev ? '오늘의 날씨를 바꿨어요' : '오늘의 날씨를 남겼어요');
    render();
    bounce(orbs[WEATHER_IDS.indexOf(id)]);
  }

  function bounce(orb) {
    if (!orb || ui.prefersReducedMotion()) return;
    orb.querySelector('.orb-disc').animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.32)', offset: 0.35 }, { transform: 'scale(1.12)' }],
      { duration: 520, easing: 'cubic-bezier(.3,1.25,.5,1)' },
    );
  }

  function preview(id) {
    ctx.sky.setWeather(id);
    paintTexts(id);
  }

  let cells = [];
  let lastNearest = -1;

  function nearestIndex(x) {
    let best = 0;
    let dist = Infinity;
    cells.forEach((c, i) => {
      const d = Math.abs(x - c.cx);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  }

  // 맥 독처럼 손가락 가까이 있는 버튼이 커진다
  function magnify(x) {
    const near = nearestIndex(x);
    const cell = cells[1] ? Math.abs(cells[1].cx - cells[0].cx) : 56;
    orbs.forEach((orb, i) => {
      const d = Math.abs(x - cells[i].cx) / cell;
      const s = 1 + 0.5 * Math.exp(-(d * d) / (2 * 0.62 * 0.62));
      orb.style.setProperty('--s', s.toFixed(3));
      orb.classList.toggle('is-near', i === near);
    });
    return near;
  }

  function endMagnify() {
    orbs.forEach((orb) => {
      orb.style.removeProperty('--s');
      orb.classList.remove('is-near');
    });
    orbRow.classList.remove('is-dragging');
  }

  function stopDrag(e, commitIt) {
    if (!dragging) return;
    if (e?.pointerId !== undefined && activePointer !== null && e.pointerId !== activePointer) return;
    dragging = false;
    activePointer = null;
    setTimeout(() => { suppressClick = false; }, 400);
    if (e?.pointerId !== undefined && orbRow.hasPointerCapture?.(e.pointerId)) orbRow.releasePointerCapture(e.pointerId);
    const id = WEATHER_IDS[lastNearest];
    endMagnify();
    lastNearest = -1;
    if (commitIt && id) commit(id);
    else { ctx.restoreSky(); render(); }
  }

  orbRow.addEventListener('pointerdown', (e) => {
    if (dragging || e.button > 0 || !e.target.closest('.orb, .orbs')) return;
    hideHint();
    dragging = true;
    activePointer = e.pointerId;
    suppressClick = true;
    orbRow.setPointerCapture?.(e.pointerId);
    orbRow.classList.add('is-dragging');
    cells = orbs.map((orb) => {
      const r = orb.getBoundingClientRect();
      return { cx: r.left + r.width / 2 };
    });
    lastNearest = -1;
    const near = magnify(e.clientX);
    lastNearest = near;
    preview(WEATHER_IDS[near]);
    ui.haptic('tap');
  });

  orbRow.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== activePointer) return;
    const near = magnify(e.clientX);
    if (near !== lastNearest) {
      lastNearest = near;
      preview(WEATHER_IDS[near]);
      ui.haptic('tap');
    }
  });

  orbRow.addEventListener('pointerup', (e) => stopDrag(e, true));
  orbRow.addEventListener('pointercancel', (e) => stopDrag(e, false));
  orbRow.addEventListener('lostpointercapture', (e) => { if (dragging) stopDrag(e, true); });

  // 키보드와 보조 기기: 누르기(click)와 화살표
  orbRow.addEventListener('click', (e) => {
    // 눌러서 민 직후에 남은 표시가 첫 키보드 Enter(click, detail 0)를 삼키지 않게 한다
    if (suppressClick && e.detail > 0) { suppressClick = false; return; }
    suppressClick = false;
    const orb = e.target.closest('.orb');
    if (orb) commit(orb.dataset.weather);
  });
  orbRow.addEventListener('keydown', (e) => {
    const i = orbs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = orbs[(i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : orbs.length - 1)) % orbs.length];
    next.focus();
    commit(next.dataset.weather);
  });

  // ── 빈 하늘 누르기 ──
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, .orbs, .memo-wrap, .today-top-text')) return;
    const rect = document.getElementById('sky').getBoundingClientRect();
    ctx.sky.poke(e.clientX - rect.left, e.clientY - rect.top);
  });

  // ── 처음 쓰는 사람을 위한 힌트 (한 번만) ──
  function showHint() {
    if (store.getMeta('hint.slide') || record()) return;
    store.setMeta('hint.slide', true);
    hint.classList.add('is-on');
    hintTimer = setTimeout(hideHint, 6000);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hint.classList.remove('is-on');
  }

  // 꽃은 메모 칸 위까지만 핀다: 메모 칸 위쪽 y를 하늘에 알린다 (화면 크기가 바뀔 때도)
  const bottomBox = today.querySelector('.today-bottom');
  function reportGardenLimit() {
    const sky = document.getElementById('sky').getBoundingClientRect();
    const box = bottomBox.getBoundingClientRect();
    if (!box.height) return;
    ctx.sky.setGardenLimit(box.top - sky.top - 4);
  }
  new ResizeObserver(reportGardenLimit).observe(root);
  requestAnimationFrame(reportGardenLimit);

  // ── 연결 ──
  store.subscribe(() => { if (!dragging) render(); });
  ctx.on('daychange', () => {
    flushMemo();
    dateKey = store.todayStr();
    memo.value = '';
    render();
  });

  render({ instant: true });
  setTimeout(showHint, 1400);

  return {
    onShow() {
      dateKey = store.todayStr();
      render({ instant: true });
      ctx.restoreSky();
      reportGardenLimit();
    },
    onHide() {
      flushMemo();
      memo.blur();
    },
  };
}
