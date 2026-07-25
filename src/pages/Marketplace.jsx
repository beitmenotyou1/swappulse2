import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Loader2, Store, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import CreateListingModal from '@/components/marketplace/CreateListingModal';
import { cardImageUrl } from '@/lib/tcgdex';

const CUR_SYM = { GBP: '£', EUR: '€', USD: '$' };
const COND_LABEL = { mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent', good: 'Good', damaged: 'Damaged' };

export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListings(await base44.entities.MarketListing.filter({ status: 'active' }, '-created_date', 100));
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = listings.filter((l) => {
    const q = query.trim().toLowerCase();
    const nameOk = !q || (l.card_name || '').toLowerCase().includes(q);
    const regionOk = !region.trim() || (l.shipping_regions || []).some((r) => r.toLowerCase().includes(region.trim().toLowerCase()));
    return nameOk && regionOk;
  });

  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Buy and sell cards with trusted collectors">
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Sell a card
        </button>
      </PageHeader>

      <div className="sticky top-[57px] z-20 flex gap-2 border-b border-border bg-background/80 px-4 py-2 backdrop-blur">
        <div className="flex flex-1 items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search card name…" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" className="w-28 rounded-full border border-border bg-secondary px-3 py-1.5 text-sm outline-none focus:border-primary" />
      </div>

      <div className="mx-auto max-w-2xl space-y-3 px-4 py-4 pb-24 md:pb-8">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Store className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{listings.length === 0 ? 'No cards listed yet. Be the first to sell.' : 'No matches for your filters.'}</p>
          </div>
        ) : (
          filtered.map((l) => (
            <Link key={l.id} to={`/marketplace/${l.id}`} className="flex gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/40 hover:shadow-raised">
              <img src={cardImageUrl(l.card_image)} alt={l.card_name} className="h-24 w-18 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.card_name}</p>
                <p className="text-xs text-muted-foreground">{l.set_name || '—'}{l.rarity ? ` · ${l.rarity}` : ''}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{COND_LABEL[l.condition] || l.condition}{l.variant && l.variant !== 'normal' ? ` · ${l.variant.replace('_', ' ')}` : ''}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(l.shipping_regions || []).slice(0, 3).map((r) => (
                    <span key={r} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{r}</span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between">
                <p className="text-lg font-extrabold text-primary">{CUR_SYM[l.currency || 'GBP']}{Number(l.price).toFixed(2)}</p>
                <div className="flex items-center gap-1.5">
                  <Avatar name={l.seller_name} src={l.seller_avatar} size={20} />
                  <span className="text-[11px] text-muted-foreground">{l.seller_name || 'Seller'}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <CreateListingModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}