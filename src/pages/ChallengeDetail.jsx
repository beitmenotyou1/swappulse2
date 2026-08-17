import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowLeft, Globe, MapPin, Gift, Clock, Target, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import SubmitEntryPanel from '@/components/challenges/SubmitEntryPanel';
import OptInPrompt from '@/components/challenges/OptInPrompt';
import { useAuth } from '@/lib/AuthContext';
import useSEO from '@/hooks/useSEO';

function timeLeft(endIso) {
  if (!endIso) return '';
  const ms = new Date(endIso).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export default function ChallengeDetail() {
  useSEO({
    title: 'Challenge',
    description: 'Join a Pokémon TCG collector challenge on SwapPulse — set completion races, pack contests, and community goals.',
    canonicalPath: `/challenges/${challengeId}`,
  });
  const { challengeId } = useParams();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [data, setData] = useState(null);
  const [myEntries, setMyEntries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.entities.Challenge.get(challengeId).then(setChallenge).catch((e) => setError(e?.message || 'Not found'));
    base44.functions.invoke('getLeaderboard', { challengeId, limit: 10 }).then((r) => setData(r.data)).catch(() => {});
    const did = user?.did || user?.id;
    if (did) base44.entities.ChallengeEntry.filter({ challenge_id: challengeId, participant_did: did }, '-submitted_at', 50).then(setMyEntries).catch(() => {});
  }, [challengeId, user]);

  if (error) return <div className="p-4"><PageHeader title="Challenge" /><p className="text-sm text-destructive">{error}</p></div>;
  if (!challenge) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const c = challenge;
  const myTotal = myEntries.filter((e) => e.status === 'approved').reduce((s, e) => s + (e.contribution_count || 0), 0);

  return (
    <div>
      <PageHeader title={c.title} subtitle={c.mode === 'collective' ? 'Collective community goal' : 'Competitive leaderboard challenge'}>
        <Link to="/challenges" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All</Link>
      </PageHeader>
      <div className="space-y-4 p-4">
        <Card className="overflow-hidden">
          <div className="relative h-40 w-full bg-gradient-to-br from-primary/30 to-accent/20">
            {c.image_url && <img src={c.image_url} alt={c.title} className="h-full w-full object-cover" />}
          </div>
          <div className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-bold capitalize ${c.mode === 'collective' ? 'bg-primary/15 text-primary' : 'bg-accent/15 text-accent-foreground'}`}>{c.mode}</span>
              <span className="flex items-center gap-1">{c.scope === 'circle' ? <><MapPin className="h-3 w-3" />Circle</> : <><Globe className="h-3 w-3" />Global</>}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeLeft(c.ends_at)}</span>
              {c.reward?.type && <span className="flex items-center gap-1"><Gift className="h-3 w-3" />{c.reward.type}{c.reward.shared ? ' (shared)' : ''}</span>}
            </div>
            {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          {c.mode === 'collective' && data?.progress ? (
            <>
              <p className="text-sm font-semibold">Community progress</p>
              <div className="h-4 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={data.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Community progress">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.progress.percent}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div><p className="font-bold">{data.progress.contributors}</p><p className="text-xs text-muted-foreground">Contributors</p></div>
                <div><p className="font-bold">{data.progress.total}/{data.progress.target}</p><p className="text-xs text-muted-foreground">Contributions</p></div>
                <div><p className="font-bold">{data.progress.percent}%</p><p className="text-xs text-muted-foreground">Complete</p></div>
              </div>
              <p className="text-sm text-muted-foreground">You've contributed <span className="font-bold text-foreground">{myTotal}</span> {c.goal?.metric?.replace(/_/g, ' ') || 'items'}.</p>
            </>
          ) : c.mode !== 'collective' && data ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Leaderboard preview</p>
                <Link to={`/challenges/${c.id}/leaderboard`} className="text-sm font-semibold text-primary hover:underline">View full →</Link>
              </div>
              {data.feed.length === 0 ? <p className="text-sm text-muted-foreground">No opt-in participants yet.</p> : (
                <ol className="space-y-1.5">
                  {data.feed.slice(0, 10).map((r) => (
                    <li key={r.userDid} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-bold">{r.rank}</span>
                      <span className="flex-1 truncate font-semibold">{r.displayName}</span>
                      {r.verified && <ShieldCheck className="h-4 w-4 text-success" />}
                      <span className="font-bold text-primary">{r.score}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-xs text-muted-foreground">{data.meta.optInParticipants} opt-in · {data.meta.totalParticipants} total · You: {myTotal > 0 ? `${myTotal} contributed` : 'not ranked'}</p>
              <OptInPrompt />
            </>
          ) : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>}
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold">Rules</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p><Target className="mr-1 inline h-3.5 w-3.5" />Goal: <span className="font-medium text-foreground">{c.goal?.target} {c.goal?.metric?.replace(/_/g, ' ')}</span></p>
            {c.goal?.filters && Object.keys(c.goal.filters).length > 0 && (
              <p>Filters: {[
                c.goal.filters.min_rarity && `min rarity ${c.goal.filters.min_rarity}`,
                c.goal.filters.element_types?.length && `types ${c.goal.filters.element_types.join('/')}`,
                c.goal.filters.condition_min && `min condition ${c.goal.filters.condition_min}`,
                c.goal.filters.exclude_duplicates && 'no duplicates',
              ].filter(Boolean).join(' · ')}</p>
            )}
            <p><Gift className="mr-1 inline h-3.5 w-3.5" />Reward: {c.reward?.type} {c.reward?.shared ? '(all contributors)' : '(top rankers)'}</p>
          </div>
        </Card>

        <SubmitEntryPanel challenge={c} />

        {myEntries.length > 0 && (
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold">Your recent contributions</p>
            {myEntries.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="capitalize">{e.status}</span>
                <span className="text-muted-foreground">{e.contribution_count} counted · {new Date(e.submitted_at).toLocaleDateString()}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}