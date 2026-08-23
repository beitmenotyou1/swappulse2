import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Rss, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Renders a collector's pinned custom TCG feeds on their profile. Pinned
// feeds (FeedSubscription.pinned=true) are the feeds the collector chooses to
// showcase; tapping a card opens the Feeds page where a visitor can subscribe.
export default function ProfilePinnedFeeds({ did }) {
  const [feeds, setFeeds] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!did) { setFeeds([]); setLoading(false); return; }
    (async () => {
      try {
        const rows = await base44.entities.FeedSubscription.filter({ did, pinned: true }, '-created_date', 10).catch(() => []);
        if (active) setFeeds(rows);
      } catch {
        if (active) setFeeds([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [did]);

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!feeds || !feeds.length) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Rss className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Pinned Feeds</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {feeds.map((feed) => (
          <Link
            key={feed.id}
            to="/feeds"
            className="group rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-secondary"
          >
            <p className="truncate text-sm font-bold group-hover:text-primary">{feed.feed_name || 'Custom feed'}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{feed.feed_uri || ''}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}