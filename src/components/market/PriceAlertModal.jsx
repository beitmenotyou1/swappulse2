import React, { useState, useEffect } from 'react';
import { X, Loader2, Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { withBotGuard } from '@/lib/botGuardClient';

// PriceAlertModal — creates a SavedSearch price alert for a card. Reuses the
// existing SavedSearch entity + checkWishlistAlerts workflow pattern so alerts
// fire on the scheduled scan. Supports push/email/both notification channels
// and an optional max-price threshold. Gates behind bot protection.
export default function PriceAlertModal({ open, onClose, card }) {
  const [cardName, setCardName] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [notify, setNotify] = useState('email');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) { setCardName(''); setMaxPrice(''); setNotify('email'); }
  }, [open]);

  if (!open) return null;

  const resolvedName = card?.name || cardName.trim();
  const canSubmit = resolvedName.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await withBotGuard('price_alert', resolvedName, async () => {
        await base44.entities.SavedSearch.create({
          name: `${resolvedName} alert`,
          card_name: resolvedName,
          set_code: card?.set?.id || '',
          rarity: card?.rarity || '',
          max_price: maxPrice ? Math.round(parseFloat(maxPrice) * 100) : null,
          notify,
        });
      });
      toast({ title: 'Price alert created', description: `We'll notify you when ${resolvedName} drops to your target.` });
      onClose();
    } catch (e) {
      toast({ title: 'Could not create alert', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 shadow-elevated sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Bell className="h-4 w-4 text-accent" /> Price Alert
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {card && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-secondary p-3">
            {card.image && (
              <img src={card.image.startsWith('http') ? card.image : `https://assets.tcgdex.net/${card.image}/low.webp`} alt="" className="h-12 w-9 rounded object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{card.name}</p>
              <p className="truncate text-xs text-muted-foreground">{card.set?.name}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {!card && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Card name</label>
              <input
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="e.g. Charizard ex"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Target price (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input
                type="number"
                step="0.50"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="e.g. 25.00"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-7 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Leave empty to get notified when any open trade lists this card.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Notify me via</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'email', label: 'Email' },
                { val: 'push', label: 'Push' },
                { val: 'both', label: 'Both' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setNotify(opt.val)}
                  className={`rounded-lg border py-2 text-xs font-semibold transition-colors ${
                    notify === opt.val ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={submit}
            disabled={saving || !canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Create alert
          </button>
        </div>
      </div>
    </div>
  );
}