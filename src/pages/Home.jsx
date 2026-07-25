import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ComposeBox from '@/components/feed/ComposeBox';
import PostCard from '@/components/feed/PostCard';
import TradeInterestBanner from '@/components/feed/TradeInterestBanner';
import CardOfTheDay from '@/components/home/CardOfTheDay';
import StoriesBar from '@/components/stories/StoriesBar';
import SpaceBar from '@/components/spaces/SpaceBar';
import { useRealtimeEvent } from '@/hooks/useRealtimeEvent';

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

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Post.list('-created_date', 50);
      setPosts(data);
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
        const res = await base44.functions.invoke('getReactions', { postIds: posts.map((p) => p.id) });
        setReactionsMap(res.data?.reactions || {});
      } catch {
        setReactionsMap({});
      }
    })();
  }, [posts]);

  const filtered = tab === 'all' ? posts : posts.filter((p) => p.post_type === tab);

  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center px-2">
          {TABS.map((t) => (
            <button
              key={t.key}
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
            <PostCard key={post.id} post={post} reactions={reactionsMap[post.id]} />
          ))}
        </div>
      )}
    </div>
  );
}