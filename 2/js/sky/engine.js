// 하늘 엔진 진입점. 캔버스 하나에 하늘 세계를 그리고 앱이 부르는 API를 제공한다.

import { World } from './scene.js';

const MAX_DPR = 2;

export function createSky(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const world = new World({ pr: dpr, reducedMotion });
  let raf = 0;
  let last = 0;
  let paused = false;
  let slow = 0;
  const stats = { frames: 0, interval: 16.7, js: 0, jsMax: 0, quality: 1 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = canvas.clientWidth || 390;
    const h = canvas.clientHeight || 844;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    world.resize(w, h, dpr);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const gap = last ? now - last : 16.7;
    last = now;
    const dt = Math.min(0.05, gap / 1000);
    const t0 = performance.now();
    world.update(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    world.draw(ctx);
    const js = performance.now() - t0;

    stats.frames += 1;
    if (gap < 120) stats.interval += (gap - stats.interval) * 0.05;
    stats.js += (js - stats.js) * 0.05;
    stats.jsMax = Math.max(stats.jsMax * 0.995, js);
    // 느리면 입자 수를 줄인다
    if (stats.frames > 30 && gap < 120) {
      slow = stats.interval > 21 || stats.js > 12 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 40 && world.q > 0.4) {
        world.q = Math.max(0.4, world.q - 0.2);
        stats.quality = world.q;
        slow = 0;
      }
    }
  }

  function start() {
    if (raf || paused) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  new ResizeObserver(resize).observe(canvas);
  resize();
  start();

  const sky = {
    setWeather(id, { instant = false } = {}) { world.setWeather(id ?? null, instant); },
    setCamera(mode) { world.setCamera(mode); },
    setGarden(garden) { world.setGarden(garden); },
    poke(x, y) { world.poke(x, y); },
    setHour(h) { world.setHour(h); },
    setGardenLimit(y) { world.setGardenLimit(y); },
    on(evt, fn) { return world.on(evt, fn); },
    pause() { paused = true; stop(); },
    resume() { paused = false; start(); },
    paintStill,
    // 점검용: 프레임 시간과 품질 단계
    stats: () => ({ ...stats, dpr, w: world.w, h: world.h, inkLum: world.inkLum, ink: world.inkNow }),
  };
  canvas.__sky = sky;
  return sky;
}

// 한 장면을 지정 크기의 2D 컨텍스트에 그린다. 폭 390 기준으로 그린 뒤 확대해 쓴다.
// keepClear {x, y, w, h}(캔버스 픽셀)는 해·달·밝은 구름·번개·비·눈이 들어오지 않는 사각형이다.
export function paintStill(ctx2d, w, h, weatherId, { hour = 12, hill = true, garden = null, keepClear = null } = {}) {
  const k = w / 390;
  const world = new World({ pr: k, reducedMotion: true, uiReserve: 0 });
  world.resize(390, h / k, k);
  world.setHour(hour);
  if (keepClear) world.clear = { x: keepClear.x / k, y: keepClear.y / k, w: keepClear.w / k, h: keepClear.h / k };
  world.setGarden(garden ?? { flowers: [], total: 0 });
  world.settle(weatherId ?? null);
  ctx2d.save();
  ctx2d.beginPath();
  ctx2d.rect(0, 0, w, h);
  ctx2d.clip();
  ctx2d.scale(k, k);
  world.draw(ctx2d, { hill });
  ctx2d.restore();
}
