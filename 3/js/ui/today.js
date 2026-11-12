// 오늘 화면: 상태 A(고르기 전)·B(고른 뒤 메모)·C(저장 뒤), 구슬 선반(누르기·훑기), 메모, 저장 연출, 이번 주 띠, 말풍선
import * as loop from '../loop.js';
import { play, after } from '../loop.js';
import { ease, seg, Spring, SPR, driver, pressable, clamp01 } from './spring.js';
import { WEATHERS, skyInk, groundInk, INK_DARK, INK_LIGHT } from '../palette.js';
import { orbCanvas, drawOrb } from '../sky/orb.js';
import { fmt, pick } from '../copy.js';
import * as store from '../store.js';
import { now, dayKey, weekDays, addDays, sameDayLastMonth, rng, pad, monIndex, hashStr } from '../dates.js';

const TAU = Math.PI * 2;
const RANGES = { thunder: [31, 36], sunny: [22, 26], rainbow: [18, 21], cloudy: [14, 17], rain: [8, 12], snow: [-4, 2] };
export function tempFor(w, key) { const r = RANGES[w]; if (!r) return null; const g = rng(key, 'temp', w); return r[0] + Math.floor(g() * (r[1] - r[0] + 1)); }
// 닫힌 꼴 스프링 응답(0→1, 초기 속도 0)
function springCurve(cfg) {
  const w0 = Math.sqrt(cfg.k), z = cfg.c / (2 * w0);
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return (ms) => { if (ms <= 0) return 0; const t = ms / 1000; return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); }; }
  return (ms) => { if (ms <= 0) return 0; const t = ms / 1000; return 1 - Math.exp(-w0 * t) * (1 + w0 * t); };
}
const POP = springCurve(SPR.pop), SOFT = springCurve(SPR.soft), BOUNCE = springCurve(SPR.bounce);

