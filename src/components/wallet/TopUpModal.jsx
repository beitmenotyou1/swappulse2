import React, { useState } from 'react';
import { X, Loader2, CreditCard } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

function CheckoutForm({ clientSecret, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        toast({ title: 'Payment failed', description: error.message, variant: 'destructive' });
      } else if (paymentIntent.status === 'succeeded') {
        toast({ title: 'Top-up successful!', description: 'Your wallet has been credited.' });
        onSuccess();
      }
    } catch (e) {
      toast({ title: 'Payment failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="submit"
        disabled={!stripe || loading}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {loading ? 'Processing…' : 'Pay Now'}
      </button>
    </form>
  );
}

export default function TopUpModal({ onClose }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);

  const presets = [10, 25, 50, 100];

  const handleTopUp = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents < 100) {
      toast({ title: 'Invalid amount', description: 'Minimum top-up is 1.00', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('create-wallet-topup', { amount_cents: cents, currency });
      if (res.data?.error) {
        toast({ title: 'Top-up failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      setClientSecret(res.data.client_secret);
      const stripeKey = await base44.functions.invoke('get-payment-config', {});
      const publishableKey = stripeKey.data?.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (publishableKey) {
        setStripePromise(loadStripe(publishableKey));
      }
    } catch (e) {
      toast({ title: 'Top-up failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Top Up Wallet</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {!clientSecret ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Add funds to your wallet via Stripe. A 2% fee applies and is converted to USDC on Polygon.
            </p>
            <div className="mb-3 flex gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                    amount === String(p) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'
                  }`}
                >
                  {currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}{p}
                </button>
              ))}
            </div>
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">
                  {currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border bg-secondary py-3 pl-8 pr-3 text-lg font-semibold outline-none focus:border-primary"
                />
              </div>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-xl border border-border bg-secondary px-3 text-sm font-semibold outline-none focus:border-primary"
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            {amount && parseFloat(amount) > 0 && (
              <div className="mb-4 rounded-lg bg-secondary p-3 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}{parseFloat(amount).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee (2%)</span><span className="font-semibold">{currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}{(parseFloat(amount) * 0.02).toFixed(2)}</span></div>
                <div className="mt-1 flex justify-between border-t border-border pt-1"><span className="font-bold">Total</span><span className="font-bold">{currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'}{(parseFloat(amount) * 1.02).toFixed(2)}</span></div>
              </div>
            )}
            <button
              onClick={handleTopUp}
              disabled={loading || !amount}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {loading ? 'Creating payment…' : 'Continue to Payment'}
            </button>
          </>
        ) : (
          stripePromise && clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm clientSecret={clientSecret} onSuccess={onClose} onClose={onClose} />
            </Elements>
          ) : (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          )
        )}
      </div>
    </div>
  );
}