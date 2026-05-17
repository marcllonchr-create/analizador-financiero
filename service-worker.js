// Service Worker para Valora PWA
// Permite funcionar offline cacheando el shell de la app

const CACHE_VERSION = 'valora-v8';
const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  // CDN dependencies (will be cached on first load)
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Install: pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Cache what we can; fail silently for CDN URLs that may have CORS issues
      return Promise.all(
        CACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('Cache miss:', url))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - For navigation requests (HTML): network-first with cache fallback (so updates work)
// - For static assets (JS, CSS, fonts): cache-first
// - For API calls (Yahoo, FMP, GitHub): always network (never cache financial data)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache API calls or dynamic data
  if (url.hostname.includes('yahoo') ||
      url.hostname.includes('financialmodelingprep') ||
      url.hostname.includes('api.github.com') ||
      url.hostname.includes('corsproxy.io') ||
      url.pathname.includes('/api/')) {
    return; // Let browser handle it normally
  }

  // For navigation requests: network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // For other requests: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
