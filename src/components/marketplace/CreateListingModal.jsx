import React, { useState } from 'react';
import { X, Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import CardSearchModal from '@/components/cards/CardSearchModal';
import { cardImageUrl } from '@/lib/tcgdex';

const CONDITIONS = [['mint', 'Mint'], ['near_mint', 'Near Mint'], ['excellent', 'Excellent'], ['good', 'Good'], ['damaged', 'Damaged']];
const VARIANTS = [['normal', 'Normal'], ['holo', 'Holo'], ['reverse_holo', 'Reverse Holo']];
const CURRENCIES = ['GBP', 'EUR', 'USD'];

export default function CreateListingModal({ open, onClose, onCreated }) {
  const [card, setCard] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [condition, setCondition] = useState('near_mint');
  const [variant, setVariant] = useState('normal');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [regions, setRegions] = useState(['UK']);
  const [regionsText, setRegionsText] = useState('UK');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = async () => {
    if (!card) return setError('Select a card to sell.');
    const p = Number(price);
    if (!p || p < 0.50) return setError('Enter a price of at least 0.50.');
    setSaving(true);
    setError('');
    try {
      const { did } = await ensureUserDid();
      const me = await base44.auth.me();
      await base44.entities.MarketListing.create({
        card_id: card.id,
        card_name: card.name,
        card_image: card.image || '',
        set_name: card.set_name || card.setName || '',
        rarity: card.rarity || '',
        condition,
        variant,
        price: p,
        currency,
        shipping_regions: regionsText.split(',').map((s) => s.trim()).filter(Boolean),
        notes: notes.trim(),
        status: 'active',
        did,
        seller_name: me?.full_name || '',
        seller_handle: me?.email?.split('@')[0] || '',
        seller_avatar: '',
      });
      setCard(null); setPrice(''); setNotes(''); setRegionsText('UK'); setRegions(['UK']);
      onCreated?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to create listing');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-8 w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">Sell a card</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Card</p>
              <button onClick={() => setSearchOpen(true)} className="flex items-center gap-1 text-xs font-bold text-primary">
                <Search className="h-3.5 w-3.5" /> {card ? 'Change' : 'Select card'}
              </button>
            </div>
            {card ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-2.5">
                <img src={cardImageUrl(card.image)} alt={card.name} className="h-20 w-14 rounded object-cover" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{card.name}</p>
                  <p className="text-xs text-muted-foreground">{card.rarity || '—'}</p>
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-secondary py-6 text-center text-xs text-muted-foreground">No card selected</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className={field}>
                {CONDITIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variant</label>
              <select value={variant} onChange={(e) => setVariant(e.target.value)} className={field}>
                {VARIANTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</label>
              <input type="number" min="0.5" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="19.99" className={field} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shipping regions (comma separated)</label>
            <input value={regionsText} onChange={(e) => setRegionsText(e.target.value)} placeholder="UK, EU" className={field} />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Notes (optional)…" className={`resize-none ${field}`} />

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Publish listing
          </button>
        </div>
      </div>

      <CardSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} title="Select card to sell" onSelect={(c) => setCard(c)} />
    </div>
  );
}