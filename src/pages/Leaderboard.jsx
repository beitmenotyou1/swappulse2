import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowLeft, Trophy, ShieldCheck, Lock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';
import { useT } from '@/lib/i18n/I18nProvider';

export default function Leaderboard() {
  const t = useT();
  const { challengeId } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [cat, setCat] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => { base44.entities.Challenge.get(challengeId).then(setChallenge).catch(() => {}); }, [challengeId]);
  useEffect(() => {
    if (!challenge || cat) return;
    const cats = challenge.leaderboard_config?.categories?.length ? challenge.leaderboard_config.categories : (challenge.category ? [challenge.category] : []);
    if (cats.length) setCat(cats[0]);
  }, [challenge, cat]);
  useEffect(() => {
    if (!cat) return;
    base44.functions.invoke('getLeaderboard', { challengeId, category: cat, limit: 100 })
      .then((r) => setData(r.data)).catch(() => {});
  }, [challengeId, cat]);

  if (!challenge) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const cats = challenge.leaderboard_config?.categories?.length ? challenge.leaderboard_config.categories : (challenge.category ? [challenge.category] : []);

  return (
    <div>
      <PageHeader title={t('page.leaderboard.title')} subtitle={challenge.title}>
        <Link to={`/challenges/${challengeId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t('page.leaderboard.challenge')}</Link>
      </PageHeader>
      <div className="space-y-3 p-4">
        {cats.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${cat === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{c.replace(/-/g, ' ')}</button>
            ))}
          </div>
        )}
        <Card className="overflow-hidden p-0">
          {!data ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            : data.feed.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground"><Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />{t('page.leaderboard.empty')}</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-2 text-left">{t('page.leaderboard.rank')}</th>
                    <th scope="col" className="p-2 text-left">{t('page.leaderboard.collector')}</th>
                    <th scope="col" className="p-2 text-right">{t('page.leaderboard.score')}</th>
                    <th scope="col" className="p-2 text-right">{t('page.leaderboard.entries')}</th>
                    <th scope="col" className="p-2 text-center">{t('page.leaderboard.verified')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.feed.map((r) => (
                    <tr key={r.userDid} className="border-t border-border">
                      <td className="p-2 font-bold">{r.rank <= 3 ? <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs">{r.rank}</span> : r.rank}</td>
                      <td className="p-2 font-semibold">{r.displayName}</td>
                      <td className="p-2 text-right font-bold text-primary">{r.score}</td>
                      <td className="p-2 text-right text-muted-foreground">{r.entriesCount}</td>
                      <td className="p-2 text-center">{r.verified && <ShieldCheck className="mx-auto h-4 w-4 text-success" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
        {data?.meta && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{t('page.leaderboard.stats').replace('{visible}', data.meta.optInParticipants).replace('{total}', data.meta.totalParticipants)}</p>
            <p className="flex items-center gap-1"><Lock className="h-3 w-3" />{t('page.leaderboard.privacyNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
}