import React, { useState } from 'react';
import { X, Loader2, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function RefundModal({ balance, topups, onClose }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const fiatCents = balance?.fiat_cents || 0;
  const currency = balance?.currency || 'GBP';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';

  // Calculate total refundable from topups
  const totalRefundable = topups
    .filter((t) => t.status === 'succeeded')
    .reduce((sum, t) => sum + (t.refundable_cents || 0), 0);

  const handleRefund = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents < 100) {
      toast({ title: 'Invalid amount', description: 'Minimum refund is 1.00', variant: 'destructive' });
      return;
    }
    if (cents > totalRefundable) {
      toast({ title: 'Amount too high', description: `Only ${symbol}${(totalRefundable / 100).toFixed(2)} is refundable.`, variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('request-refund', { refund_cents: cents });
      if (res.data?.error) {
        toast({ title: 'Refund failed', description: res.data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Refund initiated!', description: `${symbol}${(cents / 100).toFixed(2)} will be returned to your original payment method.` });
      onClose();
    } catch (e) {
      toast({ title: 'Refund failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Refund to Bank</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Refund unused top-up balance back to your original Stripe payment method. No fee is charged on refunds.
          Only original fiat top-up amounts can be refunded — converted USDC cannot.
        </p>

        <div className="mb-3 rounded-lg bg-secondary p-3 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Fiat Balance</span><span className="font-semibold">{symbol}{(fiatCents / 100).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Refundable</span><span className="font-semibold text-primary">{symbol}{(totalRefundable / 100).toFixed(2)}</span></div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">{symbol}</span>
            <input
              type="number"
              step="0.01"
              min="1"
              max={(totalRefundable / 100).toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-border bg-secondary py-3 pl-8 pr-3 text-lg font-semibold outline-none focus:border-primary"
            />
          </div>
        </div>

        <button
          onClick={handleRefund}
          disabled={loading || !amount || totalRefundable === 0}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {loading ? 'Processing…' : 'Request Refund'}
        </button>
      </div>
    </div>
  );
}