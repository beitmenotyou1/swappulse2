import React, { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import EpisodeCard from '@/components/podcast/EpisodeCard';
import PastStreamsSection from '@/components/profile/PastStreamsSection';

// §Alpha 1.4 - profile Podcasts tab. Lists org.swappulse.podcastEpisode
// records authored by the profile owner (passed `did`), sorted by
// publishedAt descending, using the global podcast player. Below the
// episode list, a "Past Streams" section surfaces ended streams that can
// be repurposed into new episodes.
export default function PodcastsTab({ did: ownerDid }) {
  const [eps, setEps] = useState([]);
  const [did, setDid] = useState(ownerDid || '');
  const [loading, setLoading] = useState(true);

  const loadEps = async (d) => {
    try {
      const all = await base44.entities.PodcastEpisode.filter({ did: d }, '-published_at', 100);
      setEps(all);
    } catch {
      setEps([]);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        let d = ownerDid;
        if (!d) { const r = await ensureUserDid(); d = r.did; }
        setDid(d);
        await loadEps(d);
      } catch {
        setEps([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerDid]);

  return (
    <div>
      {loading ? (
        <div className="p-4 text-sm text-muted-foreground">Loading podcasts…</div>
      ) : eps.length === 0 ? (
        <div className="p-8 text-center">
          <Mic className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">No podcasts yet</p>
          <p className="text-xs text-muted-foreground">Save a past stream as a podcast to publish your first episode.</p>
        </div>
      ) : (
        <div className="space-y-2 p-4">{eps.map((e) => <EpisodeCard key={e.id} episode={e} />)}</div>
      )}
      <PastStreamsSection did={did} onEpisodePublished={() => loadEps(did)} />
    </div>
  );
}