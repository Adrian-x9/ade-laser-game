// CACHE_NAME zmieniony z 'zip-v1' na 'patches-v1'
// Wymusi to na telefonach przeładowanie ikon i manifestu.
const CACHE_NAME = 'patches-game-cache-v1.3.1';

var urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Zakładamy, że Vite generuje te pliki na podstawie Twojej konfiguracji:
  './assets/index.js',
  './assets/index.css'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache: ' + CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', function(event) {
  var cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache: ' + cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});