import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { formatPrice, conditionLabel, variantLabel } from '@/lib/format';

export default function Collection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await base44.entities.CollectionEntry.list('-updated_date', 200));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    await base44.entities.CollectionEntry.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const totalValue = items.reduce((s, c) => s + (c.market_value || c.purchase_price || 0), 0);
  const rarities = [...new Set(items.map((i) => i.rarity).filter(Boolean))];

  const filtered = filter === 'all' ? items : items.filter((i) => i.rarity === filter);

  return (
    <div>
      <PageHeader title="My Collection" subtitle={`${items.length} cards tracked`}>
        <Link to="/explore" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add
        </Link>
      </PageHeader>

      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total Value</p>
          <p className="text-lg font-extrabold">{formatPrice(totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Cards</p>
          <p className="text-lg font-extrabold">{items.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Rarities</p>
          <p className="text-lg font-extrabold">{rarities.length}</p>
        </div>
      </div>

      {rarities.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === 'all' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
          >
            All
          </button>
          {rarities.map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${filter === r ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <LayoutGrid className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">Your collection is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Search the catalog and add your first card.</p>
          <Link to="/explore" className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white">Explore Cards</Link>
        </div>
      ) : (
        <div className="p-4">
          <div className="space-y-2">
            {filtered.map((item) => {
              const { text } = rarityClasses(item.rarity);
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <Link to={`/card/${item.card_id}`}>
                    {cardImageUrl(item.card_image) ? (
                      <img src={cardImageUrl(item.card_image)} alt={item.card_name} className="h-20 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="h-20 w-14 rounded-lg bg-secondary" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/card/${item.card_id}`} className="block truncate font-semibold hover:text-primary">{item.card_name}</Link>
                    <p className="truncate text-xs text-muted-foreground">{item.set_name} · #{item.local_id}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {item.rarity && <span className={`text-xs font-semibold ${text}`}>{item.rarity}</span>}
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{conditionLabel(item.condition)}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{variantLabel(item.variant)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {item.purchase_price ? (
                      <p className="text-sm font-bold">{formatPrice(item.purchase_price)}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                    <button onClick={() => remove(item.id)} className="mt-1 text-muted-foreground hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}