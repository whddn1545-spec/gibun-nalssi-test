// 오늘 화면의 '내 작은 하늘' — index.html의 SVG 장면(#scene)을 날씨에 맞게 바꾼다.
// 색·위치는 CSS 전환으로 부드럽게 넘어가고, 몽글이는 표정을 바꾸며 찌그러졌다 펴진다.
import { reducedMotion } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const f = (n, d = 2) => n.toFixed(d);

function buildParticles(scene) {
  const rain = scene.querySelector('#scene-rain');
  const rr = rng(7);
  for (let i = 0; i < 34; i++) {
    const x = 108 + (i / 34) * 144 + rr() * 8;
    const y = 144 + rr() * 16;
    const dur = 0.85 + rr() * 0.45;
    const g = mk('g', { transform: `translate(${f(x, 1)} ${f(y, 1)}) scale(${f(0.7 + rr() * 0.3)})` }, rain);
    mk('use', { href: '#drop', class: 'rd', style: `--dur:${f(dur)}s;--d:${f(-rr() * dur)}s;--dist:${Math.round(130 + rr() * 30)}px;--ry:${Math.round(rr() * 150)}px` }, g);
  }
  const snow = scene.querySelector('#scene-snow');
  const sr = rng(11);
  for (let i = 0; i < 32; i++) {
    const x = -90 + (i / 32) * 530 + sr() * 14;
    const dur = 7 + sr() * 6;
    const sd = 2.4 + sr() * 2;
    const g = mk('g', { transform: `translate(${f(x, 1)} -16)` }, snow);
    const fall = mk('g', { class: 'sf', style: `--dur:${f(dur)}s;--d:${f(-sr() * dur)}s;--ry:${Math.round(sr() * 300)}px` }, g);
    const sway = mk('g', { class: 'ss', style: `--sdur:${f(sd)}s;--sd:${f(-sr() * sd)}s` }, fall);
    if (i % 4 === 1) mk('path', { class: 'flake', d: 'M0-5V5M-4.3-2.5L4.3 2.5M-4.3 2.5L4.3-2.5', transform: `scale(${f(0.8 + sr() * 0.5)})` }, sway);
    else mk('circle', { class: 'fl', r: f(1.8 + sr() * 2.4, 1) }, sway);
  }
}

export function createScene(root, { label } = {}) {
  const scene = root.querySelector('#scene');
  const skyIn = root.querySelector('#sky-in');
  const squish = root.querySelector('#friend-squish');
  buildParticles(scene);
  const shows = [...scene.querySelectorAll('[data-show]')];
  let current = null;
  let idleT = 0;
  let stateT = 0;

  function react() {
    if (reducedMotion()) return;
    squish.classList.remove('react');
    squish.getBoundingClientRect();
    squish.classList.add('react');
  }
  squish.addEventListener('animationend', (e) => {
    if (e.animationName === 'squish') squish.classList.remove('react');
  });
  skyIn.addEventListener('click', react);

  function set(w, { instant = false } = {}) {
    const key = w || 'initial';
    const changed = key !== (current || 'initial') || current === null;
    current = w || null;
    root.dataset.weather = w || '';
    if (instant) document.documentElement.classList.add('no-tr');
    scene.dataset.w = key;
    document.body.dataset.w = key;
    shows.forEach((n) => {
      const on = n.dataset.show.split(' ').includes(key);
      n.classList.toggle('on', on);
      if (on) n.classList.remove('idle');
    });
    // 안 보이는 무리의 애니메이션은 잠시 뒤 멈춰 둔다 (배터리 아끼기)
    clearTimeout(idleT);
    idleT = setTimeout(() => shows.forEach((n) => { if (!n.classList.contains('on')) n.classList.add('idle'); }), 900);
    skyIn.setAttribute('aria-label', label ? label(w) : '내 작은 하늘');
    clearTimeout(stateT);
    if (instant || !changed) {
      root.dataset.state = 'idle';
      if (instant) requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('no-tr')));
    } else {
      root.dataset.state = 'transition';
      stateT = setTimeout(() => { root.dataset.state = 'idle'; }, reducedMotion() ? 450 : 1400);
      react();
    }
  }

  return {
    set,
    react,
    get weather() { return current; },
    setActive(on) { root.classList.toggle('is-paused', !on); },
  };
}
