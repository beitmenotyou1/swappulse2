import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, Loader2 } from 'lucide-react';
import { isPushSupported, getSubscriptionState, subscribePush } from '@/lib/push';

// One-time push-notification permission prompt shown after the onboarding
// tour completes. The parent controls visibility via `open`; this component
// sets the swappulse_push_prompted localStorage flag on any dismissal so it
// never reappears, and calls subscribePush() when the user enables.
export default function PushOnboardingPrompt({ open, onClose }) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      const s = await isPushSupported();
      setSupported(s);
      if (s) {
        const { subscribed: sub } = await getSubscriptionState();
        setSubscribed(sub);
        if (sub) {
          // Already subscribed — mark prompted and auto-close.
          localStorage.setItem('swappulse_push_prompted', '1');
          onClose?.();
        }
      }
    })();
  }, [open, onClose]);

  const dismiss = () => {
    localStorage.setItem('swappulse_push_prompted', '1');
    onClose?.();
  };

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      await subscribePush();
      localStorage.setItem('swappulse_push_prompted', '1');
      onClose?.();
    } catch (e) {
      setError(e?.message || 'Could not enable notifications. You can try again later in Settings.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-primary/10">
            <Bell className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Stay in the loop</DialogTitle>
          <DialogDescription className="text-center text-sm">
            Get instant alerts for new followers, replies, trade matches, and wishlist price drops, even when you're not in the app.
          </DialogDescription>
        </DialogHeader>
        {!supported ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Push notifications aren't supported on this device. You can still see all your alerts inside the app.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <Button onClick={enable} disabled={busy} className="h-11 w-full font-medium">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable notifications'}
            </Button>
            <button onClick={dismiss} disabled={busy} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">
              Maybe later
            </button>
            {error && <p className="mt-1 text-center text-xs text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}