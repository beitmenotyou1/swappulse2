import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function CollectiveChallengeCard({ challenge }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    base44.functions.invoke('getLeaderboard', { challengeId: challenge.id })
      .then((res) => alive && setData(res.data))
      .catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [challenge.id]);
  const p = data?.progress;
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-primary">Collective Goal</span>
          <h2 className="text-lg font-extrabold leading-tight">{challenge.title}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-success/15 px-2 py-1 text-xs font-semibold text-success">Shared Reward</span>
      </div>
      {challenge.description && <p className="text-sm text-muted-foreground">{challenge.description}</p>}
      {!p ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Tallying community progress…</div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm font-semibold">
            <span>{p.total} / {p.target} contributions</span>
            <span className="text-primary">{p.percent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.percent}%` }} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {p.contributors} collectors contributing</p>
          {data.challengeComplete && <p className="text-sm font-bold text-success">Goal reached — reward unlocked for all contributors!</p>}
        </div>
      )}
    </Card>
  );
}