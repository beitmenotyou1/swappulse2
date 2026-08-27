// SwapPulse Service Worker — PWA caching + web push notifications
const CACHE_NAME = 'swappulse-v3';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Dev-asset bypass: never cache Vite dev-server assets. Serving stale chunks
// from cache while the HTML loads fresh ones creates duplicate React copies
// and "Invalid hook call" crashes. Pass these straight to the network.
function isDevAsset(url) {
  return (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.includes('.vite/deps/') ||
    /\.(m?js|jsx|ts|tsx|css|map)$/.test(url.pathname) ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Dev assets: always network-only, never cache.
  if (isDevAsset(url)) {
    event.respondWith(fetch(request).catch(() => Response.error()));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});

// Web push — display notification with deep-link action buttons
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SwapPulse', body: event.data ? event.data.text() : 'New notification' };
  }
  const title = data.title || 'SwapPulse';
  const body = data.body || 'New notification';
  const payload = data.data || {};
  const route = payload.route || '/';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      tag: payload.notificationType || 'default',
      data: { route, ...payload },
      requireInteraction: data.requireInteraction || false,
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// Notification click — focus/open the app and navigate to the deep link
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const route = event.notification.data?.route || '/';
  const url = new URL(route, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
