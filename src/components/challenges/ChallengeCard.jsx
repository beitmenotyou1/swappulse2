import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Trophy, Users, Globe, MapPin, Gift, Clock, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

function timeLeft(endIso) {
  if (!endIso) return '';
  const ms = new Date(endIso).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

const TYPE_STYLE = {
  collective: { label: 'Collective', cls: 'bg-primary/15 text-primary' },
  competitive: { label: 'Competitive', cls: 'bg-accent/15 text-accent-foreground' },
  guild: { label: 'Guild', cls: 'bg-teal-500/15 text-teal-500' },
};

export default function ChallengeCard({ challenge: c }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    base44.functions.invoke('getLeaderboard', { challengeId: c.id, limit: 1 })
      .then((r) => alive && setData(r.data))
      .catch(() => {});
    return () => { alive = false; };
  }, [c.id]);
  const style = TYPE_STYLE[c.mode] || TYPE_STYLE.collective;
  return (
    <Card className="overflow-hidden">
      <Link to={`/challenges/${c.id}`} className="block">
        <div className="relative h-28 w-full bg-gradient-to-br from-primary/30 to-accent/20">
          {c.image_url && <img src={c.image_url} alt={c.title} className="h-full w-full object-cover" loading="lazy" />}
          <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-xs font-bold ${style.cls}`}>{style.label}</span>
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs font-semibold text-white"><Clock className="h-3 w-3" />{timeLeft(c.ends_at)}</span>
        </div>
      </Link>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/challenges/${c.id}`}><h2 className="text-base font-extrabold leading-tight hover:text-primary">{c.title}</h2></Link>
          {c.reward?.type && <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold"><Gift className="h-3 w-3" />{c.reward.type}</span>}
        </div>
        {c.description && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">{c.scope === 'circle' ? <><MapPin className="h-3 w-3" />Circle</> : <><Globe className="h-3 w-3" />Global</>}</span>
          {c.mode === 'collective' && data?.progress ? (
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{data.progress.total}/{data.progress.target}</span>
          ) : c.mode !== 'collective' && data?.meta ? (
            <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{data.meta.optInParticipants} opt-in · {data.meta.totalParticipants} total</span>
          ) : <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
        {c.mode === 'collective' && data?.progress && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={data.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${data.progress.percent}% complete`}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.progress.percent}%` }} />
          </div>
        )}
      </div>
    </Card>
  );
}