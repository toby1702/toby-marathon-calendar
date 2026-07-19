/* Marathon Training — service worker.
   Strategy chosen to avoid the classic "PWA won't update" trap:
   - HTML/navigations: NETWORK-FIRST, so a fresh deploy always shows when online;
     falls back to the cached shell only when offline.
   - Same-origin static assets (icons, manifest): cache-first for instant loads.
   - Cross-origin requests (Strava API, getpantry share state) are never touched —
     they always hit the network so your live data is never stale. */
const CACHE = 'marathon-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest',
                './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // let Strava / pantry go straight to network

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
                .catch(() => cached)
    )
  );
});
