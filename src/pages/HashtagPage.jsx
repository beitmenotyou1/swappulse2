import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Hash, Loader2, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PostCard from '@/components/feed/PostCard';
import useSEO from '@/hooks/useSEO';

// Public hashtag discovery page. Reads the tag from the URL, fetches posts
// whose canonical_tags array contains the tag, and renders them with the
// existing PostCard. The SDK filter doesn't support array-contains queries
// for canonical_tags, so we fetch recent posts and client-filter by tag
// membership — sufficient for discovery with a generous limit.
export default function HashtagPage() {
  const { tag } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: `#${tag || ''} — Hashtag`,
    description: `Posts tagged #${tag || ''} on SwapPulse — the decentralized Pokémon TCG collector community.`,
    canonicalPath: `/hashtag/${tag || ''}`,
  });

  useEffect(() => {
    if (!tag) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // Fetch a broad window of recent posts and client-filter by tag.
        // canonical_tags are stored lowercased, so the comparison is exact.
        const recent = await base44.entities.Post.list('-created_date', 200);
        if (!alive) return;
        const matched = (recent || []).filter(
          (p) => Array.isArray(p.canonical_tags) && p.canonical_tags.includes(tag.toLowerCase())
        );
        setPosts(matched);
      } catch {
        if (alive) setPosts([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tag]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Link to="/" className="rounded-full p-1.5 hover:bg-secondary" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex items-center gap-1.5 text-lg font-bold">
          <Hash className="h-5 w-5 text-primary" />
          {tag || ''}
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <Hash className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-semibold">No posts with #{tag} yet</p>
          <p className="text-sm text-muted-foreground">Be the first to use this hashtag.</p>
          <Link to="/compose" className="mt-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
            Write a post
          </Link>
        </div>
      ) : (
        <div>
          <p className="px-4 py-3 text-sm text-muted-foreground">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
          <div className="divide-y divide-border">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}