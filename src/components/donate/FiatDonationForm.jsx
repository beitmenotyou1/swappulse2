import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Heart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import TurnstileWidget from '@/components/TurnstileWidget';

const PRESETS = [5, 10, 25, 50, 100];

export default function FiatDonationForm() {
  const [amount, setAmount] = useState(10);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [siteKey, setSiteKey] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    base44.functions.invoke('get-turnstile-site-key', {})
      .then((res) => setSiteKey(res?.siteKey || res?.data?.siteKey || ''))
      .catch(() => setSiteKey(''));
  }, []);

  const onVerify = useCallback((token) => setTurnstileToken(token), []);

  const donate = async () => {
    if (!turnstileToken) {
      toast({ title: 'Please complete the bot check', description: 'Verify you\'re human before donating.', variant: 'destructive' });
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0.5) {
      toast({ title: 'Minimum donation is £0.50', description: 'Increase the amount to at least £0.50.', variant: 'destructive' });
      return;
    }
    if (!email.trim()) {
      toast({ title: 'Email required', description: 'Stripe needs your email to send a receipt.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('create-fiat-donation', { amount: value, donorName: name, donorEmail: email, turnstileToken });
      const data = res?.data ?? res;
      if (!data?.redirectUrl) throw new Error(data?.error || 'No checkout URL returned.');
      window.location.href = data.redirectUrl;
    } catch (e) {
      toast({ title: 'Donation unavailable', description: e?.response?.data?.error || e?.message || 'Please try again later.', variant: 'destructive' });
      setLoading(false);
      setTurnstileToken(null);
      setResetKey((k) => k + 1);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-raised">
      <label htmlFor="fiat-amount" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Amount (GBP)</label>
      <div className="flex items-center rounded-xl border border-border bg-background">
        <span className="px-3 text-lg font-bold text-muted-foreground">£</span>
        <input
          id="fiat-amount"
          type="number"
          min={0.5}
          step={0.5}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent py-3 pr-3 text-lg font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${Number(amount) === p ? 'bg-primary text-white' : 'bg-secondary text-foreground hover:bg-secondary/70'}`}
          >
            £{p}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="fiat-name" className="mb-1 block text-xs font-semibold text-muted-foreground">Name (optional)</label>
          <input
            id="fiat-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="fiat-email" className="mb-1 block text-xs font-semibold text-muted-foreground">Email</label>
          <input
            id="fiat-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            required
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        {siteKey ? (
          <TurnstileWidget siteKey={siteKey} onVerify={onVerify} resetKey={resetKey} />
        ) : (
          <div className="h-[65px] w-full animate-pulse rounded-md bg-secondary" />
        )}
      </div>

      <button
        onClick={donate}
        disabled={loading || !turnstileToken}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5 fill-current" />}
        {loading ? 'Redirecting to checkout…' : `Donate £${Number(amount || 0).toFixed(2)} with card`}
      </button>

      <p className="mt-3 text-center text-xs text-muted-foreground">Minimum £0.50 · Secure checkout via Stripe</p>
    </div>
  );
}