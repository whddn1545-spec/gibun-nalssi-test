// 부팅, 탭 이동, 뒤로 가기(History API: 설정·시트), 예시 데이터, 자정·시간대 넘김, PC 무대, 부팅 실패 안내, 시험 고리(시험 서버 --qa에서만 ?qa=1)
import * as loop from './loop.js';
import { play } from './loop.js';
import { loadCopy, copy } from './copy.js';
import { qaParam, qaHas } from './qa.js';
import * as store from './store.js';
import { now, dayKey } from './dates.js';
import { todAt, skyStops, rgba } from './palette.js';
import { computeLayout } from './layout.js';
import { Sky } from './sky/engine.js';
import { moonPhase } from './sky/art.js';
import { grainURL } from './sky/paper.js';
import { createToday } from './ui/today.js';
import { createCalendar } from './ui/calendar.js';
import { createSheet } from './ui/sheet.js';
import { createForecast } from './ui/forecast.js';
import { createArrival } from './ui/arrival.js';
import { createSettings } from './ui/settings.js';
import { createCrisis, RAIN_KEY } from './ui/crisis.js';
import { makeSampleDays } from './sample.js';
import { ease, pressable } from './ui/spring.js';

const $ = (id) => document.getElementById(id);

function measure(app) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe); const cs = getComputedStyle(probe);
  const sat = parseFloat(cs.paddingTop) || 0, sab = parseFloat(cs.paddingBottom) || 0; probe.remove();
  const vw = window.innerWidth, vh = window.innerHeight;
  const stage = vw >= 600 || (vw > vh && vh < 600);
  document.body.classList.toggle('stage', stage);
  if (stage) {
    const W = 390, H = Math.round(Math.max(Math.min(844, vh - 48), Math.min(vh, 568)));
    Object.assign(app.style, { width: W + 'px', height: H + 'px', left: Math.round((vw - W) / 2) + 'px', top: Math.max(0, Math.round((vh - H) / 2)) + 'px' });
    return computeLayout(W, H, 0, 12); // 무대 안 가상 아래 안전 영역 12(fix1-15)
  }
  Object.assign(app.style, { width: '', height: '', left: '', top: '' });
  return computeLayout(app.clientWidth || vw, app.clientHeight || vh, sat, sab);
}
// 알림(fix2b): 시트가 열려 있으면(닫히는 중 제외) 시트 위 끝 −16, 아니면 아래 탭 위 16. 매 프레임 자리를 다시 재서 시트가 오르내려도 겹치지 않는다
function makeToast(el, app, sheetTop) {
  let h = null;
  const place = () => {
    const a = app.getBoundingClientRect(); let y = $('tabs').getBoundingClientRect().top - a.top;
    const s = sheetTop(); if (s != null) y = Math.min(y, s - a.top);
    el.style.top = Math.round(y - 16 - el.offsetHeight) + 'px';
  };
  return (msg) => {
    el.textContent = msg; if (h) h.cancel(); place();
    h = play(2800, (p, e) => { place(); el.style.opacity = (e < 200 ? e / 200 : e > 2500 ? Math.max(0, 1 - (e - 2500) / 300) : 1).toFixed(3); el.style.transform = `translate(-50%, ${(6 * (1 - Math.min(1, e / 200))).toFixed(2)}px)`; });
  };
}

