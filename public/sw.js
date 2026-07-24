// SwapPulse service worker — §8 PWA
// Layer 1: app-shell cache (network-first navigations, offline fallback)
// Layer 3: runtime stale-while-revalidate for static + card-image assets
// Background sync relay, push notifications, share-target handling.
const SHELL = 'swappulse-shell-v1';
const RUNTIME = 'swappulse-runtime-v1';
const SHELL_URLS = ['/', '/index.html'];
const IMAGE_HOSTS = ['assets.tcgdex.net', 'media.base44.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(SHELL_URLS.map((u) => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => ![SHELL, RUNTIME].includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // App-shell navigations: network-first, fall back to cached shell.
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL);
        cache.put('/', fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = (await caches.match(request)) || (await caches.match('/')) || (await caches.match('/index.html'));
        return cached || Response.error();
      }
    })());
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(request);
      const network = fetch(request).then((res) => {
        if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })());
    return;
  }

  // Cross-origin card images / fonts / media: cache-first with background revalidate.
  if (IMAGE_HOSTS.includes(url.host)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(request);
      if (cached) {
        fetch(request).then((res) => { if (res && res.ok) cache.put(request, res.clone()).catch(() => {}); }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
        return res;
      } catch {
        return Response.error();
      }
    })());
  }
});

// Background sync: ask open clients to replay the offline outbox.
self.addEventListener('sync', (e) => {
  if (e.tag === 'collection-sync') {
    e.waitUntil((async () => {
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: 'replay-outbox' }));
    })());
  }
});

// Share target: a POST to /share carries a shared image. Store it and redirect.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'POST') return;
  const url = new URL(request.url);
  if (url.pathname !== '/share') return;
  e.respondWith((async () => {
    try {
      const form = await request.formData();
      const file = form.get('card_image') || form.get('file');
      const title = (form.get('title') && String(form.get('title'))) || '';
      const text = (form.get('text') && String(form.get('text'))) || '';
      if (file && typeof file === 'object') {
        const buf = await file.arrayBuffer();
        const idb = await idbOpen();
        await idbPutRaw(idb, 'shares', { key: 'last-share', value: { name: file.name, type: file.type, buf, title, text }, ts: Date.now() });
      }
    } catch {}
    return Response.redirect('/share?from=target', 303);
  })());
});

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('swappulse', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('shares')) db.createObjectStore('shares', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPutRaw(db, store, value) {
  return new Promise((resolve) => {
    const r = db.transaction(store, 'readwrite').objectStore(store).put(value);
    r.onsuccess = () => resolve(); r.onerror = () => resolve();
  });
}

// Push notifications.
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(data.title || 'SwapPulse', {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const target = (e.notification.data && e.notification.data.url) || '/';
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) {
        c.postMessage({ type: 'navigate', url: target });
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
