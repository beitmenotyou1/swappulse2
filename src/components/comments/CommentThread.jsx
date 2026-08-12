import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import CommentComposer from './CommentComposer';
import ModeratedComment from './ModeratedComment';
import { MessageCircle, Loader2 } from 'lucide-react';

export default function CommentThread({ cardId, cardName, cardImage }) {
  const { user } = useAuth();
  const [topLevel, setTopLevel] = useState([]);
  const [repliesByParent, setRepliesByParent] = useState({});
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const posts = await base44.entities.Post.filter(
        { card_id: cardId, post_type: 'text' },
        '-created_date',
        100
      );
      const tops = posts.filter((p) => !p.reply_to);
      const replies = {};
      posts
        .filter((p) => p.reply_to)
        .forEach((p) => {
          if (!replies[p.reply_to]) replies[p.reply_to] = [];
          replies[p.reply_to].push(p);
        });
      // Sort: top-level oldest first (discussion order), replies oldest first
      tops.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      Object.values(replies).forEach((arr) =>
        arr.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
      );
      setTopLevel(tops);
      setRepliesByParent(replies);
    } catch {
      setTopLevel([]);
      setRepliesByParent({});
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Realtime: reload on any Post event for this card
  useEffect(() => {
    const unsubscribe = base44.entities.Post.subscribe((event) => {
      if (event?.data?.card_id === cardId) loadComments();
    });
    return unsubscribe;
  }, [cardId, loadComments]);

  const totalComments = topLevel.length + Object.values(repliesByParent).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Discussion</h2>
        <span className="text-sm text-muted-foreground">{totalComments} {totalComments === 1 ? 'comment' : 'comments'}</span>
      </div>

      <CommentComposer
        cardId={cardId}
        cardName={cardName}
        cardImage={cardImage}
        user={user}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        onPosted={loadComments}
      />

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : topLevel.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No comments yet. Start the discussion!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topLevel.map((comment) => (
            <ModeratedComment
              key={comment.id}
              comment={comment}
              replies={repliesByParent[comment.id] || []}
              user={user}
              cardId={cardId}
              cardName={cardName}
              cardImage={cardImage}
              onReply={(c) => setReplyTarget(c)}
              onPosted={loadComments}
            />
          ))}
        </div>
      )}
    </div>
  );
}