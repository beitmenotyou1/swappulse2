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
  const [ancestors, setAncestors] = useState([]);
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

  // Walk the parent chain upward so the full conversation reads top-to-bottom
  // above the focused post. Resolves each ancestor from the local DB first
  // (by at_uri), falling back to resolve-post-by-uri for remote ancestors.
  useEffect(() => {
    let alive = true;
    (async () => {
      setAncestors([]);
      if (!post?.parent_uri) return;
      const chain = [];
      let currentUri = post.parent_uri;
      const seen = new Set();
      while (currentUri && alive && !seen.has(currentUri)) {
        seen.add(currentUri);
        let ancestor = null;
        try {
          const local = await base44.entities.Post.filter({ at_uri: currentUri }, '-created_date', 1).catch(() => []);
          if (local?.length) {
            ancestor = local[0];
          } else {
            const res = await base44.functions.invoke('resolve-post-by-uri', { at_uri: currentUri }).catch(() => null);
            const body = res?.data ?? res;
            if (body?.post) ancestor = body.post;
          }
        } catch { /* ignore — stop chain */ }
        if (!alive) return;
        if (!ancestor) break;
        chain.unshift(ancestor);
        currentUri = ancestor.parent_uri || null;
      }
      if (alive) setAncestors(chain);
    })();
    return () => { alive = false; };
  }, [post?.id, post?.parent_uri]);

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
      {ancestors.length > 0 && (
        <div className="border-l-2 border-border pl-3 ml-4 mr-4 mb-2 space-y-1">
          {ancestors.map((a) => (
            <PostCard key={a.id || a.at_uri} post={a} />
          ))}
        </div>
      )}
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