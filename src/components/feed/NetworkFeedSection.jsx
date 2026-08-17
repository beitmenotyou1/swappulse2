import React, { useEffect, useState } from 'react';
import { Loader2, Globe, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { cardImageUrl } from '@/lib/tcgdex';
import Avatar from '@/components/Avatar';
import ExternalIndicator from '@/components/ExternalIndicator';
import { useMembership } from '@/lib/membershipContext';

// Pulls recent trade listings and collection entries directly from the
// AT Protocol PDS via the network-feed backend function. When `did` is
// provided, results are filtered to that author (profile page). When
// `type` is 'trades' or 'collections', only that record type is shown.
export default function NetworkFeedSection({
  did = null,
  type = 'all',
  limit = 20,
  title = 'From the Network',
  showHeader = true,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { registerDid } = useMembership();

  useEffect(() => {
    items.forEach((i) => i?.authorDid && registerDid(i.authorDid));
  }, [items, registerDid]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await base44.functions.invoke('network-feed', { did, type, limit });
        const data = res.data || res;
        if (active) setItems(data.items || []);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [did, type, limit]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading from the network…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Could not reach the network.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No records on the network yet.
      </div>
    );
  }

  const trades = items.filter((i) => i.collection === 'org.swappulse.tradeListing');
  const collections = items.filter((i) => i.collection === 'org.swappulse.collectionEntry');

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">{title}</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Live from PDS</span>
        </div>
      )}

      {trades.length > 0 && (type === 'all' || type === 'trades') && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent Trade Listings</p>
          <div className="space-y-2">
            {trades.map((t) => (
              <Link
                key={t.uri}
                to={t.localId ? `/trade/${t.localId}` : '/trades'}
                className="block rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center gap-2">
                  <Avatar name={t.authorName} src={t.authorAvatar} size={28} />
                  <span className="text-sm font-semibold">{t.authorName || 'Collector'}</span>
                  <ExternalIndicator did={t.authorDid} />
                  {t.status && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      t.status === 'open' ? 'bg-success/15 text-success' :
                      t.status === 'completed' ? 'bg-secondary text-muted-foreground' :
                      'bg-warning/15 text-warning'
                    }`}>{t.status}</span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground">Offering</p>
                    <p className="truncate">{t.offerCardNames?.join(', ') || '–'}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground">Wants</p>
                    <p className="truncate">{t.wantedCardNames?.join(', ') || '–'}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {collections.length > 0 && (type === 'all' || type === 'collections') && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Recent Collection Entries</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {collections.map((c) => (
              <Link
                key={c.uri}
                to={c.cardUri ? `/card/${c.cardUri}` : '/explore'}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                {c.imageUrl ? (
                  <img src={cardImageUrl(c.imageUrl)} alt={c.cardName} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                ) : (
                  <div className="aspect-[3/4] bg-secondary" />
                )}
                <div className="p-1.5">
                  <p className="truncate text-[10px] font-semibold">{c.cardName || 'Unknown'}</p>
                  <p className="truncate text-[9px] text-muted-foreground">{c.setName || ''}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}