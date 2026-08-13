import React, { useEffect, useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/format';

export default function ReputationSummary({ did }) {
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!did) { setLoading(false); return; }
      try {
        setReps(await base44.entities.Reputation.filter({ did }, '-created_date', 20));
      } catch { setReps([]); }
      finally { setLoading(false); }
    })();
  }, [did]);

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (reps.length === 0) return null;

  const avg = (reps.reduce((s, r) => s + (r.rating || 0), 0) / reps.length).toFixed(1);
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reps.filter((r) => r.rating === star).length,
  }));
  const maxDist = Math.max(...dist.map((d) => d.count), 1);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold">Reputation</h3>
      <div className="mt-3 flex items-center gap-4">
        <div className="text-center">
          <p className="text-3xl font-extrabold text-accent">{avg}</p>
          <div className="flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(parseFloat(avg)) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`} />
            ))}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{reps.length} review{reps.length !== 1 ? 's' : ''}</p>
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
        {reps.slice(0, 5).map((r) => (
          <div key={r.id} className="flex gap-2.5">
            <Avatar name={r.rater_name} size={32} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{r.rater_name || 'Collector'}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(r.created_date)}</span>
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