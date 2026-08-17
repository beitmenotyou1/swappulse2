import React, { useEffect, useState } from 'react';
import { Mic, Rss } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ensureUserDid } from '@/lib/atproto';
import EpisodeCard from '@/components/podcast/EpisodeCard';
import PastStreamsSection from '@/components/profile/PastStreamsSection';

// §Alpha 1.4 - profile Podcasts tab. Lists org.swappulse.podcastEpisode
// records authored by the profile owner (passed `did`), sorted by
// publishedAt descending, using the global podcast player. Below the
// episode list, a "Past Streams" section surfaces ended streams that can
// be repurposed into new episodes.
export default function PodcastsTab({ did: ownerDid }) {
  const { user } = useAuth();
  const [eps, setEps] = useState([]);
  const [did, setDid] = useState(ownerDid || '');
  const [loading, setLoading] = useState(true);
  const isOwner = !ownerDid || user?.did === ownerDid;

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
        <>
          {isOwner && eps.length > 0 && (
            <div className="flex justify-end px-4 pt-3">
              <a
                href={`${window.location.origin}/api/functions/podcast-rss-feed?did=${encodeURIComponent(did)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold hover:border-primary"
              >
                <Rss className="h-3.5 w-3.5" /> Your RSS feed
              </a>
            </div>
          )}
          <div className="space-y-2 p-4">{eps.map((e) => <EpisodeCard key={e.id} episode={e} canEdit={isOwner} onSaved={() => loadEps(did)} />)}</div>
        </>
      )}
      <PastStreamsSection did={did} onEpisodePublished={() => loadEps(did)} />
    </div>
  );
}