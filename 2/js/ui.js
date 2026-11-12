// 공용 UI: DOM 도우미, 토스트, 바텀 시트, 진동, 키보드 추적

// el('div', { class: 'a', onclick: fn, dataset: { x: 1 } }, child, '글자')
// 글자는 textContent로 들어가므로 사용자가 쓴 메모도 안전하다.
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key in node && key !== 'list') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child);
  }
  return node;
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const PATTERNS = { tap: 8, select: 14, success: [10, 40, 16], warn: [24, 50, 24] };

export function haptic(kind = 'tap') {
  if (navigator.vibrate) navigator.vibrate(PATTERNS[kind] ?? 8);
}

let toastTimer;

export function toast(message, { duration = 2200 } = {}) {
  const root = document.getElementById('toast-root');
  root.replaceChildren();
  const node = el('div', { class: 'toast' }, message);
  root.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.classList.add('is-out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }, duration);
}

let activeSheet = null;

// content: HTMLElement. 돌려주는 { close, body }로 닫거나 내용을 바꾼다.
// 뒤로 가기, Esc, 바깥 누르기, 손잡이를 아래로 끌기로 닫힌다.
export function openSheet({ content, label = '', onClose } = {}) {
  // 시트를 바꿔 띄울 때는 뒤로 가기 기록을 새로 쌓지 않고 이어 쓴다.
  const replacing = Boolean(activeSheet);
  activeSheet?.close({ silent: true, keepHistory: true });

  const root = document.getElementById('sheet-root');
  const body = el('div', { class: 'sheet-body' }, content);
  const grip = el('div', { class: 'sheet-grip', 'aria-hidden': 'true' });
  const panel = el('div', { class: 'sheet-panel', tabIndex: -1 }, grip, body);
  const scrim = el('div', { class: 'sheet-scrim' });
  const wrap = el('div', { class: 'sheet-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, scrim, panel);
  root.append(wrap);

  const previousFocus = document.activeElement;
  // 시트가 떠 있는 동안 뒤 화면은 키보드로도 닿지 않게 한다.
  const background = document.querySelectorAll('#screens, #tabbar');
  background.forEach((node) => { node.inert = true; });
  let closed = false;

  const onPop = () => close({ fromHistory: true });
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  function close({ fromHistory = false, silent = false, keepHistory = false } = {}) {
    if (closed) return;
    closed = true;
    activeSheet = null;
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('keydown', onKey);
    background.forEach((node) => { node.inert = false; });
    // 닫히는 동안 막이 다음 탭을 가로채지 않게 한다.
    wrap.style.pointerEvents = 'none';
    if (!fromHistory && !keepHistory) history.back();
    wrap.classList.remove('is-open');
    panel.style.removeProperty('--drag');
    const remove = () => wrap.remove();
    panel.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 700);
    previousFocus?.focus?.({ preventScroll: true });
    if (!silent) onClose?.();
  }

  if (!replacing) history.pushState({ sheet: true }, '');
  window.addEventListener('popstate', onPop);
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', () => close());

  // 끌어서 닫기
  let startY = 0;
  let dragging = false;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;

  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    grip.setPointerCapture(e.pointerId);
    panel.classList.add('is-dragging');
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - startY);
    velocity = (e.clientY - lastY) / Math.max(1, e.timeStamp - lastT);
    lastY = e.clientY;
    lastT = e.timeStamp;
    panel.style.setProperty('--drag', `${dy}px`);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-dragging');
    const dy = Math.max(0, e.clientY - startY);
    if (dy > panel.offsetHeight * 0.3 || velocity > 0.7) close();
    else panel.style.setProperty('--drag', '0px');
  };
  grip.addEventListener('pointerup', endDrag);
  grip.addEventListener('pointercancel', endDrag);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      wrap.classList.add('is-open');
      panel.focus({ preventScroll: true });
    });
  });

  activeSheet = { close, body };
  return activeSheet;
}

// 화면 키보드 높이를 --kb에 넣는다. 입력칸이 키보드에 가리지 않게 하는 데 쓴다.
export function trackKeyboard() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const update = () => {
    const height = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
    document.documentElement.style.setProperty('--kb', `${height}px`);
    document.body.classList.toggle('kb-open', height > 80);
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  update();
}
