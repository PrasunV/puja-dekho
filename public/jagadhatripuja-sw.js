// Jagadhatri Puja offline worker. Registered by /jagadhatripuja with scope "/jagadhatripuja", which is more specific
// than the Durga worker's "/", so it controls every Jagadhatri page. It sits at the site root so that scope (with no
// trailing slash) is allowed without extra headers.
//
// Offline, the page, the puja data, search and puja details work. Map tiles and the live counters need a connection.
// On install it reads the page and caches the scripts and styles the page links to, so one visit is enough.
// Bump CACHE when this file's logic changes; hashed app files refresh themselves.
const CACHE = 'jagadhatri-v2';
const PAGE = '/jagadhatripuja';
const DATA = '/jagadhatripuja/data/pujas.json';
const STATIC = [DATA, '/icon.svg', '/jagadhatripuja/icon.svg', '/jagadhatripuja/manifest.webmanifest', '/jagadhatripuja/splash.js'];

/** A redirected response cannot answer a page load, so keep a plain copy. */
const plain = async (res) => (res.redirected ? new Response(await res.blob(), { status: res.status, headers: res.headers }) : res);

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(STATIC);
      const page = await fetch(PAGE, { cache: 'no-cache' });
      if (page.ok) await cache.put(PAGE, await plain(page));
      // The built page names its own hashed scripts and styles; cache those too.
      const html = await (await cache.match(PAGE))?.text();
      const assets = [...new Set([...(html || '').matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];
      await Promise.all(assets.map((a) => cache.add(a).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('jagadhatri-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page sends the app files it loaded before this worker took over (fonts, the map script), so they work offline too.
self.addEventListener('message', (e) => {
  const urls = Array.isArray(e.data?.cache) ? e.data.cache : [];
  const mine = urls.filter(
    (u) =>
      typeof u === 'string' &&
      new URL(u, location.href).origin === location.origin &&
      new URL(u, location.href).pathname.startsWith('/assets/'),
  );
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(mine.slice(0, 60).map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {}))))),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const isPage = req.mode === 'navigate';
  const hashed = url.pathname.startsWith('/assets/');
  // Hashed files never change: cache first. Everything else: network first, cache when offline.
  if (hashed) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          plain(copy).then((p) => caches.open(CACHE).then((c) => c.put(isPage ? PAGE : req, p)));
        }
        return res;
      })
      .catch(() =>
        caches.match(isPage ? PAGE : req, { ignoreSearch: true }).then((m) => m || (isPage ? caches.match(PAGE) : Response.error())),
      ),
  );
});