export function createToday(env) {
  const { app, sky, C, reduced } = env;
  const $ = (id) => document.getElementById(id);
  const E = { top: $('top'), place: $('place'), when: $('when'), hero: $('hero'), wname: $('wname'), line: $('line'), memoView: $('memoView'), settings: $('settingsBtn'), edit: $('editBtn'), friend: $('friendHit'), bubble: $('bubble'), hint: $('hint'), picker: $('picker'), memoRow: $('memoRow'), memo: $('memo'), count: $('memoCount'), save: $('saveBtn'), info: $('infoRow'), lookback: $('lookback'), countView: $('countView'), week: $('week'), tabs: $('tabs') };
  const X = C.extra;
  let L = null;
  const st = { key: dayKey(now()), rec: null, sel: null, mode: 'A', busy: false, quiet: false, tod: 'day', heroStr: null, heroVal: null, heroH: [], inkTok: 0, lastTalk: -1e9, talkI: 0, bubH: null, drag: null };
  st.rec = store.getDay(st.key); st.sel = st.rec ? st.rec.w : null; st.mode = st.rec ? 'C' : 'A';
  const firstDone = () => store.count() > 0;

  // ---------- 고정 문구·이름 ----------
  E.place.textContent = C.app.place;
  E.save.textContent = C.today.save;
  E.edit.textContent = C.today.edit;
  E.settings.setAttribute('aria-label', C.misc.open_settings);
  E.friend.setAttribute('aria-label', `${C.misc.friend_label} ${C.friend.name}`);
  E.memo.setAttribute('aria-label', C.misc.memo_label);
  E.picker.setAttribute('aria-label', X.picker_label);
  E.week.setAttribute('aria-label', X.week_label); E.week.setAttribute('role', 'list');
  E.hint.textContent = C.today.hint;
  const pressSave = pressable(E.save); pressable(E.edit); pressable(E.settings);

  // ---------- 보이기/숨기기 ----------
  function vis(el, on, o = {}) {
    if (el._v) el._v.cancel();
    el.dataset.on = on ? '1' : '0';
    el.inert = !on; if (!on) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
    const dy = reduced ? 0 : o.dy || 0;
    if (o.instant) { el.style.opacity = on ? '' : '0'; el.style.transform = ''; el.style.visibility = on ? '' : 'hidden'; return; }
    if (on) el.style.visibility = '';
    const a0 = el.style.visibility === 'hidden' ? 0 : el.style.opacity === '' ? 1 : parseFloat(el.style.opacity);
    const a1 = on ? 1 : 0; const dur = reduced ? 180 : o.dur || (on ? 240 : 160);
    if (a0 === a1 && !dy) { if (!on) el.style.visibility = 'hidden'; return; }
    el._v = play(dur, (p) => {
      const e = on ? ease.out(p) : ease.in(p);
      el.style.opacity = (a0 + (a1 - a0) * e).toFixed(3);
      el.style.transform = dy ? `translateY(${((on ? 1 - e : e) * dy).toFixed(2)}px)` : '';
      if (p >= 1) { if (on) { el.style.opacity = ''; el.style.transform = ''; } else el.style.visibility = 'hidden'; }
    }, o.delay || 0);
  }
  const isOn = (el) => el.dataset.on === '1';

  // ---------- 잉크 ----------
  function applyInk(w, tod) {
    const sk = skyInk(w || 'none', tod), gk = groundInk(w || 'none', tod);
    app.style.setProperty('--sky-ink', sk === 'dark' ? INK_DARK : INK_LIGHT);
    app.style.setProperty('--ground-ink', gk === 'dark' ? INK_DARK : INK_LIGHT);
    app.classList.toggle('ground-dark', gk === 'dark'); app.classList.toggle('sky-dark', sk === 'dark');
  }
  function inkLater(ms) { const tok = ++st.inkTok; const w = st.sel, tod = st.tod; if (ms <= 0 || reduced) { applyInk(w, tod); return; } after(ms, () => { if (tok === st.inkTok) applyInk(w, tod); }); }

  // ---------- 글자 ----------
  function swapText(el, text, mode) {
    if (el._h) { el._h.cancel(); el._h = null; }
    if (el.textContent === text && el.style.opacity === '') return;
    if (mode === 'instant' || reduced) { el.textContent = text; el.style.opacity = ''; el.style.transform = ''; return; }
    const out = mode === 'scrub' ? 50 : 120, inn = mode === 'scrub' ? 70 : 160;
    const a0 = el.style.opacity === '' ? 1 : parseFloat(el.style.opacity);
    el._h = play(out + inn, (p, e) => {
      if (e < out) el.style.opacity = (a0 * (1 - e / out)).toFixed(3);
      else { if (el.textContent !== text) el.textContent = text; const q = ease.out((e - out) / inn); el.style.opacity = q.toFixed(3); el.style.transform = `translateY(${((1 - q) * 4).toFixed(2)}px)`; if (p >= 1) { el.style.opacity = ''; el.style.transform = ''; } }
    });
  }
  function heroHTML(str) {
    E.hero.textContent = ''; E.hero.classList.toggle('blank', str === '—');
    for (const ch of str) { const s = document.createElement('span'); s.className = 'dg'; const i = document.createElement('span'); if (ch === '—') i.className = 'dash'; else i.textContent = ch; s.appendChild(i); E.hero.appendChild(s); }
    const d = document.createElement('span'); d.className = 'deg'; d.textContent = '°'; E.hero.appendChild(d);
  }
  function setTemp(val, mode) {
    const str = val == null ? '—' : val < 0 ? '−' + Math.abs(val) : String(val);
    E.hero.setAttribute('role', 'img'); E.hero.setAttribute('aria-label', val == null ? '—°' : fmt(X.temp_label, { t: val < 0 ? '영하 ' + Math.abs(val) : val }));
    const old = st.heroStr, oldVal = st.heroVal; st.heroStr = str; st.heroVal = val;
    if (old === str) return;
    st.heroH.forEach((h) => h.cancel()); st.heroH = [];
    if (mode === 'instant' || reduced || old == null) { heroHTML(str); E.hero.style.opacity = ''; E.hero.style.transform = ''; return; }
    if (old.length !== str.length || val == null || oldVal == null) {
      const out = mode === 'scrub' ? 50 : 120, inn = mode === 'scrub' ? 70 : 160;
      st.heroH.push(play(out + inn, (p, e) => { if (e < out) E.hero.style.opacity = (1 - e / out).toFixed(3); else { if (st.heroStr !== E.hero.dataset.s) { heroHTML(st.heroStr); E.hero.dataset.s = st.heroStr; } const q = ease.out((e - out) / inn); E.hero.style.opacity = q.toFixed(3); E.hero.style.transform = `translateY(${((1 - q) * 4).toFixed(2)}px)`; if (p >= 1) { E.hero.style.opacity = ''; E.hero.style.transform = ''; } } }));
      E.hero.dataset.s = old; return;
    }
    E.hero.style.opacity = ''; E.hero.style.transform = '';
    const dir = val > oldVal ? 1 : -1; const slots = E.hero.querySelectorAll('.dg');
    const dur = mode === 'scrub' ? 120 : 240, d0 = mode === 'scrub' ? 0 : 120;
    [...str].forEach((ch, i) => {
      const slot = slots[i]; if (!slot) return;
      slot.querySelectorAll('.out').forEach((n) => n.remove());
      const cur = slot.lastElementChild; if (!cur || cur.textContent === ch) { if (cur) { cur.style.opacity = ''; cur.style.transform = ''; } return; }
      cur.classList.add('out'); const nn = document.createElement('span'); nn.textContent = ch; nn.style.opacity = '0'; nn.style.transform = `translateY(${18 * dir}px)`; slot.appendChild(nn);
      const k = dur / 240; // fix1-3
      st.heroH.push(play(dur, (p, el) => { const e = ease.out(p); nn.style.transform = `translateY(${((1 - e) * 18 * dir).toFixed(2)}px)`; nn.style.opacity = ease.out(clamp01((el - 60 * k) / (160 * k))).toFixed(3); cur.style.transform = `translateY(${(-e * 18 * dir).toFixed(2)}px)`; cur.style.opacity = (1 - ease.in(clamp01(el / (120 * k)))).toFixed(3); if (p >= 1) { cur.remove(); nn.style.transform = ''; nn.style.opacity = ''; } }, d0 + 30 * i));
    });
  }
  const lineFor = (w) => pick(L.t.oneLine ? C.weather[w].lines_short : C.weather[w].lines, st.key + '|' + w + '|line');
  function renderTop(mode = 'instant') {
    const w = st.sel;
    setTemp(w ? tempFor(w, st.key) : null, mode);
    swapText(E.wname, w ? C.weather[w].name : C.today.question, mode);
    swapText(E.line, w ? lineFor(w) : !L.t.hint && !firstDone() ? C.today.hint : '', mode);
    const memo = st.mode === 'C' && st.rec ? st.rec.memo : '';
    E.memoView.textContent = memo;
    if (st.mode === 'C' && memo) vis(E.memoView, true, { instant: mode === 'instant', dy: 4, dur: 300 }); else vis(E.memoView, false, { instant: true });
    if (mode === 'instant') fitTop(); else after(330, fitTop);
  }
  function whenText() { const d = now(); return fmt(X.date_format, { m: d.getMonth() + 1, d: d.getDate(), w: C.misc.weekday_names[monIndex(d)] }) + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  // ---------- 구슬 선반 ----------
  const items = WEATHERS.map((w, i) => {
    const node = document.createElement('div'); node.className = 'pick'; node.setAttribute('role', 'radio'); node.setAttribute('aria-checked', 'false'); node.setAttribute('aria-label', C.weather[w].name); node.tabIndex = i === 0 ? 0 : -1;
    const sh = document.createElement('i'); sh.className = 'shadow';
    const wrap = document.createElement('div'); wrap.className = 'orb-wrap';
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = C.weather[w].name; lbl.setAttribute('aria-hidden', 'true');
    node.append(sh, wrap, lbl); E.picker.appendChild(node);
    const it = { w, node, sh, wrap, lbl, lift: new Spring(0, SPR.pop, 0.05), sc: new Spring(1, SPR.pop, 0.0005), ey: 0, es: 1, ea: 1 };
    it.kick = driver([it.lift, it.sc], () => paintItem(it));
    return it;
  });
  function paintItem(it) {
    it.wrap.style.transform = `translateY(${(it.ey - it.lift.x).toFixed(2)}px) scale(${(it.sc.x * it.es).toFixed(4)})`;
    it.wrap.style.opacity = it.ea >= 1 ? '' : it.ea.toFixed(3);
    it.sh.style.opacity = (clamp01(it.lift.x / 12) * it.ea).toFixed(3);
    it.lbl.style.opacity = it.ea >= 1 ? '' : it.ea.toFixed(3);
  }
  function raise(instant) {
    const si = WEATHERS.indexOf(st.sel);
    items.forEach((it, i) => {
      const d = si < 0 ? 9 : Math.abs(i - si); const lift = d === 0 ? 12 : d === 1 ? 3 : 0, sc = d === 0 ? 1.2 : d === 1 ? 1.05 : 1;
      if (instant || reduced) { it.lift.set(lift); it.sc.set(sc); paintItem(it); } else { it.lift.to(lift, SPR.pop); it.sc.to(sc, SPR.pop); it.kick(); }
      it.node.setAttribute('aria-checked', d === 0 ? 'true' : 'false');
      it.node.tabIndex = (si < 0 ? i === 0 : d === 0) ? 0 : -1;
    });
  }
  function choose(w, mode) {
    if (st.busy || st.sel === w) return;
    st.sel = w;
    sky.setScene(w, st.tod, mode);
    raise(false);
    inkLater(mode === 'scrub' ? 90 : 310);
    renderTop(mode);
    E.memo.placeholder = pick(C.weather[w].placeholders, st.key + '|' + w + '|ph');
    env.onScene(w, st.tod);
  }
  const vib = (p) => env.vibrate(p);
  E.picker.addEventListener('pointerdown', (e) => {
    if (st.busy || e.button > 0) return;
    e.preventDefault();
    try { E.picker.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    const r = E.picker.getBoundingClientRect(); const cw = r.width / 6;
    const i = Math.max(0, Math.min(5, Math.floor((e.clientX - r.left) / cw)));
    st.drag = { id: e.pointerId, x0: e.clientX, i, moved: 0, left: r.left, cw };
    if (st.sel !== WEATHERS[i]) { choose(WEATHERS[i], 'tap'); vib(10); }
    else { const it = items[i]; it.sc.set(1.12); it.sc.to(1.2, SPR.pop); it.kick(); }
  });
  E.picker.addEventListener('pointermove', (e) => {
    const D = st.drag; if (!D || e.pointerId !== D.id) return;
    D.moved = Math.max(D.moved, Math.abs(e.clientX - D.x0));
    const x = e.clientX - D.left, lo = D.i * D.cw - 6, hi = (D.i + 1) * D.cw + 6;
    if (x < lo || x > hi) { const ni = Math.max(0, Math.min(5, Math.floor(x / D.cw))); if (ni !== D.i) { D.i = ni; choose(WEATHERS[ni], 'scrub'); vib(8); } }
  });
  const endDrag = (e) => { const D = st.drag; if (!D || (e && e.pointerId !== D.id)) return; st.drag = null; sky.commit(); if (st.sel && st.mode !== 'B') toB(); };
  E.picker.addEventListener('pointerup', endDrag); E.picker.addEventListener('pointercancel', endDrag);
  E.picker.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let i = WEATHERS.indexOf(st.sel);
    if (step || e.key === 'Home' || e.key === 'End') { e.preventDefault(); const ni = e.key === 'Home' ? 0 : e.key === 'End' ? 5 : i < 0 ? (step > 0 ? 0 : 5) : (i + step + 6) % 6; choose(WEATHERS[ni], 'tap'); items[ni].node.focus(); if (st.mode !== 'B') toB(); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); const fi = items.findIndex((it) => it.node === document.activeElement); if (fi >= 0) { choose(WEATHERS[fi], 'tap'); if (st.mode !== 'B') toB(); } }
  });

  // ---------- 상태 ----------
  function setMode(m, o = {}) {
    st.mode = m; const inst = !!o.instant;
    vis(E.hint, m === 'A' && L.t.hint && !firstDone(), { instant: inst });
    vis(E.picker, m === 'A' || m === 'B', { instant: inst });
    vis(E.memoRow, m === 'B', { instant: inst, dy: m === 'B' ? 16 : 12, delay: m === 'B' ? 100 : 0, dur: m === 'B' ? 240 : 280 });
    const fastOut = m === 'B' ? 100 : undefined; // 아래 두 줄이 동시에 보이지 않게: 나가는 줄 0~100, 들어오는 줄 100부터(fix1-1)
    vis(E.info, m === 'C', { instant: inst, dur: fastOut });
    vis(E.week, m === 'C', { instant: inst, dy: 12, dur: fastOut });
    if (env.isToday()) vis(E.tabs, m !== 'B', { instant: inst, dur: fastOut });
    vis(E.edit, m === 'C', { instant: inst });
    fitTop();
  }
  function toB() {
    if (!st.sel) return;
    E.memo.placeholder = pick(C.weather[st.sel].placeholders, st.key + '|' + st.sel + '|ph');
    setMode('B');
  }
  function startEdit() {
    if (st.busy || !st.rec) return;
    st.sel = st.rec.w; E.memo.value = st.rec.memo || ''; updCount();
    raise(true); items.forEach((it, i) => { it.es = reduced ? 1 : 0; it.ea = 1; paintItem(it); if (!reduced) play(420, (p, e) => { it.es = POP(e); paintItem(it); if (p >= 1) { it.es = 1; paintItem(it); } }, 100 + 40 * i); });
    vis(E.memoView, false, {}); setMode('B');
  }
  E.edit.addEventListener('click', startEdit);
  function updCount() { const n = [...E.memo.value].length; E.count.textContent = n >= 40 ? `${n}/50` : ''; }
  E.memo.addEventListener('input', updCount);
  E.memo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } });
  // 키보드: 메모·저장 줄만 올린다 (research 3-f)
  const vv = window.visualViewport;
  const onVV = () => { const off = vv ? Math.max(0, window.innerHeight - (vv.offsetTop + vv.height)) : 0; E.memoRow.style.transform = off > 1 ? `translateY(${-off}px)` : ''; };
  E.memo.addEventListener('focus', () => { app.classList.add('typing'); if (vv) { vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV); } onVV(); });
  E.memo.addEventListener('blur', () => { app.classList.remove('typing'); if (vv) { vv.removeEventListener('resize', onVV); vv.removeEventListener('scroll', onVV); } E.memoRow.style.transform = ''; });
  E.save.addEventListener('click', save);

  // ---------- 이번 주 띠 ----------
  function buildWeek(hideToday) {
    E.week.textContent = '';
    const days = weekDays(now());
    days.forEach((d, i) => {
      const k = dayKey(d), rec = store.getDay(k), future = k > st.key, today = k === st.key;
      const li = document.createElement('li'); li.setAttribute('role', 'listitem');
      li.className = (future ? 'future' : '') + (today ? ' today' : '');
      const hole = document.createElement('div'); hole.className = 'hole';
      if (rec && !(today && hideToday)) hole.appendChild(orbCanvas(rec.w, L.t.hole));
      const wd = document.createElement('span'); wd.className = 'wd'; wd.textContent = C.misc.weekdays_mon_first[i]; wd.setAttribute('aria-hidden', 'true');
      li.append(hole, wd);
      li.setAttribute('aria-label', `${C.misc.weekday_names[i]} ${rec && !(today && hideToday) ? C.weather[rec.w].name : future ? X.day_future : X.day_empty}`);
      E.week.appendChild(li);
    });
  }
  function renderInfo(n) {
    const d = now(); let txt = '';
    const lw = store.getDay(dayKey(addDays(d, -7)));
    if (lw) txt = C.today.lookback_lastweek + C.weather[lw.w].was;
    else { const lm = sameDayLastMonth(d); const r = lm && store.getDay(dayKey(lm)); if (r) txt = C.today.lookback_lastmonth + C.weather[r.w].was; }
    E.lookback.textContent = txt;
    const [pre, post] = C.today.count.split('{n}');
    E.countView.textContent = '';
    const a = document.createElement('span'); a.textContent = pre || '';
    const box = document.createElement('span'); box.className = 'num'; box.style.cssText = 'display:inline-block;position:relative;overflow:hidden;height:18px';
    const roll = document.createElement('span'); roll.className = 'roll'; roll.textContent = String(n); box.appendChild(roll);
    const b = document.createElement('span'); b.className = 'roll'; b.textContent = post || '';
    E.countView.append(a, box, b); E.countView.setAttribute('aria-label', fmt(C.today.count, { n }));
  }
  function rollCount(n) {
    const box = E.countView.querySelector('.num'); if (!box) return;
    const old = box.firstElementChild; const nn = document.createElement('span'); nn.className = 'roll'; nn.textContent = String(n);
    nn.style.position = 'absolute'; nn.style.left = '0'; nn.style.top = '0'; nn.style.transform = 'translateY(14px)'; box.appendChild(nn);
    E.countView.setAttribute('aria-label', fmt(C.today.count, { n }));
    play(240, (p) => { const e = ease.out(p); nn.style.transform = `translateY(${((1 - e) * 14).toFixed(2)}px)`; old.style.transform = `translateY(${(-e * 14).toFixed(2)}px)`; old.style.opacity = (1 - e).toFixed(3); if (p >= 1) { old.remove(); nn.style.position = ''; nn.style.transform = ''; } });
  }

  // ---------- 저장 (§6.2) ----------
  const fx = env.fx, fxc = fx.getContext('2d'); let fxDpr = 1;
  function sizeFx() { fxDpr = Math.min(2, window.devicePixelRatio || 1); fx.width = Math.round(L.W * fxDpr); fx.height = Math.round(L.H * fxDpr); fx.style.width = L.W + 'px'; fx.style.height = L.H + 'px'; }
  function fxClear() { fxc.setTransform(1, 0, 0, 1, 0, 0); fxc.clearRect(0, 0, fx.width, fx.height); fxc.setTransform(fxDpr, 0, 0, fxDpr, 0, 0); }
  function holeCenter(i) { const cw = (L.W - 2 * L.outer) / 7; return [L.outer + cw * (i + 0.5), L.stripTop + L.t.hole / 2]; }
  function drawRings(e, x, y) {
    const col = app.classList.contains('ground-dark') ? '27,36,51' : '255,251,242';
    for (let k = 0; k < 2; k++) { const q = seg(e, k * 100, 360); if (q <= 0 || q >= 1) continue; const qq = ease.out(q); fxc.strokeStyle = `rgba(${col},${(0.6 * (1 - qq)).toFixed(3)})`; fxc.lineWidth = Math.max(0.05, 2 * (1 - qq)); fxc.beginPath(); fxc.arc(x, y, 20 + 36 * qq, 0, TAU); fxc.stroke(); }
  }
  function drawSeal(e, o) {
    fxClear();
    if (e >= 1060) { drawRings(e - 1060, o.tx, o.ty); return; }
    if (e < 120) return;
    let x = o.cx, y = o.cy, d, rot = 0, sweep = 0, sc = 1, ba = 0.35; const y0 = o.cy - 6; // fix1-13
    if (e < 640) { d = 104 * POP(e - 120); y = o.cy - 6 * ease.inout(seg(e, 320, 320)); if (e >= 520) { const q = seg(e, 520, 120); sweep = ease.inout(q); sc = 1 + 0.03 * Math.sin(Math.PI * q); } }
    else { const q = ease.fly(seg(e, 640, 420)); const p1x = (o.cx + o.tx) / 2, p1y = o.cy - 90; x = (1 - q) * (1 - q) * o.cx + 2 * (1 - q) * q * p1x + q * q * o.tx; y = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * p1y + q * q * o.ty; d = 104 + (L.t.hole - 104) * q; rot = TAU * q; ba = 0.35 * (1 - seg(e, 640, 420)); }
    if (d < 0.5) return;
    fxc.save(); fxc.translate(x, y); fxc.scale(sc, sc); drawOrb(fxc, o.w, d, { bleed: o.bleed, bleedA: ba, rot, sweep }); fxc.restore();
  }
  function land(w, ti, n, quiet) {
    const li = E.week.children[ti]; if (!li) return; const hole = li.querySelector('.hole');
    hole.querySelectorAll('canvas').forEach((c) => c.remove());
    const cv = orbCanvas(w, L.t.hole); hole.appendChild(cv);
    li.setAttribute('aria-label', `${C.misc.weekday_names[ti]} ${C.weather[w].name}`);
    if (quiet === 'still') { if (n != null) renderInfo(n); return; }
    if (quiet) { cv.style.opacity = '0'; play(reduced ? 200 : 420, (p) => { cv.style.opacity = (reduced ? p : ease.inout(p)).toFixed(3); if (p >= 1) cv.style.opacity = ''; }); if (n != null) renderInfo(n); return; }
    vib([8, 30, 12]);
    play(560, (p, e) => { const k = BOUNCE(e); cv.style.transform = `scale(${(1.16 - 0.16 * k).toFixed(4)}, ${(0.84 + 0.16 * k).toFixed(4)})`; if (p >= 1) cv.style.transform = ''; });
    play(240, (p, e) => { const d = e < 120 ? 2 * ease.out(e / 120) : 2 * (1 - ease.out((e - 120) / 120)); hole.style.transform = `translateY(${d.toFixed(2)}px)`; if (p >= 1) hole.style.transform = ''; });
    [...E.week.children].forEach((n2, j) => {
      if (j === ti) return; const k = Math.abs(j - ti), dir = j < ti ? -1 : 1, h2 = n2.querySelector('.hole');
      play(560, (p, e) => { const d = e < 80 ? 3 * ease.out(e / 80) : 3 * (1 - POP(e - 80)); h2.style.transform = `translateX(${(dir * d).toFixed(2)}px)`; if (p >= 1) h2.style.transform = ''; }, 40 * (k - 1));
    });
    if (n != null) rollCount(n);
  }
  function hidePicker(stagger) {
    items.forEach((it, i) => play(140, (p) => { const e = ease.in(p); it.ey = 30 * e; it.ea = 1 - e; paintItem(it); }, stagger + 20 * i));
    after(stagger + 20 * 5 + 160, () => { vis(E.picker, false, { instant: true }); items.forEach((it) => { it.ey = 0; it.ea = 1; paintItem(it); }); });
  }
  function save() {
    if (st.busy || !st.sel) return;
    // 날짜 키는 저장 순간의 기기 현지 날짜로 정한다. 자정을 넘겼는데 화면이 아직 어제면 새날로 넘긴 뒤 저장한다(고른 날씨·메모는 그대로)
    const nowKey = dayKey(now());
    if (nowKey !== st.key) { st.key = nowKey; st.rec = store.getDay(nowKey); E.when.textContent = whenText(); if (env.onRollover) env.onRollover(); }
    const w = st.sel, memo = E.memo.value.trim().slice(0, 50), isEdit = !!st.rec, prevMemo = st.rec ? st.rec.memo || '' : '';
    const res = store.setDay(st.key, { w, memo, t: tempFor(w, st.key) });
    if (!res.ok) { env.toast(res.full ? C.misc.storage_full : C.misc.save_failed); return; }
    // 위기 표현 판정은 저장이 끝난 뒤(safety-review §3). 맞으면(상한에 걸려도) 조용한 판으로 저장한다
    const hit = !!(env.isCrisis && env.isCrisis(memo, prevMemo)), quiet = st.quiet || hit;
    if (env.onSaved) env.onSaved({ key: st.key, w, memo, prevMemo, hit, quiet, isEdit });
    store.requestPersist();
    st.rec = store.getDay(st.key); const n = store.count(); const ti = monIndex(now()); const [tx, ty] = holeCenter(ti);
    E.memo.blur(); app.classList.remove('typing');
    pressSave.press();
    vis(E.memoRow, false, { dy: 24, dur: 240 }); vis(E.hint, false, { dur: 160 });
    st.busy = true;
    if (reduced) {
      vis(E.picker, false, {}); buildWeek(true); renderInfo(n); vis(E.week, true, {}); vis(E.info, true, {}); if (env.isToday()) vis(E.tabs, true, {});
      land(w, ti, null, true); st.mode = 'C'; renderTop('instant'); vis(E.edit, true, {}); after(200, () => { st.busy = false; });
      return;
    }
    if (quiet && !isEdit) { // 위기 표현이 감지된 저장(§6.2 끝): 잔물결·점프·진동·마무리 없이 구슬만 천천히 홈으로
      buildWeek(true); renderInfo(n - 1);
      vis(E.picker, false, { dur: 180 }); vis(E.week, true, { dur: 180 }); vis(E.info, true, { dur: 180 }); if (env.isToday()) vis(E.tabs, true, { dur: 180 });
      const qx = L.W / 2, qy = L.H * 0.36;
      play(620, (p, e) => { fxClear(); if (p >= 1) return; const a = Math.min(1, e / 200), q = ease.inout(seg(e, 200, 420)); fxc.save(); fxc.globalAlpha = a; fxc.translate(qx + (tx - qx) * q, qy + (ty - qy) * q); drawOrb(fxc, w, 104 + (L.t.hole - 104) * q); fxc.restore(); });
      after(620, () => { land(w, ti, n, 'still'); st.mode = 'C'; renderTop('save'); vis(E.edit, true, { dur: 180 }); st.busy = false; });
      return;
    }
    if (!quiet) vib(10);
    if (isEdit) {
      hidePicker(0); buildWeek(false); renderInfo(n);
      vis(E.week, true, { dy: 12, delay: 240, dur: 240 }); vis(E.info, true, { delay: 260 }); if (env.isToday()) vis(E.tabs, true, { delay: 240 });
      after(260, () => land(w, ti, null, quiet)); after(300, () => { st.mode = 'C'; renderTop('save'); vis(E.edit, true, { dur: 200 }); });
      after(500, () => { st.busy = false; });
      return;
    }
    const W = L.W, H = L.H, cx = W / 2, cy = H * 0.36;
    buildWeek(true); renderInfo(n - 1);
    sky.sealStart(cx, cy);
    hidePicker(240);
    if (E.week._v) E.week._v.cancel();
    E.week.dataset.on = '1'; E.week.inert = false; E.week.removeAttribute('aria-hidden'); E.week.style.visibility = ''; E.week.style.opacity = '0'; E.week.style.transform = 'translateY(12px)';
    play(720, (p, e) => { const k = SOFT(e); E.week.style.transform = `translateY(${(12 * (1 - k)).toFixed(2)}px)`; E.week.style.opacity = Math.min(1, e / 160).toFixed(3); if (p >= 1) { E.week.style.transform = ''; E.week.style.opacity = ''; } }, 480);
    vis(E.info, true, { delay: 560, dur: 280 }); if (env.isToday()) vis(E.tabs, true, { delay: 620, dur: 320 });
    const o = { w, cx, cy, tx, ty, bleed: sky.skyHex[1] };
    play(1460, (p, e) => { drawSeal(e, o); if (p >= 1) fxClear(); });
    after(900, () => { st.busy = false; });
    after(1060, () => land(w, ti, n));
    after(1100, () => { st.mode = 'C'; renderTop('save'); vis(E.edit, true, { dur: 300 }); });
    after(1300, () => talk(C.today.friend_saved, true));
  }

  // ---------- 구름 친구 ----------
  function placeFriend() { const f = sky.friendRest(); E.friend.style.left = Math.round(f.x - 36) + 'px'; E.friend.style.top = Math.round(f.base - 74) + 'px'; }
  function talk(pool, quietJump) {
    const t = loop.now(); if (!quietJump && t - st.lastTalk < 400) return; st.lastTalk = t;
    if (!quietJump) sky.friendTap();
    let lines = pool;
    if (!lines) {
      lines = st.sel ? C.weather[st.sel].friend : C.misc.friend_unpicked;
      const r = (st.talkI * 7 + hashStr(st.key)) % 10;
      if (st.tod === 'night' && r < 3) lines = C.today.friend_idle_night; else if (st.tod === 'dawn' && r < 3) lines = C.today.friend_idle_dawn;
    }
    const text = lines[(st.talkI++ + hashStr(st.key)) % lines.length];
    const b = E.bubble; b.textContent = text; b.style.transform = 'translate(-999px,-999px)'; b.style.opacity = '0';
    const bw = b.offsetWidth, bh = b.offsetHeight, head = sky.friendHead();
    const x = Math.max(8, Math.min(L.W - 8 - bw, head.x - bw / 2)), yAt = () => Math.max(L.sat + 8, sky.friendHead().top - 8 - 7 - bh); // 꼬리 끝 = 소품 포함 최상단 − 8, 매 프레임(fix1-6)
    b.style.setProperty('--tail', Math.max(14, Math.min(bw - 14, head.x - x)) + 'px'); b.style.transformOrigin = `${head.x - x}px 100%`;
    if (st.bubH) st.bubH.cancel();
    st.bubH = play(1960, (p, e) => { let a = 1, sc = 1; if (e < 200) { const q = reduced ? 1 : ease.out(e / 200); a = q; sc = 0.9 + 0.1 * POP(e); } else if (e > 1800) a = 1 - (e - 1800) / 160; b.style.opacity = Math.max(0, a).toFixed(3); b.style.transform = `translate(${x.toFixed(1)}px, ${yAt().toFixed(1)}px) scale(${Math.min(1.06, sc).toFixed(4)})`; });
  }
  E.friend.addEventListener('click', () => talk(null, false));

  // ---------- 위쪽 글자 묶음: 넘치면(200% 확대 등) 흐름 배치 + 그 묶음만 스크롤 ----------
  function fitTop() {
    if (!L) return;
    const T = E.top, bn = app.classList.contains('sample') ? 36 : 0;
    const lim = (st.mode === 'C' ? L.infoTop : st.mode === 'A' && isOn(E.hint) ? L.hintTop : L.pickerTop) - 6 - bn;
    T.style.height = Math.max(80, lim) + 'px';
    T.classList.remove('flow', 'scrolls');
    const kids = [E.place, E.when, E.hero, E.wname, E.line, E.memoView].filter((k) => k.textContent.trim() && getComputedStyle(k).visibility !== 'hidden');
    let bad = false;
    for (let i = 0; i < kids.length - 1 && !bad; i++) if (kids[i].getBoundingClientRect().bottom > kids[i + 1].getBoundingClientRect().top + 1) bad = true;
    const last = kids[kids.length - 1];
    if (last && last.getBoundingClientRect().bottom > T.getBoundingClientRect().top + T.clientHeight + 1) bad = true;
    if (bad) { T.classList.add('flow'); T.classList.toggle('scrolls', T.scrollHeight > T.clientHeight + 1); }
  }
  // 저장소와 다시 맞추기(달력에서 고치기·지우기, 예시 데이터 켜고 끄기, 자정)
  function sync(mode = 'tap') {
    st.key = dayKey(now()); st.rec = store.getDay(st.key);
    if (st.busy) return;
    st.sel = st.rec ? st.rec.w : null;
    const inst = mode === 'instant' || !env.isToday();
    sky.setScene(st.sel || 'none', st.tod, inst ? 'instant' : mode);
    if (inst) applyInk(st.sel, st.tod); else inkLater(310);
    raise(inst); E.memo.value = ''; updCount();
    if (st.sel) E.memo.placeholder = pick(C.weather[st.sel].placeholders, st.key + '|' + st.sel + '|ph');
    buildWeek(false); renderInfo(store.count());
    setMode(st.rec ? 'C' : 'A', { instant: inst }); renderTop(inst ? 'instant' : 'tap');
    env.onScene(st.sel, st.tod);
  }

  // ---------- 첫 사용 안내 잔물결 ----------
  function ripple(at) {
    let count = 0;
    const run = () => { if (st.sel || firstDone() || count >= 2 || reduced) return; count++; items.forEach((it, i) => play(320, (p) => { it.es = 1 + 0.08 * Math.sin(Math.PI * p); paintItem(it); if (p >= 1) { it.es = 1; paintItem(it); } }, 60 * i)); after(4200, run); };
    after(at, run);
  }

  // ---------- 바깥에 주는 것 ----------
  return {
    layout(newL) {
      const first = !L; L = newL; const t = L.t, s = app.style;
      const vars = { '--hero': t.hero + 'px', '--d1': t.d1[0] + 'px', '--d1lh': t.d1[1] + 'px', '--memo-fs': t.memo[0] + 'px', '--memo-lh': t.memo[1] + 'px', '--memo-lines': t.memo[2], '--pad': L.pad + 'px', '--outer': L.outer + 'px', '--cell': t.cell + 'px', '--orb': t.orb + 'px', '--hole': t.hole + 'px', '--strip': t.strip + 'px', '--tab': t.tab + 'px', '--memo-h': t.memoH + 'px', '--save-w': t.saveW + 'px', '--sat': L.sat + 'px', '--sab': L.sab + 'px' };
      for (const [k, v] of Object.entries(vars)) s.setProperty(k, v);
      const ty = L.textY; E.place.style.top = ty.place + 'px'; E.when.style.top = ty.when + 'px'; E.hero.style.top = ty.temp + 'px'; E.wname.style.top = ty.name + 'px'; E.line.style.top = ty.line + 'px'; E.memoView.style.top = ty.memo + 'px';
      E.edit.style.top = `calc(${ty.name - 2}px + var(--bn, 0px) + var(--bd, 0px))`;
      E.line.classList.toggle('one', t.oneLine);
      E.hint.style.top = L.hintTop + 'px'; E.picker.style.top = L.pickerTop + 'px'; E.memoRow.style.top = L.memoTop + 'px'; E.info.style.top = L.infoTop + 'px'; E.info.style.height = t.info + 'px'; E.week.style.top = L.stripTop + 'px';
      items.forEach((it) => { it.wrap.textContent = ''; it.wrap.appendChild(orbCanvas(it.w, t.orb)); });
      sizeFx(); placeFriend();
      if (!first) { buildWeek(false); renderInfo(store.count()); renderTop('instant'); setMode(st.mode, { instant: true }); }
      fitTop();
    },
    init() {
      st.tod = env.todNow();
      sky.setScene(st.sel || 'none', st.tod, 'instant');
      applyInk(st.sel, st.tod); raise(true); renderTop('instant');
      buildWeek(false); renderInfo(store.count());
      setMode(st.mode, { instant: true });
      E.when.textContent = whenText();
      if (st.sel) E.memo.placeholder = pick(C.weather[st.sel].placeholders, st.key + '|' + st.sel + '|ph');
      env.onScene(st.sel, st.tod);
    },
    introUI() {
      const topEls = [E.place, E.when, E.hero, E.wname, E.line, E.settings];
      topEls.forEach((el) => { el.style.opacity = '0'; });
      play(280, (p) => { const e = ease.out(p); topEls.forEach((el) => { el.style.opacity = e.toFixed(3); el.style.transform = `translateY(${((1 - e) * 8).toFixed(2)}px)`; }); if (p >= 1) topEls.forEach((el) => { el.style.opacity = ''; el.style.transform = ''; }); }, 620);
      items.forEach((it, i) => { it.es = 0; it.ea = 0; paintItem(it); play(420, (p, e) => { it.es = POP(e); it.ea = Math.min(1, e / 160); paintItem(it); if (p >= 1) { it.es = 1; it.ea = 1; paintItem(it); } }, 700 + 40 * i); });
      if (isOn(E.tabs)) { E.tabs.style.opacity = '0'; play(300, (p) => { E.tabs.style.opacity = p >= 1 ? '' : ease.out(p).toFixed(3); }, 760); }
      if (isOn(E.hint)) { E.hint.style.opacity = '0'; play(300, (p) => { E.hint.style.opacity = p >= 1 ? '' : ease.out(p).toFixed(3); }, 900); }
      ripple(1600);
    },
    reopenUI() { const cv = sky.cv; if (!reduced) { cv.style.opacity = '0'; play(160, (p) => { cv.style.opacity = p >= 1 ? '' : p.toFixed(3); }); } ripple(1600); },
    tick() { E.when.textContent = whenText(); },
    setTod(tod) { if (tod === st.tod) return; st.tod = tod; sky.setTod(tod, 'tod'); inkLater(3000); env.onScene(st.sel, tod); },
    newDay() { sync('tap'); },
    sync,
    setQuiet(v) { st.quiet = !!v; },
    onShowToday() { setMode(st.mode, {}); },
    mode: () => st.mode,
    busy: () => st.busy,
    // 시험용(?qa=1에서만 노출)
    qaJump(w, tod, mode) {
      st.tod = tod; st.sel = w === 'none' ? null : w;
      sky.setScene(st.sel || 'none', tod, 'instant'); applyInk(st.sel, tod); raise(true); renderTop('instant');
      if (st.sel) E.memo.placeholder = pick(C.weather[st.sel].placeholders, st.key + '|' + st.sel + '|ph');
      setMode(mode || (st.sel ? 'B' : 'A'), { instant: true }); env.onScene(st.sel, tod);
    },
    qaReloadWeek() { st.rec = store.getDay(st.key); buildWeek(false); renderInfo(store.count()); },
    friendTalk() { talk(null, false); },
  };
}
