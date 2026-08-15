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
import PushOnboardingPrompt from '@/components/onboarding/PushOnboardingPrompt';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const TABS = [
  { key: 'all', label: 'For You' },
  { key: 'pack_opening', label: 'Fresh Pulls' },
  { key: 'trade', label: 'Trade Floor' },
  { key: 'showcase', label: 'Showcase' },
];

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [reactionsMap, setReactionsMap] = useState({});
  const [repostMap, setRepostMap] = useState({});
  const [likeMap, setLikeMap] = useState({});
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('swappulse_onboarding_done'));
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const { user } = useAuth();

  const completeTour = () => {
    setShowTour(false);
    if (!localStorage.getItem('swappulse_push_prompted')) setShowPushPrompt(true);
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const authed = await base44.auth.isAuthenticated();
      if (authed) {
        const res = await base44.functions.invoke('get-follow-feed', { limit: 50 });
        setPosts(res.data?.items || []);
      } else {
        setPosts([]);
      }
    } catch {
      setPosts([]);
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

  // Batch-fetch the current user's likes for loaded posts (avoids an N+1 call per card).
  useEffect(() => {
    if (!user?.id || !posts.length) { setLikeMap({}); return; }
    (async () => {
      try {
        const rows = await base44.entities.Like.filter(
          { created_by_id: user.id, post_id: { $in: posts.map((p) => p.id) } },
          '-created_date',
          50
        );
        const map = {};
        for (const l of rows) { map[l.post_id] = l; }
        setLikeMap(map);
      } catch {
        setLikeMap({});
      }
    })();
  }, [posts, user?.id]);

  const filtered = tab === 'all' ? posts : posts.filter((p) => p.post_type === tab);

  if (showTour) {
    return <OnboardingTour onComplete={completeTour} />;
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
          <p className="text-lg font-bold">Your feed is quiet</p>
          <p className="mt-1 text-sm text-muted-foreground">Follow some collectors to fill your feed.</p>
          <Link to="/explore" className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Discover collectors</Link>
        </div>
      ) : (
        <div className="animate-fade-in">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} reactions={reactionsMap[post.id]} myRepost={repostMap[post.id]} myLike={likeMap[post.id]} />
          ))}
        </div>
      )}
      <PushOnboardingPrompt open={showPushPrompt} onClose={() => setShowPushPrompt(false)} />
    </div>
  );
}