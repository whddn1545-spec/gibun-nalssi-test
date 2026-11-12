// 작은 UI 도구: 알림(토스트), 진동, 요소 만들기, 아래에서 올라오는 시트
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function haptic(ms = 8) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch { /* 지원 안 함 */ }
}

let toastTimer = 0;
/** 화면을 옮기면 남아 있는 알림을 바로 거둔다 (다른 화면에서 엉뚱한 안내가 보이지 않게) */
export function hideToast() {
  const el = $('#toast');
  if (!el || el.hidden) return;
  clearTimeout(toastTimer);
  el.classList.remove('is-on');
  setTimeout(() => { if (!el.classList.contains('is-on')) el.hidden = true; }, 260);
}
export function toast(msg, { duration = 2400, tone = '', place = 'top' } = {}) {
  const el = $('#toast');
  if (!el) return;
  el.classList.toggle('on-today', place === 'today');
  el.classList.toggle('on-top', place === 'top');
  el.querySelector('[data-toast-text]').textContent = msg;
  el.dataset.tone = tone;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => { if (!el.classList.contains('is-on')) el.hidden = true; }, 320);
  }, duration);
}

// ---------------------------------------------------------------- 시트
const FOCUSABLE = 'button:not([disabled]), [href], input:not([type="hidden"]), textarea, [tabindex]:not([tabindex="-1"])';
const openStack = [];
let ignorePop = 0;

window.addEventListener('popstate', () => {
  if (ignorePop > 0) { ignorePop--; return; }
  const top = openStack[openStack.length - 1];
  if (top) top.close({ fromHistory: true });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const top = openStack[openStack.length - 1];
  if (top) { e.preventDefault(); top.close(); }
});

export function createSheet(el, { onClose, onOpen } = {}) {
  const panel = el.querySelector('.sheet__panel');
  let lastFocus = null;
  let closing = 0;

  const api = {
    el,
    get isOpen() { return el.classList.contains('is-open'); },
    open() {
      if (api.isOpen) return;
      clearTimeout(closing);
      lastFocus = document.activeElement;
      el.hidden = false;
      el.setAttribute('aria-hidden', 'false');
      panel.style.transform = '';
      void el.offsetHeight; // 시작 위치를 먼저 그린 뒤 올린다
      el.classList.add('is-open');
      openStack.push(api);
      history.pushState({ sheet: el.id }, '');
      document.documentElement.classList.add('has-sheet');
      onOpen && onOpen();
      setTimeout(() => {
        const f = panel.querySelector('[data-autofocus]') || panel;
        f.focus({ preventScroll: true });
      }, 60);
    },
    close({ fromHistory = false } = {}) {
      if (!api.isOpen) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      const i = openStack.indexOf(api);
      if (i >= 0) openStack.splice(i, 1);
      if (!openStack.length) document.documentElement.classList.remove('has-sheet');
      if (!fromHistory && history.state && history.state.sheet === el.id) {
        ignorePop++;
        history.back();
      }
      closing = setTimeout(() => { if (!api.isOpen) el.hidden = true; }, reducedMotion() ? 10 : 420);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      onClose && onClose();
    },
  };

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) api.close();
  });

  // 포커스가 시트 밖으로 나가지 않게
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // 아래로 끌어내려 닫기
  const grip = el.querySelector('[data-drag]') || panel;
  let y0 = 0;
  let dy = 0;
  let t0 = 0;
  let dragging = false;
  grip.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input, textarea, button:not([data-drag])')) return;
    if (panel.scrollTop > 0) return;
    dragging = true;
    y0 = e.clientY;
    dy = 0;
    t0 = performance.now();
    panel.style.transition = 'none';
    grip.setPointerCapture && grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - y0);
    panel.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';
    const v = dy / Math.max(1, performance.now() - t0);
    if (dy > 110 || (dy > 30 && v > 0.6)) {
      panel.style.transform = '';
      api.close();
    } else {
      panel.style.transform = '';
    }
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);

  return api;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
