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
import { usePostVisibility } from '@/hooks/usePostVisibility';
import useSEO from '@/hooks/useSEO';
import TrendingCardsRail from '@/components/cards/TrendingCardsRail';
import RarityFilter from '@/components/feed/RarityFilter';
import { useT } from '@/lib/i18n/I18nProvider';

const ALL_TABS = [
  { key: 'all', tKey: 'feed.forYou' },
  { key: 'pack_opening', tKey: 'feed.freshPulls' },
  { key: 'trade', tKey: 'feed.tradeFloor' },
  { key: 'showcase', tKey: 'feed.showcase' },
];

export default function Home() {
  useSEO({
    title: 'Home Feed',
    description: 'Discover fresh pack pulls, trades, and showcases from the SwapPulse Pokémon TCG collector community.',
    canonicalPath: '/',
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'SwapPulse', url: 'https://swappulse.org' },
  });
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [reactionsMap, setReactionsMap] = useState({});
  const [repostMap, setRepostMap] = useState({});
  const [likeMap, setLikeMap] = useState({});
  const [showTour, setShowTour] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [followedCount, setFollowedCount] = useState(0);
  const { user } = useAuth();
  const { filterPosts } = usePostVisibility();
  const tr = useT();
  // "For You" is only for logged-in users — it's populated by followed collectors.
  // Guests see the three community feeds (Fresh Pulls, Trade Floor, Showcase).
  const TABS = user ? ALL_TABS : ALL_TABS.filter((t) => t.key !== 'all');

  // Only show the onboarding tour to authenticated users who haven't seen it.
  // Guests should see the platform content, not a full-screen tour modal.
  useEffect(() => {
    if (user && !localStorage.getItem('swappulse_onboarding_done')) setShowTour(true);
  }, [user]);

  // Guests can't see "For You" — default them to Fresh Pulls
  useEffect(() => {
    if (!user && tab === 'all') setTab('pack_opening');
  }, [user, tab]);

  const completeTour = () => {
    setShowTour(false);
    if (!localStorage.getItem('swappulse_push_prompted')) setShowPushPrompt(true);
  };

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'all' && user) {
        // "For You" — followed collectors' posts (logged-in only)
        const res = await base44.functions.invoke('get-follow-feed', { limit: 50 });
        setPosts(res.data?.items || []);
        setFollowedCount(res.data?.followed_count ?? 0);
      } else {
        // Community feeds — all recent public posts, filtered by post_type
        const recent = await base44.entities.Post.list('-created_date', 50).catch(() => []);
        setPosts(recent || []);
        setFollowedCount(0);
      }
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [tab, user]);

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

  const visiblePosts = filterPosts(posts);
  const filtered = tab === 'all' ? visiblePosts : visiblePosts.filter((p) => p.post_type === tab);
  const rarityFiltered = rarityFilter === 'all' ? filtered : filtered.filter((p) => {
    if (!p.card_rarity) return false;
    const r = p.card_rarity.toLowerCase();
    if (rarityFilter === 'holo') return r.includes('holo');
    if (rarityFilter === 'ultra') return r.includes('ultra rare');
    if (rarityFilter === 'secret') return r.includes('secret');
    return true;
  });

  if (showTour) {
    return <OnboardingTour onComplete={completeTour} />;
  }

  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center px-2" role="tablist" aria-label="Feed filters">
          {TABS.map((tabItem) => (
            <button
              key={tabItem.key}
              role="tab"
              aria-selected={tab === tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`relative flex-1 px-4 py-3.5 text-sm font-semibold transition-colors ${
                tab === tabItem.key ? 'text-foreground' : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tr(tabItem.tKey)}
              {tab === tabItem.key && (
                <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <RarityFilter value={rarityFilter} onChange={setRarityFilter} />

      <StoriesBar />

      <SpaceBar />

      <CardOfTheDay />

      <TrendingCardsRail />

      <ComposeBox onPosted={loadPosts} />

      <TradeInterestBanner />

      {!loading && user && tab === 'all' && followedCount === 0 && rarityFiltered.length > 0 && (
        <div className="mx-4 my-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">Follow collectors to personalize your feed</p>
          <p className="mt-0.5 text-muted-foreground">You're seeing recent posts from the community. Follow collectors to see their content first.</p>
          <Link to="/explore" className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Discover collectors</Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rarityFiltered.length === 0 ? (
        <div className="px-4 py-20 text-center">
          {user && tab === 'all' ? (
            <>
              <p className="text-lg font-bold">Your feed is quiet</p>
              <p className="mt-1 text-sm text-muted-foreground">Follow some collectors to fill your feed.</p>
              <Link to="/explore" className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Discover collectors</Link>
            </>
          ) : user ? (
            <p className="text-sm text-muted-foreground">No posts in this feed yet. Check back soon!</p>
          ) : (
            <>
              <p className="text-lg font-bold">Welcome to SwapPulse</p>
              <p className="mt-1 text-sm text-muted-foreground">Join the decentralized social network for Pokémon TCG collectors — track your collection, trade cards, and connect with the community.</p>
              <div className="mt-4 flex justify-center gap-3">
                <Link to="/register" className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Create account</Link>
                <Link to="/explore" className="inline-flex items-center gap-1 rounded-full border border-border px-5 py-2 text-sm font-semibold hover:bg-secondary">Explore cards</Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="animate-fade-in">
          {rarityFiltered.map((post) => (
            <PostCard key={post.id} post={post} reactions={reactionsMap[post.id]} myRepost={repostMap[post.id]} myLike={likeMap[post.id]} />
          ))}
        </div>
      )}
      <PushOnboardingPrompt open={showPushPrompt} onClose={() => setShowPushPrompt(false)} />
    </div>
  );
}