import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PostCard from '@/components/feed/PostCard';
import PostReplyThread from '@/components/feed/PostReplyThread';
import { usePostVisibility } from '@/hooks/usePostVisibility';
import { visibilityLabel } from '@/lib/postVisibility';
import useSEO from '@/hooks/useSEO';

// Dedicated post detail page: renders a single post with its full reply
// thread and a composer. Handles two routes:
//   /post/:postId  — local post by id (existing)
//   /post/at/:atUri — on-demand fetch from the Bluesky AppView (URL-encoded at_uri)
// The on-demand variant calls resolve-post-by-uri which fetches the post from
// the public AppView and creates a local Post record so it can be viewed and
// interacted with (reply, like, repost, quote) entirely on-site via the
// existing PostCard + PostReplyThread components.
export default function PostDetail() {
  const { postId, atUri } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { canView } = usePostVisibility();
  useSEO({
    title: post ? (post.content?.slice(0, 60) || 'Post') : 'Post',
    description: post ? (post.content?.slice(0, 160) || 'A post on SwapPulse') : 'A post on the SwapPulse Pokémon TCG collector community.',
    canonicalPath: atUri ? `/post/at/${atUri}` : `/post/${postId}`,
    jsonLd: post ? { '@context': 'https://schema.org', '@type': 'DiscussionForumPosting', headline: post.content?.slice(0, 80) || 'Post', author: { '@type': 'Person', name: post.author_name || 'Collector' } } : null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        if (atUri) {
          const decodedUri = decodeURIComponent(atUri);
          const res = await base44.functions.invoke('resolve-post-by-uri', { at_uri: decodedUri });
          const body = res?.data ?? res;
          if (!alive) return;
          if (body?.postId && body?.post) {
            setPost(body.post);
          } else {
            setError(body?.error || 'Post not found');
          }
        } else if (postId) {
          const p = await base44.entities.Post.get(postId).catch(() => null);
          if (!alive) return;
          setPost(p);
          if (!p) setError('Post not found');
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Failed to load post');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [postId, atUri]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading post…</p>
      </div>
    );
  }
  if (!post) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm font-semibold">{error || 'Post not found'}</p>
        <Link to="/" className="text-sm text-primary hover:underline">Back home</Link>
      </div>
    );
  }

  // Visibility gate: non-public posts are hidden from non-permitted viewers.
  if (!canView(post)) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Post</h1>
        </div>
        <div className="mx-4 mt-10 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">This post is limited</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Only the author&apos;s {visibilityLabel(post.visibility_scope)} can see this post.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Post</h1>
      </div>
      <PostCard post={post} />
      <div className="px-4 pb-8">
        <h2 className="mb-2 mt-4 flex items-center gap-2 text-sm font-bold">
          Replies <span className="text-muted-foreground">{post.replies || 0}</span>
        </h2>
        <PostReplyThread parentPost={post} showFullThreadLink={false} full />
      </div>
    </div>
  );
}