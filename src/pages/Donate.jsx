import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Logo from '@/components/Logo';

const PRESETS = [2, 5, 10, 25];

export default function Donate() {
  const [amount, setAmount] = useState(5);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const donate = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0.5) {
      toast({ title: 'Minimum donation is £0.50', description: 'Wix Payments cannot process smaller amounts.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('create-donation', { amount: value });
      if (!res?.redirectUrl) throw new Error(res?.error || 'No checkout URL returned.');
      window.location.href = res.redirectUrl;
    } catch (e) {
      toast({ title: 'Donation unavailable', description: e?.message || 'Please try again later.', variant: 'destructive' });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} withText={false} />
          <span className="font-extrabold">SwapPulse</span>
        </Link>
        <Link to="/" className="flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-raised">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
              <Heart className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">Support SwapPulse</h1>
              <p className="text-sm text-muted-foreground">Keep the platform free &amp; open-source</p>
            </div>
          </div>

          <p className="mb-5 text-sm text-muted-foreground">
            SwapPulse is built by collectors, for collectors. Every feature stays free and open-source — your donation
            helps cover hosting, the TCGdex catalog, and the AT Protocol infrastructure that keeps your collection
            self-sovereign. Give whatever feels right.
          </p>

          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Amount (GBP)</label>
          <div className="flex items-center rounded-xl border border-border bg-background">
            <span className="px-3 text-lg font-bold text-muted-foreground">£</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent py-3 pr-3 text-lg font-bold outline-none"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                  Number(amount) === p ? 'bg-primary text-white' : 'bg-secondary text-foreground hover:bg-secondary/70'
                }`}
              >
                £{p}
              </button>
            ))}
          </div>

          <button
            onClick={donate}
            disabled={loading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5 fill-current" />}
            {loading ? 'Redirecting to checkout…' : `Donate £${Number(amount || 0).toFixed(2)}`}
          </button>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            Minimum £0.50 · Secure checkout via Base44 Payments
          </p>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          SwapPulse is in alpha — your support means the world.
        </p>
      </main>
    </div>
  );
}