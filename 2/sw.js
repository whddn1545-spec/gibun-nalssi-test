// 서비스 워커: 설치할 때 앱 전체를 저장하고, 이후 저장된 것을 먼저 쓴다(캐시 우선).
// 목록과 버전은 scripts/build_precache.py가 만든 precache.js에서 읽는다.

try {
  importScripts('precache.js');
} catch (error) {
  // 목록이 없으면 저장 없이 네트워크로만 동작한다.
  self.PRECACHE = [];
  self.PRECACHE_VERSION = 'none';
}

const PREFIX = 'gibun-';
const CACHE = `${PREFIX}${self.PRECACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: 'reload'로 브라우저 HTTP 캐시를 거치지 않고 새로 받는다.
    await cache.addAll(self.PRECACHE.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(request);
    } catch (error) {
      // 주소창 이동이 저장되지 않은 경로로 가도 앱 본체는 열어 준다.
      if (request.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
