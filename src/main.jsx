import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { replayOutbox } from '@/lib/offlineSync'
import { initRealtime } from '@/lib/realtime'
import { handleSubdomainRedirect } from '@/lib/subdomainRedirect'

handleSubdomainRedirect();

try {
  if (localStorage.getItem('swappulse-theme') !== 'light') {
    document.documentElement.classList.add('dark');
  }
} catch (e) { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// §8 PWA: register the service worker and replay offline writes when back online.
if ('serviceWorker' in navigator) {
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