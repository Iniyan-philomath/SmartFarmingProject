// Sahakar Vaani — Multilingual Cooperative Governance & Legal PWA (v3)
const CACHE_NAME = 'sahakar-vaani-v3';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/public/icon.svg',
  '/legal_database.json',
  '/tn_central_schemes.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Non-GET requests and dynamic chat AI calls always go to network
  if (req.method !== 'GET' || url.pathname === '/chat' || url.pathname === '/stt' || url.pathname === '/tts') {
    return;
  }

  // Cache-First with Background Revalidation for App Shell & Static Assets
  // This guarantees sub-100ms instant load times even on slow 2G/3G networks
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is HTML navigation, fallback to cached index.html
          if (req.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
