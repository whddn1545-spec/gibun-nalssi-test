// 달력: 월 격자(일요일 시작), 월 넘김(끌기·단추, 미래 달 고무줄), 구슬, 오늘 고리, 월간 요약, 날짜 시트 (design-spec §7)
import { play } from '../loop.js';
import { ease, Spring, SPR, driver, springCurve } from './spring.js';
import { WEATHERS } from '../palette.js';
import { orbCanvas } from '../sky/orb.js';
import { fmt, pick } from '../copy.js';
import * as store from '../store.js';
import { now, dayKey, parseKey, monthGrid, monIndex } from '../dates.js';
import { tempFor } from './today.js';

const POP = springCurve(SPR.pop), SOFT = springCurve(SPR.soft), BOUNCE = springCurve(SPR.bounce);
const mi = (v) => v.y * 12 + v.m;
const addM = (v, k) => { const t = mi(v) + k; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; };
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(cls, text) { const b = el('button', cls, text); b.type = 'button'; return b; }
const CHEV = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

export function createCalendar(env) {
  const { C, reduced, sheet } = env; const X = C.extra;
  const root = document.getElementById('screen-calendar'); const inner = root.querySelector('.inner');
  const title = el('h2', 'board-title cal-title');
  const prev = btn('icon-btn cal-nav cal-prev'); prev.innerHTML = CHEV('M14.5 5.5 8 12l6.5 6.5'); prev.setAttribute('aria-label', C.misc.prev_month);
  const next = btn('icon-btn cal-nav cal-next'); next.innerHTML = CHEV('M9.5 5.5 16 12l-6.5 6.5'); next.setAttribute('aria-label', C.misc.next_month);
  const wd = el('div', 'cal-wd'); wd.setAttribute('aria-hidden', 'true'); C.misc.weekdays_sun_first.forEach((t) => wd.appendChild(el('span', '', t)));
  const vp = el('div', 'cal-vp');
  const sum = el('div', 'cal-sum'); const sumRow = el('div', 'cal-sum-row'); sum.append(el('p', 'cal-sum-line', C.calendar.summary), sumRow);
  const empty = el('div', 'cal-empty'); const cta = btn('pill-btn', C.calendar.sample_cta);
  empty.append(el('p', 'cal-empty-t', C.calendar.empty_title), el('p', 'cal-empty-b', C.calendar.empty_body), cta);
  inner.append(title, prev, next, wd, vp, sum, empty);
  cta.addEventListener('click', () => env.onSample && env.onSample());
  let L = null, CL = null, view = null, grid = null, busy = false, drag = null, suppress = false;
  const seen = new Set();
  const curM = () => { const d = now(); return { y: d.getFullYear(), m: d.getMonth() }; };
  const dateText = (d) => fmt(X.date_format, { m: d.getMonth() + 1, d: d.getDate(), w: C.misc.weekday_names[monIndex(d)] });

  function calLayout(L0) {
    const xs = L0.H < 640, W = L0.W, cellW = (W - 32) / 7;
    const [orb, cellH] = W <= 340 ? [32, 52] : W < 375 ? [38, 60] : W < 415 ? [40, 64] : [44, 68];
    const gridY = L0.sat + (xs ? 72 : 92);
    return { W, cellW, orb, cellH, numY: Math.min(orb + 6, cellH - 16), titleY: L0.sat + (xs ? 12 : 16), navY: L0.sat + (xs ? 7 : 11), wdY: L0.sat + (xs ? 52 : 68), gridY, sumY: Math.max(L0.sat + (xs ? 392 : 490), gridY + 6 * cellH + 12) };
  }
  // ---------- 격자 ----------
  function makeCell(d, m, r, c) {
    if (d.getMonth() !== m) { const e = el('div', 'cal-cell out'); e.style.top = r * CL.cellH + 'px'; return e; }
    const k = dayKey(d), tk = dayKey(now()), future = k > tk, today = k === tk, rec = store.getDay(k);
    const e = future ? el('div', 'cal-cell future') : btn('cal-cell');
    e.classList.toggle('today', today); e.classList.add(rec ? 'has' : 'empty');
    e.dataset.key = k; e.dataset.r = r; e.dataset.c = c; e.style.top = r * CL.cellH + 'px';
    const ob = el('span', 'cal-orb');
    if (rec) ob.appendChild(orbCanvas(rec.w, CL.orb));
    else if (today) ob.innerHTML = '<svg class="cal-dash" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="none" stroke="#F2C14E" stroke-width="2" stroke-dasharray="3 3"/></svg>';
    e.append(ob, el('span', 'cal-num', String(d.getDate())));
    e.setAttribute('aria-label', `${dateText(d)} ${rec ? C.weather[rec.w].name : future ? X.day_future : X.day_empty}`);
    if (future) e.setAttribute('aria-disabled', 'true');
    return e;
  }
  function buildGrid(v) {
    const g = el('div', 'cal-grid'); const days = monthGrid(v.y, v.m); const rows = days.length / 7;
    const cols = [];
    for (let c = 0; c < 7; c++) { const col = el('div', 'cal-col'); col.style.left = 16 + c * CL.cellW + 'px'; col.style.width = CL.cellW + 'px'; g.appendChild(col); cols.push(col); }
    days.forEach((d, i) => cols[i % 7].appendChild(makeCell(d, v.m, Math.floor(i / 7), i % 7)));
    g.dataset.rows = rows; g.dataset.key = `${v.y}-${v.m}`;
    return g;
  }
  const setX = (g, x) => { for (const col of g.children) col.style.transform = x ? `translateX(${x.toFixed(2)}px)` : ''; };
  function entrance(g) {
    const rows = +g.dataset.rows, step = Math.min(18, 180 / (rows - 1 + 6));
    g.querySelectorAll('.cal-orb canvas').forEach((cv) => {
      const cell = cv.closest('.cal-cell'), dl = (+cell.dataset.r + +cell.dataset.c) * step;
      cv.style.opacity = '0'; cv.style.transform = 'scale(.6)';
      play(330, (p, e) => { cv.style.transform = p >= 1 ? '' : `scale(${(0.6 + 0.4 * POP(e)).toFixed(4)})`; cv.style.opacity = p >= 1 ? '' : Math.min(1, e / 120).toFixed(3); }, dl);
    });
  }
  function header() {
    title.textContent = fmt(C.calendar.title_format, { y: view.y, m: view.m + 1 });
    next.hidden = mi(view) >= mi(curM());
  }
  function renderSummary() {
    const counts = Object.fromEntries(WEATHERS.map((w) => [w, 0])); let total = 0;
    const dim = new Date(view.y, view.m + 1, 0).getDate();
    for (let d = 1; d <= dim; d++) { const r = store.getDay(dayKey(new Date(view.y, view.m, d))); if (r) { counts[r.w]++; total++; } }
    const showEmpty = total === 0 && !store.inSample();
    sum.hidden = showEmpty; empty.hidden = !showEmpty;
    sumRow.textContent = '';
    for (const w of WEATHERS) { const col = el('div', 'cal-sum-col' + (counts[w] ? '' : ' zero')); col.setAttribute('aria-label', `${C.weather[w].name} ${counts[w]}`); col.append(orbCanvas(w, 24), el('span', 'cal-sum-n', String(counts[w]))); sumRow.appendChild(col); }
  }
  function render(anim) {
    header();
    const g = buildGrid(view); vp.textContent = ''; vp.appendChild(g); grid = g;
    renderSummary();
    const mk = g.dataset.key; if (anim && !reduced && !seen.has(mk)) entrance(g); seen.add(mk);
  }
  // ---------- 월 넘김 ----------
  function prep(dir) { // dir -1: 다음 달(왼쪽으로 끔), +1: 지난달
    if (drag && drag.nb) { drag.nb.remove(); drag.nb = null; }
    const tv = addM(view, -dir); const ok = mi(tv) <= mi(curM());
    drag.dir = dir; drag.allowed = ok; drag.tv = tv;
    if (ok) { const nb = buildGrid(tv); setX(nb, -dir * L.W); vp.appendChild(nb); drag.nb = nb; }
  }
  function settle(g, nb, from, dir, tv, done) {
    busy = true; const W = L.W, target = dir * W; const gc = [...g.children], nc = nb ? [...nb.children] : [];
    if (tv) { view = tv; header(); }
    play(reduced ? 1 : 620, (p, e) => {
      for (let c = 0; c < 7; c++) {
        const order = dir < 0 ? c : 6 - c; const k = reduced ? 1 : SOFT(e - 12 * order); const x = from + (target - from) * Math.min(1.02, k);
        gc[c].style.transform = `translateX(${x.toFixed(2)}px)`; if (nc[c]) nc[c].style.transform = `translateX(${(x - dir * W).toFixed(2)}px)`;
      }
      if (p >= 1) { busy = false; done(); }
    });
  }
  function commit(dir, from, nb, tv) {
    settle(grid, nb, from, dir, tv, () => { grid.remove(); grid = nb; setX(nb, 0); renderSummary(); const mk = nb.dataset.key; if (!seen.has(mk) && !reduced) entrance(nb); seen.add(mk); });
  }
  function back(from, nb, dir) { settle(grid, nb, from, 0, null, () => { setX(grid, 0); if (nb) nb.remove(); }); }
  function navigate(dir) {
    if (busy || sheet.isOpen()) return; const tv = addM(view, -dir); if (mi(tv) > mi(curM())) return;
    if (reduced) { view = tv; render(true); return; }
    const nb = buildGrid(tv); setX(nb, -dir * L.W); vp.appendChild(nb); commit(dir, 0, nb, tv);
  }
  prev.addEventListener('click', () => navigate(1)); next.addEventListener('click', () => navigate(-1));
  vp.addEventListener('pointerdown', (e) => { if (busy || sheet.isOpen() || e.button > 0) return; drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, on: false, hist: [[e.timeStamp, e.clientX]], nb: null }; });
  vp.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.on = true; try { vp.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } prep(dx < 0 ? -1 : 1); } else return; }
    const dir = dx < 0 ? -1 : 1; if (dir !== drag.dir) prep(dir);
    drag.dx = dx; drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
    const x = drag.allowed ? dx : dx * 0.25; setX(grid, x); if (drag.nb) setX(drag.nb, x - dir * L.W);
  });
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return; const d = drag; drag = null; if (!d.on) return;
    suppress = true; setTimeout(() => { suppress = false; }, 0);
    const a = d.hist[0], b = d.hist[d.hist.length - 1]; const v = b[0] > a[0] ? ((b[1] - a[1]) / (b[0] - a[0])) * 1000 : 0;
    const from = d.allowed ? d.dx : d.dx * 0.25;
    if (d.allowed && (Math.abs(d.dx) >= 70 || (Math.abs(v) >= 500 && Math.sign(v) === d.dir))) commit(d.dir, from, d.nb, d.tv); else back(from, d.nb, d.dir);
  };
  vp.addEventListener('pointerup', endDrag); vp.addEventListener('pointercancel', endDrag);
  vp.addEventListener('click', (e) => {
    if (suppress || busy) return; const cell = e.target.closest('button.cal-cell'); if (!cell || sheet.isOpen()) return;
    const cv = cell.querySelector('.cal-orb canvas');
    if (cv && !reduced) play(330, (p, t) => { const s = t < 80 ? 1 - 0.06 * ease.out(t / 80) : 0.94 + 0.06 * POP(t - 80); cv.style.transform = p >= 1 ? '' : `scale(${s.toFixed(4)})`; });
    openDay(cell.dataset.key);
  });

  // ---------- 날짜 시트 ----------
  function miniPicker(onPick, initial) {
    const row = el('div', 'mini-picker'); row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', X.picker_label);
    const items = WEATHERS.map((w) => {
      const it = el('div', 'mp'); it.setAttribute('role', 'radio'); it.setAttribute('aria-label', C.weather[w].name); it.tabIndex = -1;
      const wrap = el('div', 'mp-orb'); wrap.appendChild(orbCanvas(w, 44)); const lb = el('span', 'mp-lbl', C.weather[w].name); lb.setAttribute('aria-hidden', 'true');
      it.append(wrap, lb); row.appendChild(it);
      const o = { w, it, wrap, lift: new Spring(0, SPR.pop, 0.05), sc: new Spring(1, SPR.pop, 0.0005) };
      o.kick = driver([o.lift, o.sc], () => { o.wrap.style.transform = `translateY(${(-o.lift.x).toFixed(2)}px) scale(${o.sc.x.toFixed(4)})`; });
      return o;
    });
    let cur = initial;
    const set = (w, inst) => { cur = w; const si = WEATHERS.indexOf(w); items.forEach((o, i) => { const d = si < 0 ? 9 : Math.abs(i - si); const lift = d === 0 ? 8 : d === 1 ? 2 : 0, sc = d === 0 ? 1.14 : d === 1 ? 1.04 : 1; if (inst || reduced) { o.lift.set(lift); o.sc.set(sc); } else { o.lift.to(lift, SPR.pop); o.sc.to(sc, SPR.pop); } o.kick(); o.it.setAttribute('aria-checked', d === 0 ? 'true' : 'false'); o.it.tabIndex = (si < 0 ? i === 0 : d === 0) ? 0 : -1; }); };
    const choose = (i) => { const w = WEATHERS[i]; if (w === cur) return; set(w); onPick(w); env.vibrate && env.vibrate(8); };
    set(cur, true);
    let pd = null;
    row.addEventListener('pointerdown', (e) => { e.preventDefault(); try { row.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } const r = row.getBoundingClientRect(); pd = { left: r.left, cw: r.width / 6, i: Math.max(0, Math.min(5, Math.floor((e.clientX - r.left) / (r.width / 6)))) }; choose(pd.i); });
    row.addEventListener('pointermove', (e) => { if (!pd) return; const x = e.clientX - pd.left; if (x < pd.i * pd.cw - 6 || x > (pd.i + 1) * pd.cw + 6) { pd.i = Math.max(0, Math.min(5, Math.floor(x / pd.cw))); choose(pd.i); } });
    row.addEventListener('pointerup', () => { pd = null; }); row.addEventListener('pointercancel', () => { pd = null; });
    row.addEventListener('keydown', (e) => { const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!step) return; e.preventDefault(); const i = WEATHERS.indexOf(cur); const ni = i < 0 ? 0 : (i + step + 6) % 6; choose(ni); items[ni].it.focus(); });
    return row;
  }
  function viewBody(body, d, k, rec) {
    body.textContent = '';
    const row = el('div', 'sh-wrow'); row.append(orbCanvas(rec.w, 64), el('p', 'sh-wname', C.weather[rec.w].name));
    body.append(el('h2', 'sh-date', dateText(d)), row);
    if (rec.memo) body.append(el('p', 'sh-memo', rec.memo));
    const edit = btn('sh-btn', C.calendar.edit); edit.addEventListener('click', () => { editBody(body, d, k, rec); sheet.relayout(); });
    const delWrap = el('div', 'sh-del'); const del = btn('sh-text', C.calendar.delete);
    del.addEventListener('click', () => {
      delWrap.textContent = ''; const yes = btn('sh-text danger', C.calendar.delete_confirm), no = btn('sh-text cancel', C.calendar.cancel);
      yes.addEventListener('click', () => doDelete(k)); no.addEventListener('click', () => { delWrap.textContent = ''; delWrap.append(del); del.focus(); });
      delWrap.append(yes, no); yes.focus();
    });
    delWrap.append(del); body.append(edit, delWrap);
  }
  function editBody(body, d, k, rec) {
    body.textContent = '';
    body.append(el('h2', 'sh-date', dateText(d)));
    if (!rec) body.append(el('p', 'sh-note', C.calendar.sheet_empty));
    let sel = rec ? rec.w : null;
    const input = document.createElement('input'); input.type = 'text'; input.maxLength = 50; input.autocomplete = 'off'; input.setAttribute('aria-label', C.misc.memo_label); input.value = rec ? rec.memo : '';
    input.placeholder = sel ? pick(C.weather[sel].placeholders, k + '|' + sel + '|ph') : C.misc.memo_label;
    const cnt = el('span', 'memo-count'); const field = el('div', 'memo-field'); field.append(input, cnt);
    const save = btn('save-btn', C.today.save); save.disabled = !sel;
    const pk = miniPicker((w) => { sel = w; input.placeholder = pick(C.weather[w].placeholders, k + '|' + w + '|ph'); save.disabled = false; }, sel);
    input.addEventListener('input', () => { const n = [...input.value].length; cnt.textContent = n >= 40 ? `${n}/50` : ''; });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save.click(); } });
    save.addEventListener('click', () => {
      if (!sel) return;
      const memo = input.value.trim().slice(0, 50), prevMemo = rec ? rec.memo || '' : '';
      const res = store.setDay(k, { w: sel, memo, t: tempFor(sel, k) });
      if (!res.ok) { env.toast(res.full ? C.misc.storage_full : C.misc.save_failed); return; }
      store.requestPersist(); if (rec) env.toast(C.misc.edit_saved);
      // 위기 표현이 맞으면 시트를 닫지 않고 메모 아래에 안내를 둔다(safety-review §4)
      const card = env.crisisSheet && env.crisisSheet({ memo, prevMemo });
      if (card) { render(false); viewBody(body, d, k, store.getDay(k)); (body.querySelector('.sh-memo') || body.querySelector('.sh-wrow')).after(card); sheet.relayout(); env.onChanged(k); return; }
      sheet.close(() => landCell(k)); env.onChanged(k);
    });
    const row = el('div', 'sh-memo-row'); row.append(field, save);
    body.append(pk, row);
  }
  function doDelete(k) { const r = store.deleteDay(k); if (!r.ok) { env.toast(C.misc.save_failed); return; } env.toast(C.misc.record_deleted); sheet.close(() => render(false)); env.onChanged(k); }
  function landCell(k) {
    render(false); const cell = vp.querySelector(`.cal-cell[data-key="${k}"]`); const cv = cell && cell.querySelector('.cal-orb canvas'); if (!cv || reduced) return;
    cv.style.transform = 'scale(0)'; play(600, (p, e) => { cv.style.transform = p >= 1 ? '' : `scale(${Math.max(0, BOUNCE(e)).toFixed(4)})`; });
  }
  function openDay(k, mode) {
    const d = parseKey(k); if (k > dayKey(now())) return; const rec = store.getDay(k);
    sheet.show((body) => (rec && mode !== 'edit' ? viewBody(body, d, k, rec) : editBody(body, d, k, rec)), { label: dateText(d) });
  }
  return {
    layout(newL) {
      L = newL; CL = calLayout(L); const s = root.style;
      s.setProperty('--cal-cell', CL.cellH + 'px'); s.setProperty('--cal-orb', CL.orb + 'px'); s.setProperty('--cal-numy', CL.numY + 'px');
      title.style.top = CL.titleY + 'px'; prev.style.top = next.style.top = CL.navY + 'px'; wd.style.top = CL.wdY + 'px';
      vp.style.top = CL.gridY + 'px'; vp.style.height = 6 * CL.cellH + 'px'; sum.style.top = CL.sumY + 'px'; empty.style.top = CL.sumY + 'px';
      if (view) render(false);
    },
    show() { if (!view) view = curM(); render(true); },
    refresh(anim) { if (view) render(!!anim); },
    openDay,
    state: () => ({ view: view && `${view.y}-${view.m + 1}`, busy, nextHidden: next.hidden, cells: vp.querySelectorAll('.cal-grid .cal-orb canvas').length }),
  };
}
