// Sariling Mundo Service Worker for Offline Caching, PWA Installation & Mobile Notifications
const CACHE_NAME = 'sariling-mundo-v6';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle mobile & desktop PWA notification taps: focus existing window or navigate to target route
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then((focused) => {
            if (focused && 'navigate' in focused && targetUrl && !focused.url.endsWith(targetUrl)) {
              return focused.navigate(targetUrl).catch(() => focused);
            }
            return focused;
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || 'Sariling Mundo Reminder';
    const options = {
      body: payload.body || 'Tap to open your workspace.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'sariling-mundo-alert',
      data: { url: payload.url || '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // ignore malformed push payload
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Never cache dynamic API, Firebase Auth, or dev HMR requests
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/') ||
    url.pathname.includes('webpack-hmr')
  ) {
    return;
  }

  // For page navigation, always fetch fresh from network first so users get latest updates
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/');
          });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});
