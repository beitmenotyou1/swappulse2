import React, { useState } from 'react';
import { X, Search } from 'lucide-react';
import { cardImageUrl } from '@/lib/tcgdex';

export default function SlotPicker({ entries, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const filtered = entries.filter((e) =>
    (e.card_name || '').toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="font-bold">Pick a card for this slot</h3>
          <button aria-label="Close slot picker" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-3 pb-0">
          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your collection..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No cards found. Add cards to your collection first.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onSelect(e)}
                  className="overflow-hidden rounded-lg border border-border bg-background text-left hover:border-primary"
                >
                  {cardImageUrl(e.card_image) ? (
                    <img
                      src={cardImageUrl(e.card_image)}
                      alt={e.card_name}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-[3/4] w-full bg-secondary" />
                  )}
                  <p className="truncate p-1 text-[10px] font-semibold">{e.card_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}