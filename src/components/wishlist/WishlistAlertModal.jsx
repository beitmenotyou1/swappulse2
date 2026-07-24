import React, { useEffect, useState } from 'react';
import { X, Loader2, Bell, Trash2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const NOTIFY_OPTIONS = [
  { id: 'email', label: 'Email' },
  { id: 'push', label: 'Push' },
  { id: 'both', label: 'Both' },
  { id: 'none', label: 'Silent' },
];

// §4 Wishlist alerts — creates a SavedSearch for a card and lists existing alerts.
export default function WishlistAlertModal({ card, onClose }) {
  const [name, setName] = useState(card?.name ? `${card.name} alert` : '');
  const [maxPrice, setMaxPrice] = useState('');
  const [notify, setNotify] = useState('email');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setAlerts(await base44.entities.SavedSearch.list('-created_date', 50));
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true);
    setMsg('');
    try {
      await base44.entities.SavedSearch.create({
        name: name || `${card?.name || 'Card'} alert`,
        card_name: card?.name || '',
        set_code: card?.set?.id || '',
        rarity: card?.rarity || '',
        max_price: maxPrice ? Math.round(parseFloat(maxPrice) * 100) : null,
        notify,
      });
      setMsg('Alert created.');
      setMaxPrice('');
      load();
    } catch (e) {
      setMsg(e.message || 'Could not create');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await base44.entities.SavedSearch.delete(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold"><Bell className="h-4 w-4 text-primary" /> Wishlist alert</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>

        <p className="text-xs text-muted-foreground">
          Get notified when <span className="font-semibold text-foreground">{card?.name || 'this card'}</span> hits your target price or appears in an open trade.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Alert name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Max price (£) — optional</label>
            <input
              type="number"
              step="0.01"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="e.g. 25.00"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Notify me via</label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {NOTIFY_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setNotify(o.id)}
                  className={`rounded-lg border px-2 py-2 text-sm font-bold ${
                    notify === o.id ? 'border-primary bg-primary/15 text-primary' : 'border-border'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={create}
          disabled={saving}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Create alert
        </button>
        {msg && <p className="mt-2 flex items-center gap-1 text-xs text-success"><Check className="h-3 w-3" /> {msg}</p>}

        <div className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your alerts</h3>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : alerts.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No alerts yet.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.card_name || 'Any'} · {a.max_price ? `max £${(a.max_price / 100).toFixed(2)}` : 'no limit'} · {a.notify}
                    </p>
                  </div>
                  <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}