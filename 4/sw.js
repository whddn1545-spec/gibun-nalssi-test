// 기분날씨 서비스 워커: 앱 파일을 미리 저장해 인터넷 없이도 열리게 한다.
// 아래 두 줄은 tools/update_sw.py가 자동으로 고친다.
/* @generated-start */
const VERSION = '38a9224801';
const FILES = ["./", "./css/app.css", "./fonts/Pretendard-Bold.subset.woff2", "./fonts/Pretendard-ExtraBold.subset.woff2", "./fonts/Pretendard-Medium.subset.woff2", "./icons/apple-touch-icon.png", "./icons/favicon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./index.html", "./js/art.js", "./js/card.js", "./js/dates.js", "./js/forecast-text.js", "./js/icons.js", "./js/install.js", "./js/main.js", "./js/scene.js", "./js/store.js", "./js/ui.js", "./js/weather.js", "./manifest.webmanifest"];
/* @generated-end */

const CACHE = `kibun-weather-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kibun-weather-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 화면 요청: 저장해 둔 앱 화면을 먼저 보여 주고, 뒤에서 새 버전을 받아 둔다.
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = (await cache.match('./index.html')) || (await cache.match('./'));
        const fresh = fetch(req).then((res) => {
          if (res.ok) cache.put('./index.html', res.clone());
          return res;
        }).catch(() => null);
        if (cached) {
          event.waitUntil(fresh);
          return cached;
        }
        return (await fresh) || new Response('오프라인이에요', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) {
        event.waitUntil(fresh);
        return cached;
      }
      return (await fresh) || new Response('', { status: 504 });
    }),
  );
});
