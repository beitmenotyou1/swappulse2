import React, { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import EpisodeCard from '@/components/podcast/EpisodeCard';

// §Alpha 1.4 — profile Podcasts tab. Lists org.swappulse.podcastEpisode
// records authored by the profile owner (passed `did`), sorted by
// publishedAt descending, using the global podcast player.
export default function PodcastsTab({ did: ownerDid }) {
  const [eps, setEps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let did = ownerDid;
        if (!did) { const r = await ensureUserDid(); did = r.did; }
        const all = await base44.entities.PodcastEpisode.list('-published_at', 100);
        setEps(all.filter((e) => e.did === did));
      } catch {
        setEps([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerDid]);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading podcasts…</div>;
  if (eps.length === 0) {
    return (
      <div className="p-8 text-center">
        <Mic className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold">No podcasts yet</p>
        <p className="text-xs text-muted-foreground">Record a Voice Space to publish your first episode.</p>
      </div>
    );
  }
  return <div className="space-y-2 p-4">{eps.map((e) => <EpisodeCard key={e.id} episode={e} />)}</div>;
}