import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ComposeBox from '@/components/feed/ComposeBox';
import PostCard from '@/components/feed/PostCard';
import TradeInterestBanner from '@/components/feed/TradeInterestBanner';
import CardOfTheDay from '@/components/home/CardOfTheDay';
import StoriesBar from '@/components/stories/StoriesBar';
import SpaceBar from '@/components/spaces/SpaceBar';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import { useAuth } from '@/lib/AuthContext';

const TABS = [
  { key: 'all', label: 'For You' },
  { key: 'pack_opening', label: 'Fresh Pulls' },
  { key: 'trade', label: 'Trade Floor' },
  { key: 'showcase', label: 'Showcase' },
];

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [externalPosts, setExternalPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [reactionsMap, setReactionsMap] = useState({});
  const [repostMap, setRepostMap] = useState({});
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('swappulse_onboarding_done'));
  const { user } = useAuth();

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Post.list('-created_date', 50);
      setPosts(data);
      // Fetch external posts for authenticated users (federation follows)
      try {
        const authed = await base44.auth.isAuthenticated();
        if (authed) {
          const extRes = await base44.functions.invoke('fetch-external-feed', { limit: 30 });
          setExternalPosts(extRes.data?.items || []);
        }
      } catch {
        setExternalPosts([]);
      }
    } catch {
      setPosts([]);
      setExternalPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // §9.1 live feed: prepend new posts / fresh pulls as they arrive.
  const prepend = useCallback((post) => {
    setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
  }, []);
  useRealtimeEvent('feed.new_post', prepend);
  useRealtimeEvent('feed.new_pull', prepend);

  // §2.5 fetch aggregated reactions for the loaded posts.
  useEffect(() => {
    if (!posts.length) {
      setReactionsMap({});
      return;
    }
    (async () => {
      try {
        const isAuthed = await base44.auth.isAuthenticated();
        if (!isAuthed) { setReactionsMap({}); return; }
        const res = await base44.functions.invoke('getReactions', { postIds: posts.map((p) => p.id) });
        setReactionsMap(res.data?.reactions || {});
      } catch {
        setReactionsMap({});
      }
    })();
  }, [posts]);

  // Batch-fetch the current user's reposts for loaded posts (avoids an N+1 call per card).
  useEffect(() => {
    if (!user?.id || !posts.length) { setRepostMap({}); return; }
    (async () => {
      try {
        const rows = await base44.entities.Repost.filter(
          { created_by_id: user.id, post_id: { $in: posts.map((p) => p.id) } },
          '-created_date',
          50
        );
        const map = {};
        for (const r of rows) { map[r.post_id] = r; }
        setRepostMap(map);
      } catch {
        setRepostMap({});
      }
    })();
  }, [posts, user?.id]);

  const filtered = tab === 'all'
    ? [...posts, ...externalPosts].sort((a, b) =>
        new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime())
    : posts.filter((p) => p.post_type === tab);

  if (showTour) {
    return <OnboardingTour onComplete={() => setShowTour(false)} />;
  }

  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center px-2" role="tablist" aria-label="Feed filters">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`relative flex-1 px-4 py-3.5 text-sm font-semibold transition-colors ${
                tab === t.key ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <StoriesBar />

      <SpaceBar />

      <CardOfTheDay />

      <ComposeBox onPosted={loadPosts} />

      <TradeInterestBanner />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-20 text-center">
          <p className="text-lg font-bold">No posts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Share a pull or start a trade to get the feed going.</p>
        </div>
      ) : (
        <div className="animate-fade-in">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} reactions={reactionsMap[post.id]} myRepost={repostMap[post.id]} />
          ))}
        </div>
      )}
    </div>
  );
}