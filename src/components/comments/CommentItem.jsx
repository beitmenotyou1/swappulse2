import React, { useState, useEffect } from 'react';
import Avatar from '@/components/Avatar';
import CommentReactions from './CommentReactions';
import CommentActionBar from './CommentActionBar';
import ExternalIndicator from '@/components/ExternalIndicator';
import { useMembership } from '@/lib/membershipContext';
import { CornerDownRight } from 'lucide-react';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function CommentItem({ comment, replies, user, cardId, cardName, cardImage, onReply, onPosted, dimmed, reactionsByPostId }) {
  const [showReplies, setShowReplies] = useState(true);
  const { registerDid } = useMembership();

  useEffect(() => {
    if (comment?.did) registerDid(comment.did);
    replies.forEach((r) => r?.did && registerDid(r.did));
  }, [comment?.did, replies, registerDid]);

  return (
    <div className={`rounded-xl border border-border bg-card p-3 ${dimmed ? 'opacity-50' : ''}`}>
      <div className="flex gap-2.5">
        <Avatar name={comment.author_name} src={comment.author_avatar} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{comment.author_name || 'Collector'}</span>
            <ExternalIndicator did={comment.did} />
            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_date)}</span>
          </div>
          <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">{comment.content}</p>

          <div className="mt-2 space-y-1.5">
            <CommentActionBar comment={comment} user={user} onPosted={onPosted} />
            <CommentReactions post={comment} user={user} initialReactions={reactionsByPostId?.[comment.id]} />
          </div>

          {/* Replies (depth-1 only) */}
          {replies.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowReplies((v) => !v)}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                {showReplies ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </button>
              {showReplies && (
                <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
                  {replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2">
                      <CornerDownRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/50" />
                      <Avatar name={reply.author_name} src={reply.author_avatar} size={24} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">{reply.author_name || 'Collector'}</span>
                          <ExternalIndicator did={reply.did} />
                          <span className="text-xs text-muted-foreground">{timeAgo(reply.created_date)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{reply.content}</p>
                        <div className="mt-1.5 space-y-1">
                          <CommentActionBar comment={reply} user={user} compact onPosted={onPosted} />
                          <CommentReactions post={reply} user={user} compact initialReactions={reactionsByPostId?.[reply.id]} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}