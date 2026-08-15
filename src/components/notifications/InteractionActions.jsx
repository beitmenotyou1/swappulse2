import React, { useState, useEffect } from 'react';
import CommentActions from '@/components/comments/CommentActions';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// Inline Like + Repost (with direct/quote) + Reply actions shown on
// like/repost/comment notification cards. For comment notifications the
// actions target the comment itself (via metadata.commentId or the external
// commentUri strongRef); for like/repost notifications they target the user's
// post that was interacted with (via metadata.postId). Delegates entirely to
// the shared CommentActions component so the interaction logic lives once.
export default function InteractionActions({ n, onResponded }) {
  const { user } = useAuth();
  const isComment = n.action_type === 'comment';
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let alive = true;
    (async () => {
      let t = null;
      // For comment notifications, prefer the local comment Post (has the
      // correct author did for notify); fall back to the external strongRef.
      if (isComment && n.metadata?.commentId) {
        t = await base44.entities.Post.get(n.metadata.commentId).catch(() => null);
      } else if (n.metadata?.postId) {
        t = await base44.entities.Post.get(n.metadata.postId).catch(() => null);
      }
      if (!alive) return;
      if (!t && isComment && n.metadata?.commentUri) {
        t = {
          id: null,
          at_uri: n.metadata.commentUri,
          cid: n.metadata.commentCid || '',
          did: n.actor_did,
          content: n.metadata.commentText || '',
          author_handle: n.actor_handle,
          bridged: true,
        };
      }
      if (!alive) return;
      setTarget(t);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [n.metadata?.commentId, n.metadata?.postId, n.metadata?.commentUri, isComment, user?.id]);

  if (loading || !target) return null;
  return <CommentActions comment={target} onPosted={onResponded} />;
}