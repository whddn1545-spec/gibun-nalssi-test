// 한 번 열면 인터넷 없이도 켜지도록 앱 파일을 통째로 보관한다.
// 파일을 고치면 VERSION을 올린다. 새 버전은 뒤에서 내려받아 다음 실행부터 적용된다.
const VERSION = 'v2';
const CACHE = `gibun-nalssi-${VERSION}`;

const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/card.js',
  'js/forecast.js',
  'js/icons.js',
  'js/sky.js',
  'js/store.js',
  'js/util.js',
  'js/weather.js',
  'fonts/Pretendard.woff2',
  'fonts/GowunBatang-Regular.woff2',
  'fonts/GowunBatang-Bold.woff2',
  'icons/favicon.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('gibun-nalssi-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (request.mode === 'navigate') {
        // ?demo 같은 주소도 같은 앱 화면을 연다
        return (await cache.match('index.html')) || fetch(request);
      }
      return (await cache.match(request, { ignoreSearch: true })) || fetch(request);
    })(),
  );
});
