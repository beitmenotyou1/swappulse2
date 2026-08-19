import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Heart, Copy, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import TurnstileWidget from '@/components/TurnstileWidget';
import CryptoCurrencySelector from './CryptoCurrencySelector';
import CryptoPaymentStatus from './CryptoPaymentStatus';

const PRESETS = [5, 10, 25, 50, 100];

export default function CryptoDonationForm() {
  const [amount, setAmount] = useState(10);
  const [payCurrency, setPayCurrency] = useState('usdcsol');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [siteKey, setSiteKey] = useState('');
  const [payment, setPayment] = useState(null);
  const [copied, setCopied] = useState(false);
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
      toast({ title: 'Minimum donation is $0.50', description: 'Increase the amount to at least $0.50.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('create-crypto-donation', { amount: value, payCurrency, donorName: name, donorEmail: email, turnstileToken });
      const data = res?.data ?? res;
      if (!data?.payAddress) throw new Error(data?.error || 'No deposit address returned.');
      setPayment(data);
    } catch (e) {
      toast({ title: 'Donation unavailable', description: e?.response?.data?.error || e?.message || 'Please try again later.', variant: 'destructive' });
      setTurnstileToken(null);
      setResetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async () => {
    if (!payment?.payAddress) return;
    try {
      await navigator.clipboard.writeText(payment.payAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy', description: 'Copy the address manually instead.', variant: 'destructive' });
    }
  };

  if (payment) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-raised">
        <h2 className="text-base font-extrabold">Send your donation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send exactly the amount below to the deposit address. The payment is detected automatically.
        </p>

        <div className="mt-4 rounded-xl border border-border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deposit address ({payment.payCurrency})</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 break-all text-sm">{payment.payAddress}</code>
            <button onClick={copyAddress} aria-label="Copy address" className="shrink-0 cursor-pointer rounded-lg border border-border p-2 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exact amount to send</p>
          <p className="mt-1 text-lg font-bold">{payment.payAmount} {payment.payCurrency}</p>
        </div>

        <CryptoPaymentStatus paymentId={payment.paymentId} />

        <button
          onClick={() => setPayment(null)}
          className="mt-4 w-full cursor-pointer rounded-full border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel and start over
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-raised">
      <label htmlFor="crypto-amount" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Amount (USD)</label>
      <div className="flex items-center rounded-xl border border-border bg-background">
        <span className="px-3 text-lg font-bold text-muted-foreground">$</span>
        <input
          id="crypto-amount"
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
            ${p}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <label htmlFor="crypto-currency" className="mb-1 block text-xs font-semibold text-muted-foreground">Cryptocurrency</label>
        <CryptoCurrencySelector value={payCurrency} onChange={setPayCurrency} />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="crypto-name" className="mb-1 block text-xs font-semibold text-muted-foreground">Name (optional)</label>
          <input
            id="crypto-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="Your name"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="crypto-email" className="mb-1 block text-xs font-semibold text-muted-foreground">Email (optional, for receipt)</label>
          <input
            id="crypto-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
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
        {loading ? 'Creating payment…' : `Donate $${Number(amount || 0).toFixed(2)} with crypto`}
      </button>

      <p className="mt-3 text-center text-xs text-muted-foreground">Minimum $0.50 · Powered by NowPayments</p>
    </div>
  );
}