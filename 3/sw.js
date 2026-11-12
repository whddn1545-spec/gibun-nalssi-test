// 서비스 워커: 앱 파일을 모두 미리 저장해 오프라인에서도 뜬다. 판(VERSION)은 여기 한 곳에서만 바꾼다.
// - 새 판: sw.js가 바뀌면 브라우저가 새 판을 받아 두었다가(대기), 앱을 모두 닫고 다시 열 때 바뀐다. 그때 옛 캐시를 지운다.
// - 개발(localhost·127.0.0.1): 네트워크 먼저(고친 파일이 바로 보이고 캐시도 새것으로), 끊기면 캐시. 그 밖은 캐시 먼저.
// - 파일을 더하면 FILES에 넣는다(tools/qa/qa_4d.py가 app 폴더와 맞는지 검사한다).
const VERSION = 'kn-2026-11-11-fix3';
const CACHE = 'kibun-nalssi-' + VERSION;
const FILES = ['./', "css/app.css", "data/copy.json", "fonts/GowunBatang-Bold-sub.woff2", "fonts/OFL-GowunBatang.txt", "fonts/OFL-Pretendard.txt", "fonts/Pretendard-Regular-sub.woff2", "fonts/Pretendard-SemiBold-sub.woff2", "icons/apple-touch-180.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "js/card.js", "js/copy.js", "js/dates.js", "js/icon.js", "js/layout.js", "js/loop.js", "js/main.js", "js/palette.js", "js/qa.js", "js/safety.js", "js/sample.js", "js/sky/art.js", "js/sky/engine.js", "js/sky/orb.js", "js/sky/paper.js", "js/sky/particles.js", "js/store.js", "js/ui/arrival.js", "js/ui/calendar.js", "js/ui/crisis.js", "js/ui/forecast.js", "js/ui/settings.js", "js/ui/sheet.js", "js/ui/spring.js", "js/ui/today.js", "js/week.js", "manifest.webmanifest"];
const DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
// cache:'reload': 브라우저 HTTP 캐시를 거치지 않고 서버에서 새로 받는다(새 index.html과 옛 js가 섞여 캐시되지 않게)
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' }))))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('kibun-nalssi-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  const nav = req.mode === 'navigate', key = nav ? 'index.html' : req;
  const cached = () => caches.open(CACHE).then((c) => c.match(key, { ignoreSearch: true }));
  if (DEV) {
    e.respondWith(fetch(req).then((res) => { if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); } return res; })
      .catch(() => cached().then((r) => r || Response.error())));
    return;
  }
  e.respondWith(cached().then((r) => r || fetch(req)));
});
