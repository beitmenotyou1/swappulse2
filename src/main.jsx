import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { replayOutbox } from '@/lib/offlineSync'
import { initRealtime } from '@/lib/realtime'
import { handleSubdomainRedirect } from '@/lib/subdomainRedirect'

handleSubdomainRedirect();

try {
  const stored = localStorage.getItem('swappulse-theme');
  const useDark = stored !== null
    ? stored !== 'light'
    : window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  if (useDark) {
    document.documentElement.classList.add('dark');
  }
} catch (e) { /* ignore */ }

// §8 PWA: In dev, a service worker from a previous production visit can
// cache-serve stale chunks, so unregister it and drop its caches. Rendering
// happens either way — a reload here would risk a blank page loop.
async function bootstrap() {
  if (import.meta.env.DEV) {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch { /* ignore */ }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
  )

  if ('serviceWorker' in navigator && !import.meta.env.DEV) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
      navigator.serviceWorker.addEventListener('message', (e) => {
        const msg = e.data || {};
        if (msg.type === 'replay-outbox') replayOutbox();
        if (msg.type === 'navigate' && msg.url) {
          window.history.pushState({}, '', msg.url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      });
    });
  }
  window.addEventListener('online', () => { replayOutbox(); });

  // §9 Real-time: connect on load, manage lifecycle.
  initRealtime();
}

bootstrap();