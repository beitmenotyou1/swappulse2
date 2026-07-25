import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Package, ArrowRight, Loader2, Sparkles, Tag } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cardImageUrl, rarityClasses } from '@/lib/tcgdex';
import { formatPrice, variantLabel } from '@/lib/format';
import { toast } from '@/components/ui/use-toast';

// Groups collection entries by card_id + variant (§4.1: "groups by card_uri
// and variant"). Different conditions stay as separate underlying entries
// within the same group (edge case).
function groupDuplicates(items) {
  const groups = {};
  for (const item of items) {
    const key = `${item.card_id}|${item.variant || 'normal'}`;
    if (!groups[key]) {
      groups[key] = {
        card_id: item.card_id,
        card_name: item.card_name,
        card_image: item.card_image,
        set_name: item.set_name,
        rarity: item.rarity,
        variant: item.variant || 'normal',
        entries: [],
        combinedValue: 0,
      };
    }
    groups[key].entries.push(item);
    groups[key].combinedValue += item.market_value || item.purchase_price || 0;
  }
  return Object.values(groups).filter((g) => g.entries.length > 1);
}

export default function DuplicatesTab({ items }) {
  const [listing, setListing] = useState(null);
  const [bundles, setBundles] = useState(null);
  const [bundlesLoading, setBundlesLoading] = useState(false);

  const duplicates = useMemo(() => groupDuplicates(items), [items]);
  const dupCardCount = duplicates.reduce((s, g) => s + g.entries.length, 0);
  const tradeValue = duplicates.reduce((s, g) => s + g.combinedValue, 0);

  const listForTrade = async (group) => {
    setListing(group.card_id);
    try {
      await base44.entities.TradeListing.create({
        offer_card_ids: [group.card_id],
        offer_card_names: [group.card_name],
        offer_card_images: group.card_image ? [group.card_image] : [],
        wanted_card_names: [],
        status: 'open',
        visibility: 'public',
        author_name: '',
      });
      toast({ title: 'Listed for trade', description: `${group.card_name} is now on the trade board.` });
    } catch (e) {
      toast({ title: 'Could not list', description: e.message, variant: 'destructive' });
    } finally {
      setListing(null);
    }
  };

  const loadBundles = async () => {
    setBundlesLoading(true);
    try {
      const res = await base44.functions.invoke('feeds', { feed: 'smart-bundles' });
      setBundles(res?.bundles || []);
    } catch {
      setBundles([]);
    } finally {
      setBundlesLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Sidebar-style summary */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <p className="text-sm font-bold">
            You have {dupCardCount} duplicate {dupCardCount === 1 ? 'card' : 'cards'} worth{' '}
            <span className="text-accent">{formatPrice(tradeValue)}</span> in trade value
          </p>
        </div>
        {duplicates.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">No duplicates yet - extras you add will appear here.</p>
        )}
      </div>

      {duplicates.length === 0 ? (
        <div className="py-12 text-center">
          <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-bold">No duplicate cards</p>
          <p className="mt-1 text-sm text-muted-foreground">When you own multiple copies of the same card, they'll show up here for trading.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {duplicates.map((g) => {
            const { text } = rarityClasses(g.rarity);
            const conditions = [...new Set(g.entries.map((e) => e.condition).filter(Boolean))];
            return (
              <div key={`${g.card_id}|${g.variant}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Link to={`/card/${g.card_id}`}>
                  {cardImageUrl(g.card_image) ? (
                    <img src={cardImageUrl(g.card_image)} alt={g.card_name} className="h-20 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="h-20 w-14 rounded-lg bg-secondary" />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/card/${g.card_id}`} className="block truncate font-semibold hover:text-primary">{g.card_name}</Link>
                  <p className="truncate text-xs text-muted-foreground">{g.set_name} · {variantLabel(g.variant)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {g.rarity && <span className={`text-xs font-semibold ${text}`}>{g.rarity}</span>}
                    <span className="flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      <Package className="h-3 w-3" /> ×{g.entries.length}
                    </span>
                    {conditions.map((c) => (
                      <span key={c} className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{c}</span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Combined value: <b className="text-foreground">{formatPrice(g.combinedValue)}</b></p>
                </div>
                <button
                  onClick={() => listForTrade(g)}
                  disabled={listing === g.card_id}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {listing === g.card_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
                  List for Trade
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Bundle suggestions */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <Sparkles className="h-4 w-4 text-accent" /> Smart Bundle Suggestions
          </h3>
          {bundles === null && (
            <button onClick={loadBundles} className="text-xs font-semibold text-primary hover:underline">Find bundles</button>
          )}
        </div>
        {bundlesLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : bundles === null ? (
          <p className="text-xs text-muted-foreground">Match your duplicates against other collectors' wishlists to propose multi-card bundles.</p>
        ) : bundles.length === 0 ? (
          <p className="text-xs text-muted-foreground">No bundle matches found right now. Check back after more collectors post wishlists.</p>
        ) : (
          <div className="space-y-2">
            {bundles.map((b, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{b.targetUser || 'A collector'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Wants {b.offerCards?.join(', ')} · {b.matchCount} match{b.matchCount === 1 ? '' : 'es'}
                  </p>
                </div>
                <Link to="/trades" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                  Trade <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}