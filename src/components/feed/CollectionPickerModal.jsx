import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';

// Pick-from-collection modal for the composer. Lists the collector's current
// CollectionEntry records (read live so removed cards disappear), with a
// client-side name filter, and calls onAttach with a card normalised to the
// attachedCard shape ComposeBox expects.
export default function CollectionPickerModal({ open, onClose, onAttach, title = 'Pick from your collection' }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const list = await base44.entities.CollectionEntry.filter(
        { created_by_id: user.id },
        '-updated_date',
        200,
      );
      setEntries(list || []);
    } catch (e) {
      setError(e?.message || 'Could not load collection');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const filtered = query.trim()
    ? entries.filter((e) =>
        (e.card_name || '').toLowerCase().includes(query.trim().toLowerCase()),
      )
    : entries;

  const pick = (e) => {
    onAttach({
      id: e.card_id,
      name: e.card_name,
      image: e.card_image,
      rarity: e.rarity,
      set: { name: e.set_name },
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-8 w-full max-w-2xl animate-slide-up rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name…"
              className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {error && <p className="py-10 text-center text-sm text-destructive">{error}</p>}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {entries.length === 0 ? 'Your collection is empty.' : 'No cards match that name.'}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="mt-4 grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
              {filtered.map((e) => {
                const { text } = rarityClasses(e.rarity);
                return (
                  <button
                    key={e.id}
                    onClick={() => pick(e)}
                    className="group overflow-hidden rounded-lg border border-border bg-secondary text-left transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-muted">
                      {cardImageUrl(e.card_image) ? (
                        <img src={cardImageUrl(e.card_image)} alt={e.card_name} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      ) : (
                        <div className="grid h-full place-items-center text-[10px] text-muted-foreground">No image</div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <p className="truncate text-[11px] font-semibold">{e.card_name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{e.set_name}</p>
                      <p className={`truncate text-[10px] ${text}`}>{e.rarity || '-'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}