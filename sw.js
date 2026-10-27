// Made with Claude (Anthropic) · © Homes in Georgia · Created by Irakli Kvirkvelia
// Bump whenever the single-page CRM shell changes so returning users do not
// remain on an older cached team/rating layout.
const CACHE_NAME = 'rit-crm-v10';

const STATIC_FILES = [
  './',
  './index.html',
  './styles.css',
  './dashboard.css',
  './app.js',
  './telegram-top10.js',
  './telegram-top10.json',
  './lib-repository.js',
  './lib-telegram-notifier.js',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // The public marketplace has its own release lifecycle. Never let the CRM
  // shell service worker cache or rewrite marketplace pages/assets under
  // /site/, otherwise visitors can remain on an older catalogue design.
  if (url.origin === self.location.origin && url.pathname.includes('/site/')) {
    return;
  }

  if (
    request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/telegram-top10.js') ||
    url.pathname.endsWith('/telegram-top10.json')
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(response => {
        if (response && response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});
