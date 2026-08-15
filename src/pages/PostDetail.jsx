import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PostCard from '@/components/feed/PostCard';
import PostReplyThread from '@/components/feed/PostReplyThread';
import useSEO from '@/hooks/useSEO';

// Dedicated post detail page: renders a single post with its full reply
// thread and a composer. Reached from the inline thread's "View full thread"
// link and from like/repost/comment notification deep links.
export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  useSEO({
    title: post ? (post.content?.slice(0, 60) || 'Post') : 'Post',
    description: post ? (post.content?.slice(0, 160) || 'A post on SwapPulse') : 'A post on the SwapPulse Pokémon TCG collector community.',
    canonicalPath: `/post/${postId}`,
    jsonLd: post ? { '@context': 'https://schema.org', '@type': 'DiscussionForumPosting', headline: post.content?.slice(0, 80) || 'Post', author: { '@type': 'Person', name: post.author_name || 'Collector' } } : null,
  });

  useEffect(() => {
    if (!postId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const p = await base44.entities.Post.get(postId).catch(() => null);
        if (alive) setPost(p);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [postId]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!post) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm font-semibold">Post not found</p>
        <Link to="/" className="text-sm text-primary hover:underline">Back home</Link>
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