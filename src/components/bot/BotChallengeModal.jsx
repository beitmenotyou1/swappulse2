import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, X } from 'lucide-react';

// Loads the Cloudflare Turnstile script once.
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

export default function BotChallengeModal({ open, siteKey, challengeToken, onResolved, onCancel }) {
  const [error, setError] = useState('');
  const widgetIdRef = useRef(null);
  const containerRef = useRef(null);
  const resolvedRef = useRef(false);

  // Reset on open.
  useEffect(() => {
    if (!open) {
      resolvedRef.current = false;
      setError('');
    }
  }, [open]);

  // Render Turnstile widget when a site key is provided.
  useEffect(() => {
    if (!open || !siteKey) return;
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
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => {
            if (resolvedRef.current) return;
            resolvedRef.current = true;
            onResolved({ captchaToken: token });
          },
          'error-callback': () => {
            setError('Verification failed. Please retry.');
          },
        });
      } catch (e) {
        setError('Could not load verification widget. Please retry.');
      }
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
  }, [open, siteKey, onResolved]);

  // Behavioural fallback: a "I'm human" confirmation. The server validates the
  // issued challenge token + minimum elapsed time, so this is a real (light)
  // proof, not just a button.
  const handleBehaviouralConfirm = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResolved({ challengeToken });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md" aria-describedby="bot-challenge-desc">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-lg font-bold">Please verify you're human</DialogTitle>
          <DialogDescription id="bot-challenge-desc" className="text-center">
            A quick check keeps SwapPulse safe from bots. Verify once to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex min-h-[80px] flex-col items-center justify-center gap-3">
          {siteKey ? (
            <div ref={containerRef} className="min-h-[65px] w-full" aria-label="Human verification widget" />
          ) : (
            <Button onClick={handleBehaviouralConfirm} size="lg" className="w-full">
              <ShieldCheck className="h-4 w-4" />
              I'm human, continue
            </Button>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="mt-2 flex justify-center">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}