async function boot() {
  if (qaParam('qa') === 'freeze') loop.freeze();
  if (qaParam('reset') === '1') { try { for (const k of Object.keys(localStorage)) if (k.startsWith(store.KEY) || k === RAIN_KEY) localStorage.removeItem(k); } catch (e) { /* 저장소 없음 */ } }
  const C = await loadCopy();
  store.load();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const forced = ['dawn', 'day', 'dusk', 'night'].includes(qaParam('time')) ? qaParam('time') : null;
  const todNow = () => forced || todAt(now());
  const app = $('app');
  $('grain').style.backgroundImage = `url(${grainURL()})`;
  const sky = new Sky($('sky'), { reduced, dayKey: dayKey(now()), moonPhase: moonPhase(now()) });
  let L = measure(app);
  sky.resize(L);
  const vibrate = (p) => { try { if (!reduced && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 지원 안 함 */ } };
  let sheet = null; // 아래에서 만든다(알림 자리는 시트 위 끝을 따른다)
  const toast = makeToast($('toast'), app, () => (sheet ? sheet.top() : null));
  let cur = 'today';
  let flip = false;
  const backdrop = (w, tod) => {
    if (!document.body.classList.contains('stage')) return;
    const [a, b, c] = skyStops(w || 'none', tod); const top = flip ? $('bdA') : $('bdB'), under = flip ? $('bdB') : $('bdA'); flip = !flip;
    top.style.transition = 'none'; top.style.opacity = '0'; top.style.zIndex = '2'; under.style.zIndex = '1';
    top.style.background = `radial-gradient(720px 900px at 50% 50%, ${rgba(c, 0.35)}, ${rgba(c, 0)} 72%), linear-gradient(${a}, ${b} 50%, ${c})`;
    void top.offsetWidth; top.style.transition = ''; top.style.opacity = '1';
  };
  sheet = createSheet({ app, reduced });
  const crisis = createCrisis({ C, app, sheet, reduced }); // 위기 안내(safety-review): 판정은 저장 성공 뒤, 기기 안에서만
  let rollover = null; // 아래 자정 넘김에서 채운다
  const today = createToday({ app, sky, C, reduced, todNow, fx: $('fx'), vibrate, toast, onScene: backdrop, isToday: () => cur === 'today', isCrisis: (m, p) => crisis.isCrisis(m, p), onSaved: (o) => { const shown = crisis.onSaved(o); settings.nudge({ ...o, crisisShown: shown }); }, onRollover: () => { if (rollover) rollover(); } });
  today.layout(L);
  today.init();
  const onChanged = (k) => { if (k === dayKey(now())) today.sync(cur === 'today' ? 'tap' : 'instant'); arrival.refresh(false); };
  const cal = createCalendar({ C, reduced, sheet, toast, vibrate, onChanged, onSample: () => setSample(true), crisisSheet: (o) => crisis.sheetCard(o) });
  cal.layout(L);
  // 예보 도착 띠 D·탭 점(일요일 18시 발행), 예보 화면(카드 뷰어·저장 3단계·도착 연출)
  const arrival = createArrival({ C, reduced, app, onOpen: () => go('forecast') });
  arrival.layout(L);
  const fc = createForecast({ C, reduced, sheet, toast, vibrate, arrivalKey: () => arrival.pendingKey(), markSeen: (k) => arrival.markSeen(k) });
  fc.layout(L);
  arrival.refresh(false);
  const settings = createSettings({ C, sheet, toast, app, openHelp: () => crisis.openHelp(), onDataChanged: () => resync() });
  crisis.layout(L); settings.layout(L);
  // 복원·전체 삭제 뒤 모든 화면을 저장소와 다시 맞춘다(전체 삭제는 저장소의 예시 데이터를 먼저 비우므로 띠·끝내기도 여기서 맞춘다)
  function resync() { setSample(false); today.sync('instant'); cal.refresh(false); fc.refresh(); arrival.refresh(false); crisis.hide(); settings.hideNudge(); settings.refresh(); }
  loop.onFrame((dt, t) => sky.frame(dt, t));

  // 하늘 만지기: 조작 밖 하늘에서만 받는다. pointermove는 rAF로 묶는다.
  const skyCv = $('sky');
  skyCv.setAttribute('role', 'img'); skyCv.setAttribute('aria-label', C.extra.sky_label);
  const local = (e) => { const r = app.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  skyCv.addEventListener('pointerdown', (e) => { if (cur !== 'today') return; try { skyCv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } const [x, y] = local(e); sky.pointer('down', x, y); });
  skyCv.addEventListener('pointermove', (e) => { if (!sky.touch || !sky.touch.down) return; const [x, y] = local(e); sky.moveLater(x, y); });
  const up = () => sky.pointer('up'); skyCv.addEventListener('pointerup', up); skyCv.addEventListener('pointercancel', up);

  // 탭과 화면
  const screens = { today: $('screen-today'), calendar: $('screen-calendar'), forecast: $('screen-forecast'), settings: $('screen-settings') };
  $('fcTitle').textContent = C.forecast.title; $('fcEmptyT').textContent = C.forecast.empty_title; $('fcEmptyB').textContent = C.forecast.empty_body;
  $('fcSample').textContent = C.forecast.sample_cta; $('fcSample').addEventListener('click', () => setSample(true));
  $('setTitle').textContent = C.settings.title; $('setSampleT').textContent = C.settings.sample; $('setSampleD').textContent = C.settings.sample_desc;
  $('backBtn').setAttribute('aria-label', C.misc.close); // 설정은 닫기 X(fix2b: 달력의 '이전 달 <'와 뜻이 겹치지 않게)
  $('sampleText').textContent = C.sample.banner; $('sampleExit').textContent = C.sample.exit;
  const tabsEl = $('tabs'); tabsEl.setAttribute('aria-label', C.extra.tab_label);
  const tabBtns = [...tabsEl.querySelectorAll('.tab')];
  tabBtns.forEach((b) => { b.querySelector('span').textContent = C.tabs[b.dataset.tab]; pressable(b); b.addEventListener('click', () => go(b.dataset.tab)); });
  pressable($('backBtn'));
  const markTabs = () => tabBtns.forEach((b) => { if (b.dataset.tab === cur) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  markTabs();
  let skyOff = null;
  function go(name) {
    if (name === cur || today.busy() || sheet.isOpen()) return;
    const from = screens[cur], to = screens[name], prev = cur; cur = name; markTabs();
    if (name !== 'today') { const top = skyStops(sky.w || 'none', sky.tod)[0]; to.querySelector('.wash').style.background = `linear-gradient(${rgba(top, 0.32)}, ${rgba(top, 0)})`; }
    if (name === 'calendar') cal.show();
    if (prev === 'forecast') fc.hide();
    if (prev === 'today') { crisis.hide(); settings.hideNudge(); }
    if (name === 'forecast') fc.show();
    if (skyOff) { skyOff.cancel(); skyOff = null; }
    if (name === 'today') { sky.visible = true; $('sky').style.opacity = ''; }
    tabsEl.classList.toggle('on-board', name !== 'today');
    if (name === 'settings') { tabsEl.style.visibility = 'hidden'; tabsEl.inert = true; } else if (name !== 'today') { tabsEl.style.visibility = ''; tabsEl.style.opacity = ''; tabsEl.inert = false; tabsEl.dataset.on = '1'; }
    to.hidden = false;
    if (reduced) { from.hidden = true; to.style.opacity = '0'; play(180, (p) => { to.style.opacity = p >= 1 ? '' : p.toFixed(3); }); }
    else {
      // fix2b: 떠나는 화면은 0~140에 먼저 사라지고(오늘 화면이면 하늘 캔버스도 함께), 새 화면은 120부터 나타난다(겹침 20ms 이하)
      const skyEl = prev === 'today' ? $('sky') : null;
      play(140, (p) => { const o = (1 - p).toFixed(3); from.style.opacity = o; if (skyEl) skyEl.style.opacity = o; if (p >= 1) { from.hidden = true; from.style.opacity = ''; } });
      to.style.opacity = '0';
      play(260, (p) => { const e = ease.out(p); to.style.opacity = e.toFixed(3); to.style.transform = `translateY(${((1 - e) * 8).toFixed(2)}px)`; if (p >= 1) { to.style.opacity = ''; to.style.transform = ''; } }, 120);
    }
    if (name === 'today') today.onShowToday();
    else { skyOff = play(0, () => {}, 400); skyOff.done.then(() => { if (cur !== 'today') sky.visible = false; }); }
  }
  let popTarget = 'today';
  $('settingsBtn').addEventListener('click', () => { if (cur === 'settings') return; history.pushState({ s: 'settings' }, ''); go('settings'); });
  $('backBtn').addEventListener('click', () => { if (history.state && history.state.s === 'settings') history.back(); else go('today'); });
  $('setSample').addEventListener('click', () => { setSample(true); popTarget = 'calendar'; if (history.state && history.state.s === 'settings') history.back(); else go('calendar'); });
  window.addEventListener('popstate', () => {
    if (sheet.isOpen() || sheet.expecting()) { sheet.onPop(); return; }
    if (cur === 'settings') { const t = popTarget; popTarget = 'today'; go(t); }
  });

  // 예시 데이터(§9.3): 메모리에만, 모든 화면 위 띠, 끝내기
  function setSample(on) {
    if (on === store.inSample() && on === app.classList.contains('sample')) return; // 저장소와 화면(띠) 둘 다 이미 그 상태일 때만 그냥 둔다
    if (on) { if (!store.inSample()) store.startSample(makeSampleDays(now(), C)); } else store.endSample();
    app.classList.toggle('sample', on); $('sampleBanner').hidden = !on; $('fcSample').hidden = on;
    today.sync(cur === 'today' ? 'tap' : 'instant'); cal.refresh(true); fc.refresh(); arrival.refresh(false);
  }
  $('sampleExit').addEventListener('click', () => setSample(false));

  // 자정·시간대 넘김
  let curKey = dayKey(now());
  const newDayNotice = () => { if (cur === 'calendar') cal.refresh(false); toast(C.misc.new_day); };
  // 오늘 화면이 저장 순간에 먼저 새날로 넘긴 경우(today.js save): 화면은 이미 넘겼으니 알림·달력만
  rollover = () => { curKey = dayKey(now()); newDayNotice(); };
  const checkClock = () => {
    today.tick();
    const k = dayKey(now()); if (k !== curKey) { curKey = k; today.newDay(); newDayNotice(); }
    if (!forced) today.setTod(todAt(now()));
    arrival.refresh(cur === 'today'); if (cur === 'forecast') fc.refresh();
  };
  setInterval(checkClock, 15000);
  document.addEventListener('visibilitychange', () => { loop.pause(document.hidden); if (!document.hidden) checkClock(); });
  let rz = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { if (document.activeElement && document.activeElement.tagName === 'INPUT') return; const nL = measure(app); if (nL.W === L.W && nL.H === L.H && nL.sat === L.sat && nL.sab === L.sab) return; L = nL; sky.resize(L); today.layout(L); cal.layout(L); arrival.layout(L); fc.layout(L); crisis.layout(L); settings.layout(L); backdrop(sky.w === 'none' ? null : sky.w, sky.tod); }, 120);
  });

  // 시작 연출
  const firstRun = !store.getMeta('intro');
  app.classList.remove('booting');
  if (firstRun && !reduced) { sky.introStart(); today.introUI(); } else today.reopenUI();
  if (firstRun) store.setMeta('intro', 1);
  if (store.isDamaged()) toast(C.misc.data_damaged);
  loop.start();

  if (qaHas('qa')) {
    window.__qa = {
      freeze: () => loop.freeze(), unfreeze: () => loop.unfreeze(), advance: (ms) => loop.advance(ms),
      jump: (w, tod, mode) => today.qaJump(w, tod, mode),
      state: () => ({ w: sky.w, tod: sky.tod, q: sky.q, qLog: sky.qLog, lastFps: sky.lastFps, mode: today.mode(), cur, seal: !!sky.seal, sheet: sheet.isOpen(), sample: store.inSample(), cal: cal.state(), L: { W: L.W, H: L.H, cls: L.cls, crest: L.crest } }),
      hideText: (v) => document.body.classList.toggle('qa-notext', !!v),
      friendTalk: () => today.friendTalk(),
      reloadWeek: () => today.qaReloadWeek(),
      go: (n) => go(n), openDay: (k) => cal.openDay(k), sample: (v) => setSample(!!v), setQuiet: (v) => today.setQuiet(v),
      frameTimes: () => loop.frameTimes(),
      fc: () => fc.state(), arrival: () => arrival.state(), clock: () => checkClock(), crisis: () => crisis.state(),
    };
  }
  // 서비스 워커(오프라인·설치). 시험 서버에서 ?nosw=1이면 등록하지 않는다(도구용)
  if ('serviceWorker' in navigator && !qaHas('nosw')) { const reg = () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}); if (document.readyState === 'complete') setTimeout(reg, 600); else window.addEventListener('load', () => setTimeout(reg, 600)); }
  window.__ready = true;
}
// 부팅 실패: 빈 화면 대신 안내와 다시 시도 단추(문구 파일조차 못 읽었으면 같은 문장을 여기서 쓴다)
const BOOT_FALLBACK = { msg: '기록을 불러오지 못했어요. 앱을 다시 열어 주세요.', retry: '다시 시도' };
function bootFailed(e) {
  console.error(e);
  const app = $('app'); if (!app || app.querySelector('.boot-fail')) return;
  const C = copy();
  app.classList.remove('booting');
  const box = document.createElement('div'); box.className = 'boot-fail'; box.setAttribute('role', 'alert');
  const p = document.createElement('p'); p.textContent = (C && C.misc && C.misc.load_failed) || BOOT_FALLBACK.msg;
  const b = document.createElement('button'); b.type = 'button'; b.textContent = (C && C.extra && C.extra.retry) || BOOT_FALLBACK.retry;
  b.addEventListener('click', () => location.reload());
  box.append(p, b); app.appendChild(box); b.focus();
}
boot().catch(bootFailed);
