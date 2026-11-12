// 예보 화면: 마음기상청 주간 예보 카드 보기, 공유·저장, 지난 예보 목록, 도착 알림.

import { WEATHERS, iconURL } from '../weather.js';
import { buildForecast } from '../card/copy.js';
import { renderCard } from '../card/render.js';

const SEEN_KEY = 'forecastSeen';
const MAX_PAST = 16;

const SVG_NS = 'http://www.w3.org/2000/svg';

// 선 굵기 1.8의 둥근 선 아이콘 (탭바 아이콘과 같은 규격)
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

const ICON_SHARE = ['M12 15V4', 'M8 7.5 12 3.5l4 4', 'M6 11H5.5A2.5 2.5 0 0 0 3 13.5v4A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-4a2.5 2.5 0 0 0-2.5-2.5H18'];
const ICON_SAVE = ['M12 3.5v11', 'M7.5 10.5l4.5 4.5 4.5-4.5', 'M4 19.5h16'];
const ICON_CHEVRON = ['M9 5.5 15.5 12 9 18.5'];
const ICON_CARD = ['M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z', 'M7.5 9h9M7.5 12.5h9M7.5 16h5'];

export function mount(root, ctx) {
  const { store, ui } = ctx;
  const { el } = ui;

  const cache = new Map(); // 주 시작일 + 기록 지문 → { url, blob }
  let selected = null;
  let visible = false;
  let dirty = true;
  let renderToken = 0;
  let current = null; // 지금 보여 주는 { forecast, blob, url }

  // ── 화면 구성 ──────────────────────────────────────

  const image = el('img', { id: 'card-image', class: 'fc-image', alt: '', draggable: false });
  const skeleton = el('div', { class: 'fc-skeleton', 'aria-hidden': 'true' });
  const card = el('div', { class: 'fc-card is-loading' }, image, skeleton);
  const stage = el('div', { class: 'fc-stage' }, card);

  const shareButton = el('button', {
    id: 'btn-share-card', class: 'btn btn-primary pressable', type: 'button', disabled: true,
    onclick: () => shareCard(),
  }, svgIcon(...ICON_SHARE), '친구에게 보내기');
  const saveButton = el('button', {
    id: 'btn-save-card', class: 'btn pressable', type: 'button', disabled: true,
    onclick: () => saveCard(),
  }, svgIcon(...ICON_SAVE), '이미지로 저장');
  const actions = el('div', { class: 'fc-actions' }, shareButton, saveButton);

  const listTitle = el('h2', { class: 'fc-list-title' }, '지난 예보');
  const list = el('div', { class: 'fc-list' });

  root.classList.add('screen-forecast');
  root.append(
    el('header', { class: 'fc-head' },
      el('h1', { class: 'fc-title' }, '나의 기분 일기예보'),
      el('p', { class: 'fc-sub' }, '마음기상청이 일주일의 하늘을 발표해요')),
    stage,
    actions,
    listTitle,
    list,
  );

  // ── 주 목록 ────────────────────────────────────────

  const thisWeek = () => store.weekStart(store.todayStr());
  const lastWeek = () => store.addDays(thisWeek(), -7);

  // 이번 주를 맨 위에, 기록이 있는 지난 주를 최근 순으로
  function weekList() {
    const current = thisWeek();
    const starts = new Set();
    // 이번 주는 기록이 있을 때만 목록에 올린다(비어 있으면 "기록 없음" 줄이 맨 위에 남는다).
    if (store.getRange(current, store.addDays(current, 6)).length) starts.add(current);
    for (const record of store.getAll()) {
      const start = store.weekStart(record.date);
      if (start < current) starts.add(start);
    }
    return [...starts].sort().reverse().slice(0, MAX_PAST + 1);
  }

  // 가장 최근에 발표된 주. 발표된 주가 없으면 이번 주.
  function latestPublished() {
    return weekList().find((w) => w < thisWeek()) ?? thisWeek();
  }

  function unseenWeek() {
    const week = lastWeek();
    const hasRecords = store.getRange(week, store.addDays(week, 6)).length > 0;
    return hasRecords && store.getMeta(SEEN_KEY) !== week ? week : null;
  }

  function miniIcon(weather) {
    return weather
      ? el('img', { class: 'wi-mini', src: iconURL(weather), alt: WEATHERS[weather].name, width: 18, height: 18 })
      : el('span', { class: 'wi-mini is-empty', 'aria-hidden': 'true' });
  }

  function renderList() {
    const weeks = weekList();
    list.replaceChildren(...weeks.map((week) => {
      const f = buildForecast(week, store);
      const main = f.dominant && f.recorded > 0
        ? el('img', { class: 'wi-main', src: iconURL(f.dominant), alt: '', width: 40, height: 40 })
        : el('span', { class: 'wi-main is-empty', 'aria-hidden': 'true' });
      const label = f.observing ? el('span', { class: 'wi-chip' }, '관측 중') : null;
      return el('button', {
        class: `week-item pressable${week === selected ? ' is-selected' : ''}`,
        type: 'button',
        dataset: { week },
        'aria-current': week === selected ? 'true' : null,
        onclick: () => select(week),
      },
      main,
      el('span', { class: 'wi-text' },
        el('span', { class: 'wi-period' }, f.period, label),
        el('span', { class: 'wi-head' }, f.recorded ? f.headline : '기록 없음')),
      el('span', { class: 'wi-minis', 'aria-hidden': 'true' }, f.days.map((d) => miniIcon(d.weather))));
    }));
    listTitle.hidden = weeks.length < 2;
    list.hidden = weeks.length < 2;
  }

  // ── 카드 만들기 ────────────────────────────────────

  const fingerprint = (f) => `${f.weekStart}|${f.days.map((d) => d.weather ?? '-').join(',')}|${f.observing}`;

  async function show(week, { animate = 'swap' } = {}) {
    const token = ++renderToken;
    const forecast = buildForecast(week, store);
    const key = fingerprint(forecast);

    shareButton.disabled = true;
    saveButton.disabled = true;
    if (animate === 'swap' && current) card.classList.add('is-swapping');

    let entry = cache.get(key);
    if (!entry) {
      card.classList.add('is-loading');
      try {
        const blob = await renderCard(forecast, ctx.sky);
        entry = { blob, url: URL.createObjectURL(blob) };
        cache.set(key, entry);
        // 오래된 카드 이미지는 버린다.
        if (cache.size > 12) {
          const [oldKey, old] = cache.entries().next().value;
          if (old.url !== entry.url) { URL.revokeObjectURL(old.url); cache.delete(oldKey); }
        }
      } catch (error) {
        console.error('카드를 그리지 못했어요', error);
        if (token === renderToken) {
          card.classList.remove('is-loading', 'is-swapping');
          ui.toast('카드를 만들지 못했어요. 다시 열어 주세요');
        }
        return;
      }
    }
    if (token !== renderToken) return; // 그 사이 다른 주를 골랐다

    current = { forecast, ...entry };
    image.alt = `마음기상청 ${forecast.period} 예보: ${forecast.headline}. ${forecast.body.join(' ')}`;
    image.src = entry.url;
    try { await image.decode(); } catch { /* 이미 보이는 상태라면 무시 */ }
    if (token !== renderToken) return;
    card.classList.remove('is-loading', 'is-swapping');
    shareButton.disabled = false;
    saveButton.disabled = false;
  }

  function select(week, options) {
    if (week === selected && !options?.force) return;
    selected = week;
    ui.haptic('tap');
    list.querySelectorAll('.week-item').forEach((item) => {
      const on = item.dataset.week === week;
      item.classList.toggle('is-selected', on);
      if (on) item.setAttribute('aria-current', 'true'); else item.removeAttribute('aria-current');
    });
    return show(week, options);
  }

  // ── 공유와 저장 ────────────────────────────────────

  const fileName = () => `기분날씨-예보-${current.forecast.weekStart}.png`;

  function saveCard() {
    if (!current) return;
    const link = el('a', { href: current.url, download: fileName() });
    document.body.append(link);
    link.click();
    link.remove();
    ui.haptic('success');
    ui.toast('이미지를 저장했어요');
  }

  async function shareCard() {
    if (!current) return;
    const file = new File([current.blob], fileName(), { type: 'image/png' });
    const data = { files: [file], title: '나의 기분 일기예보', text: `마음기상청 ${current.forecast.period} 예보: ${current.forecast.headline}` };
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // 사용자가 닫음
      }
    }
    saveCard();
  }

  // ── 도착의 순간 ────────────────────────────────────

  let notice = null;
  let noticeTimer = 0;

  function hideNotice() {
    clearTimeout(noticeTimer);
    if (!notice) return;
    const node = notice;
    notice = null;
    node.classList.remove('is-in');
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 500);
  }

  function showNotice() {
    if (notice) return;
    notice = el('button', {
      class: 'fc-notice pressable', type: 'button', 'aria-label': '지난주 일기예보가 도착했어요. 눌러서 보기',
      onclick: () => { hideNotice(); ctx.go('forecast'); },
    },
    el('span', { class: 'fc-notice-icon' }, svgIcon(...ICON_CARD)),
    el('span', { class: 'fc-notice-text' },
      el('strong', {}, '지난주 일기예보가 도착했어요'),
      el('span', {}, '마음기상청에서 발표했어요')),
    el('span', { class: 'fc-notice-go' }, svgIcon(...ICON_CHEVRON)));
    document.getElementById('device').append(notice);
    requestAnimationFrame(() => requestAnimationFrame(() => notice?.classList.add('is-in')));
    noticeTimer = setTimeout(hideNotice, 6000);
  }

  // 앱을 열 때 한 번: 새 카드가 있으면 탭에 점을 켜고, 오늘 화면이면 알림을 띄운다.
  function checkArrival({ allowNotice }) {
    const week = unseenWeek();
    ctx.setForecastBadge(Boolean(week));
    if (week && allowNotice && (location.hash.replace('#', '') || 'today') === 'today') {
      setTimeout(() => { if (unseenWeek() && document.body.dataset.screen === 'today') showNotice(); }, 1400);
    }
    return week;
  }

  // ── 화면 수명 ──────────────────────────────────────

  async function onShow() {
    visible = true;
    hideNotice();
    const arriving = unseenWeek();
    const target = arriving ?? (selected && weekList().includes(selected) ? selected : latestPublished());

    if (dirty || target !== selected) {
      dirty = false;
      selected = target;
      renderList();
      await show(target, { animate: 'none' });
    } else if (!current) {
      await show(target, { animate: 'none' });
    }
    if (arriving) {
      card.classList.remove('is-arriving');
      void card.offsetWidth; // 애니메이션을 처음부터 다시 시작
      card.classList.add('is-arriving');
      store.setMeta(SEEN_KEY, arriving);
      ctx.setForecastBadge(false);
    }
  }

  function onHide() {
    visible = false;
    card.classList.remove('is-arriving');
  }

  card.addEventListener('animationend', () => card.classList.remove('is-arriving'));

  store.subscribe(() => {
    dirty = true;
    hideNotice(); // 오늘 기록을 하는 중이면 알림은 물러난다
    if (visible) {
      renderList();
      show(selected ?? latestPublished(), { animate: 'none' });
      dirty = false;
    } else {
      ctx.setForecastBadge(Boolean(unseenWeek()));
    }
  });

  ctx.on('daychange', () => {
    dirty = true;
    selected = null;
    checkArrival({ allowNotice: true });
    if (visible) onShow();
  });

  window.addEventListener('hashchange', () => {
    if ((location.hash.replace('#', '') || 'today') !== 'today') hideNotice();
  });

  checkArrival({ allowNotice: true });

  return { onShow, onHide };
}
