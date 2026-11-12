// 예보 도착 띠 D(design-spec §4.2 D, §4.6, §6.4 '띠 D 도착')와 예보 탭 점(§4.5).
// 일요일 18시(기기 현지 시각)에 그 주 카드가 발행된다. 가장 최근 발행 카드를 예보 탭에서 아직 안 봤으면 띄운다.
// 막아서는 팝업은 쓰지 않는다. 예시 데이터 중에는 띄우지 않는다. 저장하는 것은 카드 키 목록뿐(meta.seen 본 카드, meta.bandOff 띠를 닫은 카드).
import { play } from '../loop.js';
import { ease, Spring, SPR, driver } from './spring.js';
import * as store from '../store.js';
import { now } from '../dates.js';
import { latestPubKey, hasRecords, analyze } from '../week.js';
import { orbCanvas } from '../sky/orb.js';

export function createArrival(env) {
  const { C, reduced, app } = env;
  const scr = document.getElementById('screen-today');
  const band = document.createElement('div'); band.className = 'arrival'; band.hidden = true;
  const main = document.createElement('button'); main.type = 'button'; main.className = 'arrival-main';
  const orb = document.createElement('span'); orb.className = 'arrival-orb'; orb.setAttribute('aria-hidden', 'true');
  const txt = document.createElement('span'); txt.className = 'arrival-t'; txt.textContent = C.today.arrival;
  main.append(orb, txt);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'arrival-x'; close.setAttribute('aria-label', C.misc.close);
  close.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
  band.append(main, close);
  scr.insertBefore(band, document.getElementById('settingsBtn'));
  const tab = document.querySelector('.tab[data-tab="forecast"]');
  const dot = document.createElement('i'); dot.className = 'tab-dot'; dot.hidden = true; dot.setAttribute('aria-hidden', 'true'); tab.appendChild(dot);
  let L = null, shown = null, cfg = null, fadeH = null;
  const p = new Spring(0, SPR.soft, 0.002);
  const kick = driver([p], apply);

  // 크기별 규칙(§4.6): 320은 글자를 밀지 않고 한마디 자리에 겹침(고치기 단추 아래 line+10, 메모는 띠 아래 +6, 2줄), 360은 +44, 390·430은 +48.
  // 밀린 묶음이 .49H를 넘으면 띠가 있는 동안 한마디를 숨기고 메모를 그 자리로 올린다.
  function conf() {
    const xs = L.cls === 'xs', shift = xs ? 0 : L.cls === 's' ? 44 : 48, ty = L.textY;
    const memoEl = document.getElementById('memoView'), lineEl = document.getElementById('line');
    let noLine = xs, memoShift = xs ? ty.line + 10 + 40 + 6 - ty.memo : shift;
    if (!xs) {
      const memoOn = memoEl.textContent.trim() !== '' && getComputedStyle(memoEl).visibility !== 'hidden';
      const bottom = memoOn ? ty.memo + shift + memoEl.offsetHeight : ty.line + shift + lineEl.offsetHeight;
      if (bottom > 0.49 * L.H) { noLine = true; memoShift = shift - (ty.memo - ty.line); }
    }
    return { xs, shift, memoShift, noLine, top: xs ? ty.line + 10 : L.sat + 60, h: xs ? 40 : 44 };
  }
  function place() {
    band.style.top = cfg.top + 'px'; band.style.height = cfg.h + 'px'; band.classList.toggle('xs', cfg.xs);
    app.classList.toggle('bd-noline', cfg.noLine); app.classList.toggle('bd-xs', cfg.xs);
  }
  function apply() {
    if (!cfg) return; const v = p.x;
    app.style.setProperty('--bd', (cfg.shift * v).toFixed(2) + 'px');
    app.style.setProperty('--bdm', (cfg.memoShift * v).toFixed(2) + 'px');
    band.style.transform = reduced ? '' : `translateY(${(-12 * (1 - v)).toFixed(2)}px)`;
  }
  function showBand(k, anim) {
    const an = analyze(k, store.allDays(), C, now());
    orb.textContent = ''; orb.appendChild(orbCanvas(an.rep, 24));
    if (fadeH) { fadeH.cancel(); fadeH = null; }
    band.hidden = false; cfg = conf(); place();
    if (!anim || reduced) {
      p.set(1); apply();
      if (anim) { band.style.opacity = '0'; fadeH = play(180, (q) => { band.style.opacity = q >= 1 ? '' : q.toFixed(3); }); } else band.style.opacity = '';
      return;
    }
    band.style.opacity = '0'; p.set(0); p.to(1, SPR.soft); kick();
    fadeH = play(240, (q) => { band.style.opacity = q >= 1 ? '' : ease.out(q).toFixed(3); });
  }
  function hideBand(anim) {
    if (fadeH) { fadeH.cancel(); fadeH = null; }
    const done = () => { band.hidden = true; band.style.opacity = ''; band.style.transform = ''; app.classList.remove('bd-noline', 'bd-xs'); app.style.removeProperty('--bd'); app.style.removeProperty('--bdm'); cfg = null; };
    if (band.hidden) { done(); return; }
    if (!anim || reduced) { p.set(0); done(); return; }
    p.to(0, SPR.soft); kick();
    fadeH = play(520, (q, e) => { band.style.opacity = Math.max(0, 1 - ease.in(Math.min(1, e / 160))).toFixed(3); if (q >= 1) { p.set(0); done(); } });
  }
  function pendingKey() {
    if (store.inSample()) return null;
    const nd = now(), k = latestPubKey(nd);
    if (!hasRecords(k, store.allDays(), nd)) return null;
    return (store.getMeta('seen') || []).includes(k) ? null : k;
  }
  function refresh(anim) {
    const k = pendingKey(); dot.hidden = !k;
    if (k) tab.setAttribute('aria-label', `${C.tabs.forecast}, ${C.extra.new_card}`); else tab.removeAttribute('aria-label');
    const want = k && !(store.getMeta('bandOff') || []).includes(k) ? k : null;
    if (want === shown) { if (want && L) { cfg = conf(); place(); apply(); } return; }
    shown = want;
    if (want) showBand(want, anim); else hideBand(anim);
  }
  main.addEventListener('click', () => env.onOpen());
  close.addEventListener('click', () => {
    if (!shown) return;
    const off = (store.getMeta('bandOff') || []).filter((x) => x !== shown); off.push(shown); store.setMeta('bandOff', off.slice(-20));
    refresh(true);
  });
  return {
    layout(newL) { L = newL; if (shown && cfg) { cfg = conf(); place(); apply(); } },
    refresh,
    pendingKey,
    markSeen(k) {
      if (store.inSample() || !k) return;
      const s = store.getMeta('seen') || [];
      if (!s.includes(k)) { s.push(k); store.setMeta('seen', s.slice(-60)); }
      refresh(false);
    },
    state() { return { band: !band.hidden, dot: !dot.hidden, key: pendingKey(), shown, seen: store.getMeta('seen') || [], off: store.getMeta('bandOff') || [], top: band.style.top, bd: app.style.getPropertyValue('--bd'), bdm: app.style.getPropertyValue('--bdm'), noLine: app.classList.contains('bd-noline') }; },
  };
}
