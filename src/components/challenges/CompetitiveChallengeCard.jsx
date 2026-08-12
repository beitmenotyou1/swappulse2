import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Trophy, BadgeCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';

const CATEGORIES = ['helpful-trader', 'accuracy-champion', 'community-builder', 'set-completer', 'shiny-hunter', 'journal-writer', 'meetup-organiser'];

export default function CompetitiveChallengeCard({ challenge }) {
  const cfg = challenge.leaderboard_config || {};
  const cats = cfg.categories?.length ? cfg.categories : (challenge.category ? [challenge.category] : CATEGORIES);
  const [cat, setCat] = useState(cats[0]);
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    base44.functions.invoke('getLeaderboard', { challengeId: challenge.id, category: cat, limit: 50 })
      .then((res) => alive && setData(res.data))
      .catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [challenge.id, cat]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-accent">Competitive</span>
          <h2 className="text-lg font-extrabold leading-tight">{challenge.title}</h2>
        </div>
        <Trophy className="h-5 w-5 shrink-0 text-accent" />
      </div>
      {challenge.description && <p className="text-sm text-muted-foreground">{challenge.description}</p>}
      {cats.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${cat === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}>{c.replace(/-/g, ' ')}</button>
          ))}
        </div>
      )}
      {!data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Ranking opt-in participants…</div>
      ) : data.feed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No opt-in participants yet. Enable leaderboard visibility in Settings to appear here.</p>
      ) : (
        <ol className="space-y-1.5">
          {data.feed.map((r) => (
            <li key={r.userDid} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${r.rank <= 3 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{r.rank}</span>
              <span className="flex-1 truncate font-semibold">{r.displayName}</span>
              {r.verified && <BadgeCheck className="h-4 w-4 text-success" />}
              <span className="text-sm font-bold text-primary">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
      {data?.meta && <p className="text-xs text-muted-foreground">{data.meta.optInParticipants} visible · {data.meta.totalParticipants} total participants</p>}
    </Card>
  );
}