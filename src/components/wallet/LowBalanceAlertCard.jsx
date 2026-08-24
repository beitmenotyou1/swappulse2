import React, { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';

// Card that lets a user enable/configure a low-balance alert threshold.
// When enabled, the scheduled check-low-balances function will notify them
// (in-app + push) once per 24h if their fiat balance drops below the threshold.
export default function LowBalanceAlertCard({ balance, onUpdated }) {
  const { toast } = useToast();
  const existingThreshold = balance?.low_balance_threshold_cents || 0;
  const [enabled, setEnabled] = useState(existingThreshold > 0);
  const [amount, setAmount] = useState(
    existingThreshold > 0 ? String(Math.floor(existingThreshold / 100)) : ''
  );
  const [saving, setSaving] = useState(false);

  const currency = balance?.currency || 'GBP';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  const currentFiat = balance?.fiat_cents || 0;

  const handleSave = async () => {
    if (!balance?.id) {
      toast({ title: 'No wallet balance found', description: 'Top up your wallet first to enable alerts.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const thresholdCents = enabled && amount
        ? Math.max(0, Math.floor(parseFloat(amount) * 100))
        : 0;
      await base44.entities.WalletBalance.update(balance.id, {
        low_balance_threshold_cents: thresholdCents,
        low_balance_notified_at: null,
      });
      toast({
        title: thresholdCents > 0 ? 'Alert enabled' : 'Alert disabled',
        description: thresholdCents > 0
          ? `You'll be notified when your balance drops below ${symbol}${(thresholdCents / 100).toFixed(2)}.`
          : 'Low balance alerts are now off.',
      });
      onUpdated?.();
    } catch (e) {
      toast({ title: 'Failed to save', description: e.message || 'Please try again', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Low Balance Alert</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Get notified when your balance drops below a set amount.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Toggle low balance alert" />
          </div>

          {enabled && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Notify me below</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold">{symbol}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10"
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {enabled && currentFiat > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Current balance: {symbol}{(currentFiat / 100).toFixed(2)}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save Alert
          </button>
        </div>
      </div>
    </div>
  );
}