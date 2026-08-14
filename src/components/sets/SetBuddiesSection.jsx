import React, { useEffect, useState } from 'react';
import { Users, Loader2, ArrowLeftRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';

// SetBuddiesSection — shows other collectors working on the same set, their
// completion progress, and swap overlap (cards they have that I need and vice
// versa) so collectors can coordinate set completion cooperatively.
export default function SetBuddiesSection({ setId, myCardIds = [], setName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!setId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('get-set-buddies', {
          set_id: setId,
          my_card_ids: myCardIds,
        });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setId, myCardIds.join(',')]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> Set Buddies</h3>
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!data || data.buddies.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> Set Buddies</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          No other collectors are tracking {setName || 'this set'} yet. Invite a friend to co-op!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-primary" /> Set Buddies</h3>
        <span className="text-xs text-muted-foreground">{data.total_collectors} collector{data.total_collectors !== 1 ? 's' : ''}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Collectors completing {setName || 'this set'} — swap to finish together.
      </p>
      <div className="mt-3 space-y-3">
        {data.buddies.map((b) => (
          <div key={b.user_id} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
            <Avatar name={b.name} src={b.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{b.name}</span>
                {b.swap_potential > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    <ArrowLeftRight className="h-2.5 w-2.5" /> {b.swap_potential}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, b.owned_count * 2)}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground">{b.owned_count} cards</span>
              </div>
              {b.they_have_i_need.length > 0 && (
                <p className="mt-1 text-[10px] text-success">
                  Has {b.they_have_i_need.length} you need
                </p>
              )}
              {b.i_have_they_need.length > 0 && (
                <p className="text-[10px] text-accent">
                  You have {b.i_have_they_need.length} they need
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}