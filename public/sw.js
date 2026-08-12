// SwapPulse Service Worker — push notifications with deep linking.
// Push arrives → if a client is visible, postMessage for in-app banner;
// otherwise show a system notification. Notification tap → postMessage
// NAVIGATE to an open client, or open a new window to the deep link URL.

const CACHE_NAME = 'swappulse-v2';
const APP_SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'SwapPulse', body: 'You have a new notification.' };
  }

  const {
    title = 'SwapPulse',
    body = '',
    data = {},
    tag,
    requireInteraction,
  } = payload;

  event.waitUntil(
    (async () => {
      // Check if any client is visible (app in foreground)
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const visibleClient = clientList.find((c) => c.visibilityState === 'visible');

      if (visibleClient) {
        // App in foreground — in-app banner instead of system notification
        visibleClient.postMessage({
          type: 'PUSH_RECEIVED',
          payload: { title, body, data, tag },
        });
        return;
      }

      // App in background — show system notification with deep link data
      return self.registration.showNotification(title, {
        body,
        data,
        tag: tag || data.notificationType || 'default',
        requireInteraction: !!requireInteraction,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [200, 100, 200],
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const route = data.route || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // If a window is already open, navigate it
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NAVIGATE',
            route,
            notificationId: data.notificationId,
            notificationType: data.notificationType,
          });
          return client.focus();
        }
      }

      // Otherwise, open a new window to the deep link
      if (self.clients.openWindow) {
        const url = route.startsWith('/') ? route : '/' + route;
        return self.clients.openWindow(url);
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
