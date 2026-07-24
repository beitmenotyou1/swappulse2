import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { isPushSupported, getSubscriptionState, subscribePush, unsubscribePush } from '@/lib/push';

export default function NotificationToggle() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    const s = await getSubscriptionState();
    setSupported(s.supported);
    setSubscribed(s.subscribed);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (subscribed) await unsubscribePush();
      else await subscribePush();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !supported) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {subscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
          <div>
            <p className="text-sm font-semibold">Push Notifications</p>
            <p className="text-xs text-muted-foreground">{subscribed ? 'Enabled' : 'Price & trade alerts'}</p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={busy}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
            subscribed ? 'border border-border text-muted-foreground' : 'bg-primary text-white'
          }`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : subscribed ? 'Disable' : 'Enable'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}