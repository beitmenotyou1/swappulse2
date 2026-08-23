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
import { useT } from '@/lib/i18n/I18nProvider';

function timeLeft(endIso, t) {
  if (!endIso) return '';
  const ms = new Date(endIso).getTime() - Date.now();
  if (ms <= 0) return t('challenge.ended');
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return t('challenge.timeLeftDays').replace('{d}', d).replace('{h}', h);
  if (h > 0) return t('challenge.timeLeftHours').replace('{h}', h).replace('{m}', m);
  return t('challenge.timeLeftMinutes').replace('{m}', m);
}

export default function ChallengeDetail() {
  const t = useT();
  const { challengeId } = useParams();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState(null);
  useSEO({
    title: challenge?.title || 'Pokémon TCG Collector Challenge',
    description: 'Join a Pokémon TCG collector challenge on SwapPulse, set completion races, pack contests, and community goals.',
    canonicalPath: `/challenges/${challengeId}`,
  });
  const [data, setData] = useState(null);
  const [myEntries, setMyEntries] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.entities.Challenge.get(challengeId).then(setChallenge).catch((e) => setError(e?.message || t('challenge.notFound')));
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
      <PageHeader title={c.title} subtitle={c.mode === 'collective' ? t('challenge.collectiveGoal') : t('challenge.competitiveChallenge')}>
        <Link to="/challenges" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t('challenge.all')}</Link>
      </PageHeader>
      <div className="space-y-4 p-4">
        <Card className="overflow-hidden">
          <div className="relative h-40 w-full bg-gradient-to-br from-primary/30 to-accent/20">
            {c.image_url && <img src={c.image_url} alt={c.title} className="h-full w-full object-cover" />}
          </div>
          <div className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-bold capitalize ${c.mode === 'collective' ? 'bg-primary/15 text-primary' : 'bg-accent/15 text-accent-foreground'}`}>{c.mode}</span>
              <span className="flex items-center gap-1">{c.scope === 'circle' ? <><MapPin className="h-3 w-3" />{t('challenge.circle')}</> : <><Globe className="h-3 w-3" />{t('challenge.global')}</>}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeLeft(c.ends_at, t)}</span>
              {c.reward?.type && <span className="flex items-center gap-1"><Gift className="h-3 w-3" />{c.reward.type}{c.reward.shared ? ` ${t('challenge.allContributors')}` : ''}</span>}
            </div>
            {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          {c.mode === 'collective' && data?.progress ? (
            <>
              <p className="text-sm font-semibold">{t('challenge.communityProgress')}</p>
              <div className="h-4 w-full overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={data.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t('challenge.communityProgress')}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.progress.percent}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div><p className="font-bold">{data.progress.contributors}</p><p className="text-xs text-muted-foreground">{t('challenge.contributors')}</p></div>
                <div><p className="font-bold">{data.progress.total}/{data.progress.target}</p><p className="text-xs text-muted-foreground">{t('challenge.contributions')}</p></div>
                <div><p className="font-bold">{data.progress.percent}%</p><p className="text-xs text-muted-foreground">{t('challenge.complete')}</p></div>
              </div>
              <p className="text-sm text-muted-foreground">{t('challenge.youContributed')} <span className="font-bold text-foreground">{myTotal}</span> {c.goal?.metric?.replace(/_/g, ' ') || t('challenge.items')}.</p>
            </>
          ) : c.mode !== 'collective' && data ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t('challenge.leaderboardPreview')}</p>
                <Link to={`/challenges/${c.id}/leaderboard`} className="text-sm font-semibold text-primary hover:underline">{t('challenge.viewFull')}</Link>
              </div>
              {data.feed.length === 0 ? <p className="text-sm text-muted-foreground">{t('challenge.noParticipants')}</p> : (
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
              <p className="text-xs text-muted-foreground">{t('challenge.optInCount').replace('{count}', data.meta.optInParticipants)} · {t('challenge.totalCount').replace('{count}', data.meta.totalParticipants)} · {t('challenge.youLabel')}: {myTotal > 0 ? t('challenge.contributed').replace('{count}', myTotal) : t('challenge.notRanked')}</p>
              <OptInPrompt />
            </>
          ) : <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('common.loading')}</div>}
        </Card>

        <Card className="space-y-2 p-4">
          <p className="text-sm font-semibold">{t('challenge.rules')}</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p><Target className="mr-1 inline h-3.5 w-3.5" />{t('challenge.goal')}: <span className="font-medium text-foreground">{c.goal?.target} {c.goal?.metric?.replace(/_/g, ' ')}</span></p>
            {c.goal?.filters && Object.keys(c.goal.filters).length > 0 && (
              <p>{t('challenge.filters')}: {[
                c.goal.filters.min_rarity && `min rarity ${c.goal.filters.min_rarity}`,
                c.goal.filters.element_types?.length && `types ${c.goal.filters.element_types.join('/')}`,
                c.goal.filters.condition_min && `min condition ${c.goal.filters.condition_min}`,
                c.goal.filters.exclude_duplicates && 'no duplicates',
              ].filter(Boolean).join(' · ')}</p>
            )}
            <p><Gift className="mr-1 inline h-3.5 w-3.5" />{t('challenge.reward')}: {c.reward?.type} {c.reward?.shared ? t('challenge.allContributors') : t('challenge.topRankers')}</p>
          </div>
        </Card>

        <SubmitEntryPanel challenge={c} />

        {myEntries.length > 0 && (
          <Card className="space-y-2 p-4">
            <p className="text-sm font-semibold">{t('challenge.yourContributions')}</p>
            {myEntries.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="capitalize">{e.status}</span>
                <span className="text-muted-foreground">{e.contribution_count} {t('challenge.counted')} · {new Date(e.submitted_at).toLocaleDateString()}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}