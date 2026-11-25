// 평가가 끝난 옛 시안: 이 서비스 워커는 옛 오프라인 사본을 지우고 스스로 해제한 뒤 새 버전으로 보낸다.
// (시안 4는 본 앱과 캐시 이름이 같아 캐시는 건드리지 않는다 — 본 앱이 알아서 정리한다)
const PREFIX = 'gibun-nalssi-';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (PREFIX) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PREFIX)).map((k) => caches.delete(k)));
    }
    const home = new URL('../', self.registration.scope).href;
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await self.registration.unregister();
    await Promise.all(wins.map((c) => c.navigate(home).catch(() => null)));
  })());
});
