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

// §8 PWA: In dev, a stale service worker from a previous production visit
// cache-serves old Vite dep chunks alongside fresh ones, creating duplicate
// React copies and "Invalid hook call" / "Cannot read properties of null
// (reading 'useState')" crashes. We must unregister it and clear its caches
// BEFORE React renders — then reload to fetch clean chunks without SW
// interference. In production, the SW registers normally after load.
async function bootstrap() {
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        await Promise.all(regs.map((r) => r.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        // Reload to get fresh chunks without the stale SW cache.
        window.location.reload();
        return; // Don't render — page is reloading.
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