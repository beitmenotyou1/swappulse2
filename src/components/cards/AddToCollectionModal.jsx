import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cardSetName } from '@/lib/tcgdex';
import CardImage from '@/components/cards/CardImage';
import { conditionLabel, variantLabel } from '@/lib/format';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { createEntry } from '@/lib/offlineSync';
import SettingSelect from '@/components/settings/SettingSelect';

export default function AddToCollectionModal({ open, onClose, card }) {
  const [condition, setCondition] = useState('near_mint');
  const [variant, setVariant] = useState('normal');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const stamped = await stampRecord({
        card_id: card.id,
        card_name: card.name,
        card_image: card.image,
        set_id: card.set?.id,
        set_name: card.set?.name,
        local_id: card.localId,
        rarity: card.rarity,
        category: card.category,
        condition,
        variant,
        acquisition_date: new Date().toISOString().slice(0, 10),
        purchase_price: price ? Math.round(parseFloat(price) * 100) : null,
        notes,
      }, NSID.COLLECTION_ENTRY, did, signingKey);
      const created = await createEntry(stamped);
      // Privacy containment: raw collection entries stay private in Base44.
      // Public federation will use a sanitised projection in a later phase.
      onClose();
      setPrice('');
      setNotes('');
      setCondition('near_mint');
      setVariant('normal');
    } catch (e) {
      alert('Could not save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add to Collection</h2>
          <button onClick={onClose} className="relative rounded-full p-1.5 hover:bg-secondary before:content-[''] before:absolute before:-inset-1.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {card && (
          <div className="mb-4 flex gap-3 rounded-xl border border-border bg-secondary p-3">
            <div className="h-28 w-20 overflow-hidden rounded-lg bg-muted">
              <CardImage card={card} alt={card.name} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">{card.name}</p>
              <p className="text-sm text-muted-foreground">{cardSetName(card)}</p>
              <p className="text-xs text-primary">{card.rarity}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Condition</label>
            <SettingSelect
              value={condition}
              onChange={setCondition}
              label="Condition"
              options={['mint', 'near_mint', 'excellent', 'good', 'damaged'].map((c) => ({ value: c, label: conditionLabel(c) }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Variant</label>
            <SettingSelect
              value={variant}
              onChange={setVariant}
              label="Variant"
              options={['normal', 'holo', 'reverse_holo'].map((v) => ({ value: v, label: variantLabel(v) }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Purchase price (£)</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Optional notes…"
              className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Add Card'}
          </button>
        </div>
      </div>
    </div>
  );
}