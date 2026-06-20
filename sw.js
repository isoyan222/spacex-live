/* SpaceX Live — Service Worker */
const CACHE = 'spacex-live-v1';
const SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/demo.js',
  '/js/api.js',
  '/js/globe.js',
  '/js/ui.js',
  '/js/panel.js',
  '/js/main.js',
  '/textures/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ネット優先、失敗時はキャッシュ */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('api.spacexdata') || e.request.url.includes('finance.yahoo')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
