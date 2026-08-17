import React, { useEffect, useRef } from 'react';

// Loads the Cloudflare Turnstile script once app-wide.
let turnstileLoaded = false;
function loadTurnstile() {
  if (turnstileLoaded || document.getElementById('cf-turnstile-script')) {
    turnstileLoaded = true;
    return;
  }
  const s = document.createElement('script');
  s.id = 'cf-turnstile-script';
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
  turnstileLoaded = true;
}

// Inline Cloudflare Turnstile widget. Calls onVerify(token) once the user
// solves the challenge; resets when `resetKey` changes. The site key is read
// from the global app settings (window.__TURNSTILE_SITE_KEY) or the
// TURNSTILE_SITE_KEY env-injected meta tag.
export default function TurnstileWidget({ onVerify, resetKey, className = '' }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const cbRef = useRef(onVerify);
  useEffect(() => { cbRef.current = onVerify; }, [onVerify]);

  useEffect(() => {
    loadTurnstile();
    let cancelled = false;
    const tryRender = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        try { window.turnstile.reset(widgetIdRef.current); } catch {}
        return;
      }
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: window.__TURNSTILE_SITE_KEY || '',
          theme: 'light',
          callback: (token) => cbRef.current?.(token),
          'error-callback': () => cbRef.current?.(null),
        });
      } catch {}
    };
    const interval = setInterval(() => {
      if (window.turnstile) { tryRender(); clearInterval(interval); }
    }, 150);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [resetKey]);

  return <div ref={containerRef} className={className} aria-label="Human verification widget" />;
}