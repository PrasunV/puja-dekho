// Offline shell. App files (hashed by the build), puja and metro data are cached as they are used,
// so the app opens without signal after the first visit. Map tiles and live data (queues, closures) need a connection.
// v4: Jagadhatri Puja pages (/jagadhatri...) have their own worker (jagadhatripuja-sw.js) and are left alone here,
// so an offline Jagadhatri visitor never sees the Durga page.
const CACHE = 'pujadekho-v4';
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['/', '/data/pujas.json', '/data/metro.json', '/icon.svg', '/manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || /^\/jagadhatri/i.test(url.pathname)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('/'))),
  );
});
