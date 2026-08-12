import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowLeft, Trophy, ShieldCheck, Lock } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Card } from '@/components/ui/card';

export default function Leaderboard() {
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
      <PageHeader title="Leaderboard" subtitle={challenge.title}>
        <Link to={`/challenges/${challengeId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Challenge</Link>
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
            : data.feed.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground"><Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />No one has opted into this leaderboard yet. Be the first?</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-2 text-left">Rank</th>
                    <th scope="col" className="p-2 text-left">Collector</th>
                    <th scope="col" className="p-2 text-right">Score</th>
                    <th scope="col" className="p-2 text-right">Entries</th>
                    <th scope="col" className="p-2 text-center">Verified</th>
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
            <p>{data.meta.optInParticipants} visible · {data.meta.totalParticipants} total participants</p>
            <p className="flex items-center gap-1"><Lock className="h-3 w-3" />Some collectors have chosen not to appear. Respect their choice.</p>
          </div>
        )}
      </div>
    </div>
  );
}