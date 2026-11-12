// 앱 시작점: 하늘과 화면을 연결하고, 화면 이동과 날짜 바뀜을 관리한다.
// 화면 모듈 하나가 실패해도 나머지는 돌아가도록 따로따로 불러온다.

import * as store from './store.js';
import * as ui from './ui.js';

const SCREENS = ['today', 'calendar', 'forecast'];

// 하늘 모듈을 못 불러와도 호출부가 깨지지 않게 하는 빈 객체
const silentSky = new Proxy({}, { get: () => () => undefined });

const listeners = new Map();
const views = {};
let current = null;
let dayKey = store.todayStr();
// 탭을 아무리 옮겨도 뒤로 가기 기록은 오늘 화면 위에 한 칸만 쌓는다.
// 그 칸에는 { tab: true }를 남겨, 새로고침한 뒤에도 아래에 오늘 화면이 있음을 안다.
let tabEntry = Boolean(history.state?.tab);

const ctx = {
  sky: silentSky,
  store,
  ui,
  go(name) {
    if (name === current) return;
    if (current === 'today') {
      history.pushState({ tab: true }, '', `#${name}`);
      tabEntry = true;
      show(name);
    } else if (name === 'today' && tabEntry) {
      // 쌓아 둔 칸을 걷어 내면 hashchange가 오늘 화면을 보여 준다.
      tabEntry = false;
      history.back();
    } else {
      history.replaceState(history.state, '', `#${name}`);
      show(name);
    }
  },
  // 자정이 지났는지 바로 확인한다. 기록을 저장하기 직전에 부른다.
  syncDay: () => checkDayChange(),
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  },
  // 하늘을 오늘 기록의 날씨로 되돌린다. 다른 날을 잠깐 보여 준 뒤 호출한다.
  restoreSky() {
    ctx.sky.setWeather(store.getRecord(store.todayStr())?.weather ?? null);
  },
  setForecastBadge(on) {
    document.getElementById('forecast-badge').classList.toggle('is-on', Boolean(on));
  },
  async openSettings() {
    const module = await import('./screens/settings.js');
    module.openSettings(ctx);
  },
};

function emit(event, payload) {
  listeners.get(event)?.forEach((fn) => fn(payload));
}

function syncGarden() {
  const all = store.getAll();
  ctx.sky.setGarden({
    flowers: all.slice(-42).map(({ date, weather }) => ({ date, weather })),
    total: all.length,
  });
}

function show(name) {
  if (!SCREENS.includes(name)) name = 'today';
  if (name === current) return;
  const previous = current;
  current = name;

  document.body.dataset.screen = name;
  ctx.sky.setCamera(name === 'today' ? 'ground' : 'high');

  const index = SCREENS.indexOf(name);
  document.getElementById('tabbar').style.setProperty('--tab-index', index);
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
  });

  for (const id of SCREENS) {
    const section = document.getElementById(`screen-${id}`);
    section.classList.toggle('is-active', id === name);
    section.inert = id !== name;
  }

  if (previous) views[previous]?.onHide?.();
  views[name]?.onShow?.();
}

function currentRoute() {
  return location.hash.replace('#', '') || 'today';
}

function checkDayChange() {
  const now = store.todayStr();
  if (now === dayKey) return;
  dayKey = now;
  // 날짜 시트가 열려 있으면 그날의 하늘을 유지한다. 시트가 닫힐 때 오늘로 돌아온다.
  if (!document.body.classList.contains('day-open')) ctx.restoreSky();
  emit('daychange', now);
}

async function mountScreens() {
  await Promise.all(SCREENS.map(async (name) => {
    try {
      const module = await import(`./screens/${name}.js`);
      views[name] = module.mount(document.getElementById(`screen-${name}`), ctx) ?? {};
    } catch (error) {
      console.error(`${name} 화면을 불러오지 못했어요`, error);
    }
  }));
}

async function startSky() {
  try {
    const { createSky } = await import('./sky/engine.js');
    const sky = createSky(document.getElementById('sky'), { reducedMotion: ui.prefersReducedMotion() });
    sky.on('ink', (ink) => { document.body.dataset.ink = ink; });
    sky.on('theme', (color) => {
      document.querySelector('meta[name="theme-color"]').setAttribute('content', color);
    });
    ctx.sky = sky;
  } catch (error) {
    console.error('하늘을 불러오지 못했어요', error);
  }
}

async function boot() {
  ui.trackKeyboard();
  await startSky();
  ctx.restoreSky();
  syncGarden();
  store.subscribe((event) => {
    syncGarden();
    // 다른 창이나 백업으로 기록이 통째로 바뀌면 하늘도 오늘 기록에 맞춘다.
    if (event.type === 'bulk' && !document.body.classList.contains('day-open')) ctx.restoreSky();
  });

  await mountScreens();
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      ui.haptic('tap');
      ctx.go(tab.dataset.tab);
    });
  });
  window.addEventListener('hashchange', () => {
    const route = currentRoute();
    if (route === 'today') tabEntry = false;
    show(route);
  });
  show(currentRoute());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      ctx.sky.pause();
    } else {
      ctx.sky.resume();
      checkDayChange();
    }
  });
  setInterval(checkDayChange, 30000);

  // 저장 공간을 지워지지 않게 요청하고, 오프라인 동작을 위해 서비스 워커를 등록한다.
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch((error) => console.warn('서비스 워커 등록 실패', error));
  }
}

boot();
