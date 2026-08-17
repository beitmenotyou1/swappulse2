import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Loader2, LineChart } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PollCard from '@/components/predictions/PollCard';
import CreatePollModal from '@/components/predictions/CreatePollModal';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import useSEO from '@/hooks/useSEO';

const TABS = [
  ['active', 'Active'],
  ['closed', 'Resolved'],
  ['all', 'All'],
];

export default function Predictions() {
  useSEO({
    title: 'Predictions',
    description: 'Vote on community sentiment polls and Pokémon TCG market predictions on SwapPulse.',
    canonicalPath: '/predictions',
  });
  const { user } = useAuth();
  const [polls, setPolls] = useState([]);
  const [myVotes, setMyVotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, votes] = await Promise.all([
        base44.entities.SentimentPoll.list('-created_date', 50),
        user?.did
          ? base44.entities.SentimentVote.filter({ did: user.did }, '-created_date', 200)
          : Promise.resolve([]),
      ]);
      setPolls(all);
      const map = {};
      for (const v of votes) map[v.poll_id] = { vote: v.vote, id: v.id };
      setMyVotes(map);
    } catch {
      setPolls([]);
      setMyVotes({});
    } finally {
      setLoading(false);
    }
  }, [user?.did]);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const visible = polls.filter((p) => {
    const closed = new Date(p.expires_at).getTime() <= now;
    if (tab === 'active') return !p.outcome && !closed;
    if (tab === 'closed') return p.outcome || closed;
    return true;
  });

  return (
    <div>
      <PageHeader title="Market Predictions" subtitle="Poll the community on where card prices are heading">
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New poll
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-8">
        <div className="mb-4 flex gap-2 text-sm font-semibold">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-3 py-1.5 transition ${
                tab === k ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <LineChart className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === 'active' ? 'No active polls. Create the first market prediction.' : 'Nothing here yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((p) => (
              <PollCard
                key={p.id}
                poll={p}
                myVote={myVotes[p.id]?.vote}
                myVoteId={myVotes[p.id]?.id}
                user={user}
              />
            ))}
          </div>
        )}
      </div>

      <CreatePollModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />
    </div>
  );
}