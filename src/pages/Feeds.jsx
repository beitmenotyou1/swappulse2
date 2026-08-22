import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, Rss } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/PageHeader';
import FeedCard from '@/components/feeds/FeedCard';
import useSEO from '@/hooks/useSEO';
import { useAuth } from '@/lib/AuthContext';

// A curated set of community feed generator URIs. In production these are
// discovered via the AppView; here we list known SwapPulse-native feeds plus
// popular Bluesky TCG feeds so the marketplace is populated on day one.
const SEED_FEEDS = [
  { uri: 'at://did:plc:swappulse/app.bsky.feed.generator/holo-pulls', displayName: 'Holo Pulls Only', description: 'Pack-opening posts with holo or better rarity.', niche: 'holo' },
  { uri: 'at://did:plc:swappulse/app.bsky.feed.generator/trusted-traders', displayName: 'Trusted Trader Posts', description: 'Posts from collectors with Trusted Trader status.', niche: 'trust' },
  { uri: 'at://did:plc:swappulse/app.bsky.feed.generator/set-completions', displayName: 'Set Completions', description: 'Celebrations of completed sets.', niche: 'completion' },
  { uri: 'at://did:plc:swappulse/app.bsky.feed.generator/budget-cards', displayName: 'Cards Under $20', description: 'Affordable gems and budget finds.', niche: 'budget' },
  { uri: 'at://did:plc:swappulse/app.bsky.feed.generator/vintage-wotc', displayName: 'Vintage WOTC', description: 'Classic era cards and discussion.', niche: 'vintage' },
  { uri: 'at://did:plc:swappulse/app.bsky.feed.generator/japanese-exclusive', displayName: 'Japanese Exclusive', description: 'JP-only releases and imports.', niche: 'japanese' },
];

const NICHES = ['all', 'holo', 'trust', 'completion', 'budget', 'vintage', 'japanese'];

export default function Feeds() {
  useSEO({
    title: 'Feeds',
    description: 'Browse and pin community algorithm feeds for every Pokémon TCG niche on SwapPulse.',
    canonicalPath: '/feeds',
  });
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [niche, setNiche] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const subs = await base44.entities.FeedSubscription.filter({}, '-created_date', 100);
        const map = {};
        (subs || []).forEach((s) => { map[s.feed_uri] = s; });
        setSubscriptions(map);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const onToggle = (feed, nowSubscribed, created) => {
    setSubscriptions((prev) => {
      const next = { ...prev };
      if (nowSubscribed) next[feed.uri] = created;
      else delete next[feed.uri];
      return next;
    });
  };

  const feeds = niche === 'all' ? SEED_FEEDS : SEED_FEEDS.filter((f) => f.niche === niche);

  return (
    <div>
      <PageHeader title="Feeds" subtitle="Community algorithm feeds. Subscribe and pin to shape your home timeline." />
      <div className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-8">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {NICHES.map((n) => (
            <button
              key={n}
              onClick={() => setNiche(n)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${niche === n ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
            >
              {n}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {feeds.map((f) => (
              <FeedCard key={f.uri} feed={f} subscribed={subscriptions[f.uri]} onToggle={onToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}