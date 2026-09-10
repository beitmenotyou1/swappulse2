import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import useSEO from '@/hooks/useSEO';

function unwrap(response) {
  return response?.data || response;
}

function turnstileApi() {
  return (/** @type {any} */ (window)).turnstile;
}

function loadTurnstile() {
  if (turnstileApi()) return Promise.resolve(turnstileApi());
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-swappulse-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve(turnstileApi()), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.swappulseTurnstile = 'true';
    script.onload = () => resolve(turnstileApi());
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function DiscordVerify() {
  useSEO({
    title: 'Discord verification',
    description: 'Complete the one-time SwapPulse Bot check to unlock the Collector role on Discord.',
    canonicalPath: '/discord-verify',
  });
  const challenge = new URLSearchParams(window.location.search).get('challenge') || '';
  const widgetHost = useRef(null);
  const [siteKey, setSiteKey] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [state, setState] = useState(challenge ? 'loading' : 'invalid');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!challenge) return;
    (async () => {
      try {
        const config = unwrap(await base44.functions.invoke('discord-captcha-verify', { op: 'config' }));
        if (!config?.site_key) throw new Error('CAPTCHA is not configured.');
        setSiteKey(config.site_key);
        setState('ready');
      } catch (error) {
        setMessage(error?.message || 'Discord verification is not ready yet.');
        setState('error');
      }
    })();
  }, [challenge]);

  useEffect(() => {
    if (!siteKey || state !== 'ready' || !widgetHost.current) return undefined;
    let widgetId;
    let active = true;
    loadTurnstile()
      .then((turnstile) => {
        if (!active || !turnstile || !widgetHost.current) return;
        widgetId = turnstile.render(widgetHost.current, {
          sitekey: siteKey,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          callback: (token) => setCaptchaToken(token),
          'expired-callback': () => setCaptchaToken(''),
          'error-callback': () => setCaptchaToken(''),
        });
      })
      .catch(() => {
        setMessage('The bot check could not be loaded.');
        setState('error');
      });
    return () => {
      active = false;
      if (widgetId !== undefined && turnstileApi()) turnstileApi().remove(widgetId);
    };
  }, [siteKey, state]);

  const verify = async () => {
    if (!captchaToken) return;
    setState('submitting');
    try {
      const result = unwrap(await base44.functions.invoke('discord-captcha-verify', {
        challenge,
        captcha_token: captchaToken,
      }));
      if (!result?.ok) throw new Error(result?.error || 'Verification was not accepted.');
      setMessage(`Role granted: ${(result.roles || ['Collector']).join(', ')}`);
      setState('success');
    } catch (error) {
      setMessage(error?.message || 'Verification could not be completed.');
      setState('error');
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex justify-center"><Logo size={52} withText /></div>
        <div className="text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Discord Collector verification</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete this one-time bot check to unlock the Collector areas in the SwapPulse Discord server.
          </p>
        </div>

        {state === 'loading' || state === 'submitting' ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : state === 'invalid' ? (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
            Open the private verification link supplied by SwapPulse Bot in Discord.
          </div>
        ) : state === 'success' ? (
          <div className="mt-6 rounded-lg border border-success/30 bg-success/10 p-4 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-success" />
            <p className="mt-2 font-semibold">Verification complete</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            <p className="mt-3 text-sm">You can return to Discord now.</p>
          </div>
        ) : state === 'error' ? (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center">
            <XCircle className="mx-auto h-7 w-7 text-destructive" />
            <p className="mt-2 font-semibold">Verification was not completed</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            <p className="mt-3 text-sm">Run /verify in Discord to create a new private link.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div ref={widgetHost} className="flex min-h-[65px] justify-center" />
            <Button className="w-full" onClick={verify} disabled={!captchaToken}>
              Verify and grant Collector role
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              SwapPulse stores only the verification result. The CAPTCHA response is never retained.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
