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
  const [replyToAuthor, setReplyToAuthor] = useState({});
  const [reactionsByPostId, setReactionsByPostId] = useState({});
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
      // Build a children-by-parent map so we can collect ALL descendants of
      // each top-level comment recursively (reply_to now points to the direct
      // parent, not the top-level). The UI stays flat — all descendants render
      // in one chronological list under the top-level comment.
      const childrenByParent = {};
      posts
        .filter((p) => p.reply_to)
        .forEach((p) => {
          if (!childrenByParent[p.reply_to]) childrenByParent[p.reply_to] = [];
          childrenByParent[p.reply_to].push(p);
        });
      const collectDescendants = (parentId, acc = []) => {
        (childrenByParent[parentId] || []).forEach((child) => {
          acc.push(child);
          collectDescendants(child.id, acc);
        });
        return acc;
      };
      // Lookup map for resolving the author of each reply's direct parent.
      const postMap = {};
      posts.forEach((p) => { postMap[p.id] = p; });
      const replies = {};
      const authorMap = {};
      tops.forEach((top) => {
        const descendants = collectDescendants(top.id).sort(
          (a, b) => new Date(a.created_date) - new Date(b.created_date)
        );
        replies[top.id] = descendants;
        descendants.forEach((d) => {
          const parent = postMap[d.reply_to];
          if (parent) {
            authorMap[d.id] = {
              name: parent.author_name || 'Collector',
              handle: parent.author_handle || '',
              id: parent.id,
            };
          }
        });
      });
      // Sort: top-level oldest first (discussion order)
      tops.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setTopLevel(tops);
      setRepliesByParent(replies);
      setReplyToAuthor(authorMap);

      // Batch-fetch reactions for all comments + replies (avoids N+1 per CommentReactions)
      const allIds = posts.map((p) => p.id);
      let rxnMap = {};
      if (allIds.length > 0) {
        try {
          const reactions = await base44.entities.Reaction.filter(
            { post_id: { $in: allIds } },
            '-created_date',
            500
          );
          reactions.forEach((r) => {
            if (!rxnMap[r.post_id]) rxnMap[r.post_id] = { counts: {}, mine: null };
            rxnMap[r.post_id].counts[r.reaction_type] = (rxnMap[r.post_id].counts[r.reaction_type] || 0) + 1;
            if (r.created_by_id === user?.id) rxnMap[r.post_id].mine = r.reaction_type;
          });
        } catch {
          // fail silently — CommentReactions will fall back to individual fetches
        }
      }
      setReactionsByPostId(rxnMap);
    } catch {
      setTopLevel([]);
      setRepliesByParent({});
      setReplyToAuthor({});
      setReactionsByPostId({});
    } finally {
      setLoading(false);
    }
  }, [cardId, user?.id]);

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
              reactionsByPostId={reactionsByPostId}
              replyToAuthor={replyToAuthor}
              topLevelId={comment.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}