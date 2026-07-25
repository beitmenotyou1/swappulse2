import React, { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PodcastPlayer from '@/components/spaces/PodcastPlayer';
import { ensureUserDid } from '@/lib/atproto';

export default function PodcastsTab() {
  const [eps, setEps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { did } = await ensureUserDid();
        const all = await base44.entities.PodcastEpisode.list('-published_at', 50);
        setEps(all.filter((e) => e.did === did));
      } catch {
        setEps([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading podcasts…</div>;
  if (eps.length === 0) {
    return (
      <div className="p-8 text-center">
        <Disc3 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold">No podcasts yet</p>
        <p className="text-xs text-muted-foreground">Record a Voice Space to publish your first episode.</p>
      </div>
    );
  }
  return <div className="space-y-3 p-4">{eps.map((e) => <PodcastPlayer key={e.id} episode={e} />)}</div>;
}