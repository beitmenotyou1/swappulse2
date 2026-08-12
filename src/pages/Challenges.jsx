import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Target } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import CollectiveChallengeCard from '@/components/challenges/CollectiveChallengeCard';
import CompetitiveChallengeCard from '@/components/challenges/CompetitiveChallengeCard';

export default function Challenges() {
  const [challenges, setChallenges] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.entities.Challenge.list('-starts_at', 50)
      .then(setChallenges)
      .catch((e) => setError(e?.message || 'Failed to load'));
  }, []);

  return (
    <div>
      <PageHeader title="Challenges" subtitle="Cooperative community goals & opt-in leaderboards" />
      <div className="p-4 space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!challenges && !error && (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}
        {challenges && challenges.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <Target className="mx-auto mb-2 h-10 w-10 opacity-50" />
            <p>No active challenges right now. Check back soon.</p>
          </div>
        )}
        {challenges?.map((c) =>
          c.mode === 'collective' ? (
            <CollectiveChallengeCard key={c.id} challenge={c} />
          ) : (
            <CompetitiveChallengeCard key={c.id} challenge={c} />
          )
        )}
      </div>
    </div>
  );
}