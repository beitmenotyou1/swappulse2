import React, { useEffect, useState } from 'react';
import { Star, Loader2, Globe } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/format';

// ReputationSummary — displays a collector's trade reputation, merging local
// Reputation records with federated org.swappulse.tradingFeedback records pulled
// from the AT Protocol PDS via get-portable-reputation. Records that live on the
// PDS show a small globe badge, signalling they are portable across instances.
export default function ReputationSummary({ did }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!did) { setLoading(false); return; }
      try {
        const res = await base44.functions.invoke('get-portable-reputation', { did });
        setData(res.data);
      } catch { setData(null); }
      finally { setLoading(false); }
    })();
  }, [did]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || data.reviews.length === 0) return null;

  const { reviews, average, total, federated_count } = data;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const maxDist = Math.max(...dist.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Reputation</h3>
        {federated_count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-primary" title={`${federated_count} federated record${federated_count === 1 ? '' : 's'} on the AT Protocol`}>
            <Globe className="h-3.5 w-3.5" />
            {federated_count} portable
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-extrabold text-accent">{average}</p>
          <div className="flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(average) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
            ))}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{total} review{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 space-y-1">
          {dist.map((d) => (
            <div key={d.star} className="flex items-center gap-2">
              <span className="flex w-3 text-xs text-muted-foreground">{d.star}</span>
              <Star className="h-3 w-3 fill-accent text-accent" />
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-accent/60" style={{ width: `${(d.count / maxDist) * 100}%` }} />
              </div>
              <span className="w-4 text-right text-xs text-muted-foreground">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-3 border-t border-border pt-3">
        {reviews.slice(0, 5).map((r, i) => (
          <div key={r.at_uri || i} className="flex gap-2.5">
            <Avatar name={r.rater_name} size={32} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-sm font-semibold">
                  {r.rater_name || 'Collector'}
                  {r.federated && <Globe className="h-3 w-3 text-primary" title="Federated on the AT Protocol" />}
                </span>
                <span className="text-xs text-muted-foreground">{r.created_at ? timeAgo(r.created_at) : ''}</span>
              </div>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3 w-3 ${n <= r.rating ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
                ))}
              </div>
              {r.comment && <p className="mt-1 text-xs text-muted-foreground">{r.comment}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}