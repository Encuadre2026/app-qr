const CACHE_NAME = 'qr-asistencia-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// Instalar Service Worker y guardar en caché los archivos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Interceptar las peticiones para servir desde caché si no hay red
self.addEventListener('fetch', event => {
  // Ignorar peticiones a Google Apps Script (API)
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Devuelve de la caché si existe, sino intenta descargar
      return response || fetch(event.request).catch(() => {
        // Fallback offline genérico si es necesario
      });
    })
  );
});

// Limpiar cachés antiguas al actualizar
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
