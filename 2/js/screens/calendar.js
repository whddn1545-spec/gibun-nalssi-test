// 달력 화면: 달 넘기기(버튼과 쓸기), 날씨 아이콘 달력, 달 요약, 날짜 시트(보기와 고치기)

import { WEATHERS, WEATHER_IDS, iconURL } from '../weather.js';
import { josa } from '../card/copy.js';
import { watchInstallPrompt } from './settings.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_BACK_MONTHS = 11; // 기록이 없어도 최소 1년은 거슬러 가서 지난날을 채울 수 있다
const WEEKDAY_HEAD = ['일', '월', '화', '수', '목', '금', '토'];

function svgIcon(...paths) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

const monthIndex = (y, m) => y * 12 + m;
const springEase = CSS.supports('transition-timing-function', 'linear(0, 1)')
  ? getComputedStyle(document.documentElement).getPropertyValue('--spring').trim() || 'cubic-bezier(.3,1.25,.5,1)'
  : 'cubic-bezier(.3,1.25,.5,1)';

export function mount(root, ctx) {
  const { store, ui } = ctx;
  const { el } = ui;
  watchInstallPrompt(); // 설치 안내 이벤트는 앱을 여는 순간부터 받아 둔다

  let view = monthOf(store.todayStr());
  let visible = false;
  let dirty = true;
  let animating = false;
  let todayKey = store.todayStr();

  function monthOf(dateStr) {
    const d = store.parseDate(dateStr);
    return { y: d.getFullYear(), m: d.getMonth() };
  }

  // ── 화면 구성 ──────────────────────────────────────

  const prevButton = el('button', {
    id: 'cal-prev', class: 'icon-btn cal-nav', type: 'button', 'aria-label': '이전 달', onclick: () => go(-1),
  }, svgIcon('M15 5.5 8.5 12l6.5 6.5'));
  const nextButton = el('button', {
    id: 'cal-next', class: 'icon-btn cal-nav', type: 'button', 'aria-label': '다음 달', onclick: () => go(1),
  }, svgIcon('M9 5.5 15.5 12 9 18.5'));
  const title = el('h1', { id: 'cal-title', class: 'cal-title', 'aria-live': 'polite' });

  const sumLine = el('p', { class: 'cal-sum-line' });
  const sumSub = el('p', { class: 'cal-sum-sub' });
  const bar = el('div', { class: 'cal-bar', 'aria-hidden': 'true' });
  const legend = el('ul', { class: 'cal-legend' });
  const grid = el('div', { class: 'cal-grid' });
  const viewport = el('div', { class: 'cal-viewport' }, grid);

  root.classList.add('screen-calendar');
  root.append(
    el('header', { class: 'cal-head' }, prevButton, title, nextButton),
    el('section', { class: 'cal-summary' }, sumLine, sumSub, bar, legend),
    el('div', { class: 'cal-weekdays', 'aria-hidden': 'true' }, WEEKDAY_HEAD.map((d, i) => el('span', { class: i === 0 ? 'is-sun' : '' }, d))),
    viewport,
  );

  // ── 그리기 ─────────────────────────────────────────

  function render({ stagger = false } = {}) {
    const { y, m } = view;
    const today = store.todayStr();
    const first = new Date(y, m, 1);
    const days = new Date(y, m + 1, 0).getDate();
    const monthStart = store.toDateStr(first);
    const monthEnd = store.toDateStr(new Date(y, m, days));
    const records = new Map(store.getRange(monthStart, monthEnd).map((r) => [r.date, r]));
    const current = monthOf(today);

    title.textContent = `${y}년 ${m + 1}월`;
    const atNow = monthIndex(y, m) >= monthIndex(current.y, current.m);
    const atStart = monthIndex(y, m) <= floorIndex();
    nextButton.classList.toggle('is-off', atNow);
    nextButton.setAttribute('aria-disabled', String(atNow));
    prevButton.classList.toggle('is-off', atStart);
    prevButton.setAttribute('aria-disabled', String(atStart));

    renderSummary(records, monthIndex(y, m) === monthIndex(current.y, current.m));

    const cells = [];
    for (let i = 0; i < first.getDay(); i += 1) cells.push(el('span', { class: 'day-pad', 'aria-hidden': 'true' }));
    for (let d = 1; d <= days; d += 1) {
      const date = store.toDateStr(new Date(y, m, d));
      cells.push(dayCell(date, d, records.get(date), today));
    }
    cells.forEach((cell, i) => {
      if (stagger) cell.style.setProperty('--i', i);
    });
    grid.classList.toggle('is-stagger', stagger);
    grid.replaceChildren(...cells);
  }

  function dayCell(date, number, record, today) {
    const future = date > today;
    const isToday = date === today;
    const label = `${store.formatKo(date)}${record ? `, ${WEATHERS[record.weather].name}` : future ? ', 아직 오지 않은 날' : ', 기록 없음'}`;
    const classes = ['day', 'pressable'];
    if (record) classes.push('has-record');
    else if (!future) classes.push('is-blank');
    if (future) classes.push('is-future');
    if (isToday) classes.push('is-today');

    const face = record
      ? el('span', { class: 'day-face' }, el('img', { src: iconURL(record.weather), alt: '', width: 32, height: 32, draggable: false }))
      : el('span', { class: 'day-face day-face-num' }, String(number));
    return el('button', {
      class: classes.join(' '),
      type: 'button',
      dataset: { date },
      'aria-label': label,
      onclick: (e) => onDay(date, e.currentTarget),
    },
    face,
    record ? el('span', { class: 'day-num' }, String(number)) : el('span', { class: 'day-dot', 'aria-hidden': 'true' }));
  }

  function renderSummary(records, isCurrent) {
    const counts = Object.fromEntries(WEATHER_IDS.map((id) => [id, 0]));
    for (const r of records.values()) counts[r.weather] += 1;
    const total = records.size;
    const label = isCurrent ? '이번 달' : `${view.m + 1}월`;

    if (!total) {
      sumLine.textContent = isCurrent ? '이번 달의 하늘이 아직 비어 있어요' : '이 달에는 남긴 하늘이 없어요';
      sumSub.textContent = isCurrent ? '오늘의 날씨를 골라 하늘을 채워 보세요' : '';
    } else {
      const top = Math.max(...Object.values(counts));
      const leaders = WEATHER_IDS.filter((id) => counts[id] === top);
      if (leaders.length === 1) {
        sumLine.textContent = `${josa(label, '은/는')} ${josa(WEATHERS[leaders[0]].name, '이/가')} 가장 많았어요`;
      } else if (leaders.length === 2) {
        sumLine.textContent = `${josa(label, '은/는')} ${josa(WEATHERS[leaders[0]].name, '와/과')} ${josa(WEATHERS[leaders[1]].name, '이/가')} 똑같이 많았어요`;
      } else {
        sumLine.textContent = `${josa(label, '은/는')} 여러 날씨가 고르게 오갔어요`;
      }
      sumSub.textContent = `${total}일의 하늘을 남겼어요`;
    }

    bar.replaceChildren(...(total
      ? WEATHER_IDS.filter((id) => counts[id]).map((id) => el('span', {
        class: 'cal-seg', style: { flexGrow: String(counts[id]), background: `var(--c-${id})` },
      }))
      : [el('span', { class: 'cal-seg is-empty' })]));
    legend.replaceChildren(...WEATHER_IDS.filter((id) => counts[id]).map((id) => el('li', {},
      el('i', { style: { background: `var(--c-${id})` } }), `${WEATHERS[id].name} ${counts[id]}`)));
  }

  // ── 달 이동: 버튼과 쓸기 ───────────────────────────

  // 갈 수 있는 가장 오래된 달: 가장 오래된 기록의 달(기록이 없거나 최근이면 1년 전)
  function floorIndex() {
    const now = monthOf(store.todayStr());
    const floor = monthIndex(now.y, now.m) - MIN_BACK_MONTHS;
    const oldest = store.getAll()[0];
    if (!oldest) return floor;
    const o = monthOf(oldest.date);
    return Math.min(floor, monthIndex(o.y, o.m));
  }

  function clampDelta(delta) {
    const now = monthOf(store.todayStr());
    const here = monthIndex(view.y, view.m);
    const target = Math.min(monthIndex(now.y, now.m), Math.max(floorIndex(), here + delta));
    return target - here;
  }

  const canGo = (dir) => clampDelta(dir) !== 0;

  function setMonth(delta) {
    const d = new Date(view.y, view.m + delta, 1);
    view = { y: d.getFullYear(), m: d.getMonth() };
  }

  // delta: 이동할 달 수(음수는 이전 달). 그리드가 날아가고 새 달이 반대쪽에서 스프링으로 들어온다.
  // 이동 중에 들어온 입력은 버리지 않고 모아 두었다가 끝난 뒤 한 번에 이어서 움직인다.
  let queued = 0;

  async function go(delta) {
    if (animating) {
      queued += delta;
      return;
    }
    const move = clampDelta(delta);
    if (move === 0) {
      bounce(Math.sign(delta));
      return;
    }
    const dir = Math.sign(move);
    animating = true;
    ui.haptic('tap');
    const reduce = ui.prefersReducedMotion();
    const travel = reduce ? 0 : 70;

    grid.style.transition = reduce ? 'none' : 'transform 150ms var(--ease-out), opacity 150ms var(--ease-out)';
    grid.style.transform = `translateX(${-dir * travel}px)`;
    grid.style.opacity = '0';
    await wait(reduce ? 0 : 150);

    setMonth(move);
    render({ stagger: !reduce });
    grid.style.transition = 'none';
    grid.style.transform = `translateX(${dir * travel}px)`;
    void grid.offsetWidth;
    grid.style.transition = reduce ? 'none' : `transform 560ms ${springEase}, opacity 260ms var(--ease-out)`;
    grid.style.transform = 'none';
    grid.style.opacity = '1';
    await wait(reduce ? 0 : 560);
    grid.style.transition = '';
    grid.style.transform = '';
    grid.style.opacity = '';
    animating = false;
    if (queued) {
      const rest = queued;
      queued = 0;
      await go(rest);
    }
  }

  // 더 갈 수 없는 쪽으로 밀었을 때 살짝 튕긴다.
  function bounce(dir) {
    if (ui.prefersReducedMotion()) return;
    grid.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * 14}px)` }, { transform: 'translateX(0)' }],
      { duration: 420, easing: springEase },
    );
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let drag = null;
  let suppressClick = false;

  viewport.addEventListener('pointerdown', (e) => {
    if (animating || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, lastX: e.clientX, lastT: e.timeStamp, velocity: 0, locked: false };
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.locked) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;
      drag.locked = true;
      // 터치는 처음 누른 칸에 자동으로 묶이므로 마우스일 때만 따로 잡는다.
      if (e.pointerType === 'mouse') viewport.setPointerCapture(e.pointerId);
      grid.style.transition = 'none';
    }
    drag.velocity = (e.clientX - drag.lastX) / Math.max(1, e.timeStamp - drag.lastT);
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    // 갈 수 없는 쪽은 저항을 준다.
    const dir = dx < 0 ? 1 : -1;
    const eased = canGo(dir) ? dx : dx * 0.25;
    grid.style.transform = `translateX(${eased}px)`;
    grid.style.opacity = String(Math.max(0.35, 1 - Math.abs(eased) / 420));
  });

  // cancelled: 시스템이 제스처를 가져간 경우. 손을 뗀 것이 아니므로 달을 넘기지 않고 제자리로 돌아온다.
  const endDrag = async (e, cancelled = false) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { locked, velocity } = drag;
    const dx = e.clientX - drag.x;
    drag = null;
    if (!locked) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 60);
    const dir = dx < 0 ? 1 : -1;
    const commit = !cancelled && (Math.abs(dx) > 56 || Math.abs(velocity) > 0.5) && Math.sign(velocity || dx) === Math.sign(dx);
    if (commit && canGo(dir)) {
      // 손가락 위치에서 이어서 날아가게 현재 위치를 그대로 두고 go()를 부른다.
      grid.style.transition = '';
      await go(dir);
    } else {
      grid.style.transition = `transform 520ms ${springEase}, opacity 260ms var(--ease-out)`;
      grid.style.transform = 'none';
      grid.style.opacity = '1';
      setTimeout(() => { grid.style.transition = ''; grid.style.transform = ''; grid.style.opacity = ''; }, 540);
    }
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', (e) => endDrag(e, true));
  viewport.addEventListener('click', (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  // ── 날짜 누르기 ────────────────────────────────────

  function onDay(date, button) {
    if (date > store.todayStr()) {
      ui.haptic('warn');
      button.classList.remove('is-shake');
      void button.offsetWidth;
      button.classList.add('is-shake');
      ui.toast('미래의 하늘은 아직 몰라요');
      return;
    }
    ui.haptic('tap');
    openDay(date);
  }

  function openDay(date) {
    const content = el('div', { class: 'day-sheet' });
    let mode = store.getRecord(date) ? 'view' : 'edit';
    let draft = null; // { weather, memo }
    // 사용자가 이 시트에서 실제로 날씨를 누르거나 글을 쓴 것만 닫을 때 저장한다.
    // (열 때의 값과 비교하면 다른 창이 고친 값을 옛 값으로 되돌리게 된다.)
    const touched = { weather: false, memo: false };
    let confirmDelete = 0;

    const record = () => store.getRecord(date);

    function paint() {
      const rec = record();
      content.replaceChildren(
        el('h2', { id: 'day-title', class: 'day-title' }, store.formatKo(date)),
        mode === 'view' ? viewBlocks(rec) : editBlocks(rec),
      );
    }

    function viewBlocks(rec) {
      const w = WEATHERS[rec.weather];
      return el('div', { class: 'day-view' },
        el('div', { id: 'day-weather', class: 'day-weather' },
          el('img', { src: iconURL(rec.weather), alt: '', width: 72, height: 72 }),
          el('div', { class: 'day-weather-text' }, el('strong', {}, w.name), el('span', {}, w.mood))),
        el('p', { id: 'day-memo', class: `day-memo${rec.memo ? '' : ' is-empty'}` }, rec.memo || '남긴 말이 없는 날이에요'),
        el('div', { class: 'day-actions' },
          el('button', { class: 'btn pressable', type: 'button', onclick: () => { mode = 'edit'; paint(); } }, svgIcon('M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z', 'M13.5 8l3 3'), '고치기'),
          el('button', { class: 'btn btn-primary pressable', type: 'button', onclick: () => sheet.close() }, '닫기')));
    }

    function editBlocks(rec) {
      draft ??= { weather: rec?.weather ?? null, memo: rec?.memo ?? '' };
      const saveButton = el('button', { class: 'btn btn-primary pressable', type: 'button', onclick: save }, rec ? '저장' : '하늘 남기기');
      const picker = el('div', { class: 'day-picker', role: 'radiogroup', 'aria-label': '그날의 날씨' },
        WEATHER_IDS.map((id) => el('button', {
          class: `pick pressable${draft.weather === id ? ' is-on' : ''}`,
          type: 'button',
          role: 'radio',
          'aria-checked': String(draft.weather === id),
          dataset: { weather: id },
          onclick: () => pickWeather(id),
        }, el('img', { src: iconURL(id), alt: '', width: 38, height: 38 }), el('span', {}, WEATHERS[id].name))));
      const input = el('input', {
        id: 'day-memo-input', class: 'day-memo-input', type: 'text', value: draft.memo,
        placeholder: '한 줄 남기기', enterKeyHint: 'done', autocomplete: 'off', 'aria-label': '그날의 한 줄',
        // maxLength는 UTF-16 단위라 이모지가 쪼개진다. 보이는 한 글자 기준(store.clipMemo)으로 자르고, 조합 중에는 자르지 않는다.
        oninput: (e) => {
          if (!e.isComposing) input.value = store.clipMemo(input.value);
          draft.memo = input.value;
          touched.memo = true;
        },
        oncompositionend: () => { input.value = store.clipMemo(input.value); draft.memo = input.value; },
        onkeydown: (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } },
      });
      const syncSave = () => { saveButton.disabled = !draft.weather; };
      syncSave();
      picker.addEventListener('click', syncSave);

      const actions = el('div', { class: 'day-actions' },
        el('button', {
          class: 'btn pressable', type: 'button',
          onclick: () => {
            draft = null;
            touched.weather = false;
            touched.memo = false;
            if (rec) { ctx.sky.setWeather(rec.weather); mode = 'view'; paint(); } else sheet.close();
          },
        }, '취소'),
        saveButton);

      const blocks = [
        el('div', { id: 'day-weather', class: 'day-weather is-edit' },
          el('p', { class: 'day-ask' }, rec ? '그날의 날씨를 골라 보세요' : '이날의 하늘은 어땠나요?'),
          picker),
        el('div', { id: 'day-memo', class: 'day-memo is-edit' }, input),
        actions,
      ];
      if (rec) {
        const del = el('button', { class: 'day-delete pressable', type: 'button', onclick: () => removeRecord(del) }, '이 날의 기록 지우기');
        blocks.push(del);
      }
      return el('div', { class: 'day-edit' }, blocks);
    }

    function pickWeather(id) {
      draft.weather = id;
      touched.weather = true;
      ctx.sky.setWeather(id);
      ui.haptic('select');
      content.querySelectorAll('.pick').forEach((node) => {
        const on = node.dataset.weather === id;
        node.classList.toggle('is-on', on);
        node.setAttribute('aria-checked', String(on));
      });
    }

    function announceSaved(existed) {
      ui.toast(store.isPersistent() ? (existed ? '기록을 고쳤어요' : '하늘을 남겼어요') : '이 브라우저에서는 저장되지 않아요');
    }

    // 저장된 값과 비교해 실제로 바뀌는 것이 있을 때만 저장한다(같은 날씨를 다시 눌러도 '고쳤어요'가 뜨지 않게).
    function changesRecord(patch, prev) {
      if (!prev) return Boolean(patch.weather);
      const memo = patch.memo === undefined ? prev.memo : store.clipMemo(String(patch.memo).replace(/[\r\n]+/g, ' ').trim());
      return (patch.weather ?? prev.weather) !== prev.weather || memo !== (prev.memo ?? '');
    }

    function save() {
      if (!draft?.weather) return;
      const prev = record();
      const patch = { weather: draft.weather, memo: draft.memo };
      if (changesRecord(patch, prev)) {
        store.setRecord(date, patch);
        ui.haptic('success');
        announceSaved(Boolean(prev));
      }
      draft = null;
      touched.weather = false;
      touched.memo = false;
      mode = 'view';
      paint();
    }

    function removeRecord(button) {
      if (!confirmDelete) {
        confirmDelete = window.setTimeout(() => { confirmDelete = 0; button.textContent = '이 날의 기록 지우기'; button.classList.remove('is-armed'); }, 3200);
        button.textContent = '한 번 더 누르면 지워져요';
        button.classList.add('is-armed');
        ui.haptic('warn');
        return;
      }
      clearTimeout(confirmDelete);
      // 지운 뒤에는 어떤 닫기 경로로도 되살아나지 않게 초안과 변경 표시를 버린다.
      draft = null;
      touched.weather = false;
      touched.memo = false;
      store.deleteRecord(date);
      ui.toast('기록을 지웠어요');
      sheet.close();
    }

    // 시트가 뜨는 순간: 막을 걷고, 하늘이 그날의 날씨와 언덕 장면으로 바뀐다.
    const rec0 = record();
    document.body.classList.add('day-open');
    ctx.sky.setCamera('ground');
    ctx.sky.setWeather(rec0?.weather ?? null);
    paint();
    const sheet = ui.openSheet({
      content,
      label: `${store.formatKo(date)} 기록`,
      onClose: () => {
        // 고치는 중에 Esc나 바깥을 눌러 닫으면 오늘 화면의 메모처럼 자동으로 저장한다. (취소 버튼은 초안을 버린다.)
        if (mode === 'edit' && draft && (touched.weather || touched.memo)) {
          const prev = record();
          const patch = {};
          if (touched.weather) patch.weather = draft.weather;
          if (touched.memo) patch.memo = draft.memo;
          if (!prev) patch.weather = draft.weather; // 새 기록에는 날씨가 꼭 있어야 한다
          if ((prev || patch.weather) && changesRecord(patch, prev)) {
            store.setRecord(date, patch);
            announceSaved(Boolean(prev));
          }
        }
        draft = null;
        document.body.classList.remove('day-open');
        ctx.sky.setCamera('high');
        ctx.restoreSky();
      },
    });
  }

  // ── 수명 ───────────────────────────────────────────

  store.subscribe(() => {
    if (visible) render();
    else dirty = true;
  });

  ctx.on('daychange', () => {
    todayKey = store.todayStr();
    view = monthOf(todayKey);
    if (visible) render(); else dirty = true;
  });

  function onShow() {
    visible = true;
    if (todayKey !== store.todayStr()) {
      todayKey = store.todayStr();
      view = monthOf(todayKey);
    }
    render({ stagger: dirty });
    dirty = false;
  }

  function onHide() {
    visible = false;
  }

  return { onShow, onHide };
}
