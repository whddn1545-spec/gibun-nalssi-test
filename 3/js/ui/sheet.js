// 바닥 시트: 열기(y 100%→0 spring-soft, 가림막), 끌어서 닫기(1:1, 위로 ×.25, 96 또는 900px/s), 뒤로 가기로 닫기(History API)
import { play } from '../loop.js';
import { ease, Spring, SPR, driver } from './spring.js';

export function createSheet(env) {
  const { app, reduced } = env;
  const layer = document.createElement('div'); layer.className = 'sheet-layer'; layer.hidden = true;
  const scrim = document.createElement('div'); scrim.className = 'sheet-scrim';
  const panel = document.createElement('div'); panel.className = 'sheet'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.tabIndex = -1;
  const handle = document.createElement('div'); handle.className = 'sheet-handle'; handle.setAttribute('aria-hidden', 'true');
  const body = document.createElement('div'); body.className = 'sheet-body';
  panel.append(handle, body); layer.append(scrim, panel); app.appendChild(layer);
  const ys = new Spring(1, SPR.soft, 0.0008);
  let H = 400, isOpen = false, closing = false, afterClose = null, prevFocus = null, drag = null;
  const paint = () => { panel.style.transform = `translateY(${(ys.x * H).toFixed(2)}px)`; scrim.style.opacity = Math.max(0, Math.min(1, 1 - ys.x)).toFixed(3); };
  const kick = driver([ys], paint);
  const measure = () => { H = panel.offsetHeight + 12; };
  function show(build, o = {}) {
    body.textContent = ''; build(body);
    if (o.label) panel.setAttribute('aria-label', o.label);
    panel.classList.toggle('tall', !!o.tall); // 도움받을 곳·설치 안내·라이선스는 .9H까지
    if (isOpen) { measure(); paint(); return; }
    layer.hidden = false; isOpen = true; closing = false; afterClose = null; prevFocus = document.activeElement;
    measure(); ys.set(1); paint();
    if (reduced) { ys.set(0); panel.style.opacity = '0'; paint(); play(180, (p) => { panel.style.opacity = p >= 1 ? '' : p.toFixed(3); }); }
    else { ys.to(0, SPR.soft); kick(); }
    history.pushState({ sheet: 1 }, '');
    panel.focus({ preventScroll: true });
  }
  function animateClose() {
    if (!isOpen || closing) return; closing = true; const y0 = ys.x;
    play(reduced ? 180 : 230, (p) => {
      if (reduced) panel.style.opacity = (1 - p).toFixed(3); else ys.set(y0 + (1 - y0) * ease.in(p));
      paint();
      if (p >= 1) {
        layer.hidden = true; isOpen = false; closing = false; panel.style.opacity = ''; body.textContent = '';
        const f = afterClose; afterClose = null; if (f) f();
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      }
    });
  }
  // 코드로 닫을 때: 바로 닫는 움직임을 시작하고, 뒤따라 올 popstate 한 번은 무시한다.
  // (history.back()은 비동기라 그 사이 새 시트를 열면 늦게 온 '뒤로'가 새 시트를 닫던 문제 방지)
  let expect = 0;
  function close(cb) {
    if (!isOpen) { if (cb) cb(); return; }
    if (cb) afterClose = cb;
    if (history.state && history.state.sheet) { expect++; history.back(); }
    animateClose();
  }
  panel.addEventListener('pointerdown', (e) => {
    if (!isOpen || closing || e.target.closest('button, input, .mini-picker, a, .no-drag')) return;
    drag = { id: e.pointerId, y0: e.clientY, dy: 0, hist: [[e.timeStamp, e.clientY]] };
    try { panel.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  });
  panel.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0; drag.dy = dy; drag.hist.push([e.timeStamp, e.clientY]); if (drag.hist.length > 6) drag.hist.shift();
    ys.set((dy >= 0 ? dy : dy * 0.25) / H); paint();
  });
  const end = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return; const d = drag; drag = null;
    const a = d.hist[0], b = d.hist[d.hist.length - 1]; const v = b[0] > a[0] ? ((b[1] - a[1]) / (b[0] - a[0])) * 1000 : 0;
    if (d.dy >= 96 || (v >= 900 && d.dy > 12)) close(); else { ys.to(0, SPR.soft); kick(); }
  };
  panel.addEventListener('pointerup', end); panel.addEventListener('pointercancel', end);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
  scrim.addEventListener('click', () => close());
  return { show, close, onPop() { if (expect > 0) { expect--; return; } if (isOpen) animateClose(); }, expecting: () => expect > 0, isOpen: () => isOpen, top: () => (isOpen && !closing ? panel.getBoundingClientRect().top : null), relayout() { measure(); paint(); } };
}
