import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '@/components/Avatar';
import CommentReactions from './CommentReactions';
import CommentActions from './CommentActions';
import ExternalIndicator from '@/components/ExternalIndicator';
import { useMembership } from '@/lib/membershipContext';
import { CornerDownRight } from 'lucide-react';
import RichText from '@/components/RichText';
import { getPostDetailPath, isInteractiveTarget } from '@/lib/postNav';

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

export default function CommentItem({ comment, replies, user, cardId, cardName, cardImage, onReply, onPosted, dimmed, reactionsByPostId, replyToAuthor, topLevelId }) {
  const [showReplies, setShowReplies] = useState(true);
  const [highlightedId, setHighlightedId] = useState(null);
  const { registerDid } = useMembership();
  const navigate = useNavigate();
  const detailPath = getPostDetailPath(comment);
  const handleCommentClick = (e) => {
    if (isInteractiveTarget(e) || !detailPath) return;
    navigate(detailPath);
  };

  const scrollToComment = (commentId) => {
    const el = document.getElementById(`comment-${commentId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(commentId);
    setTimeout(() => setHighlightedId(null), 2000);
  };

  const highlightClass = (id) =>
    highlightedId === id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : '';

  useEffect(() => {
    if (comment?.did) registerDid(comment.did);
    replies.forEach((r) => r?.did && registerDid(r.did));
  }, [comment?.did, replies, registerDid]);

  return (
    <div
      id={`comment-${comment.id}`}
      onClick={handleCommentClick}
      className={`rounded-xl border border-border bg-card p-3 transition-shadow ${dimmed ? 'opacity-50' : ''} ${highlightClass(comment.id)} ${detailPath ? 'cursor-pointer hover:border-border-strong transition-colors' : ''}`}
    >
      <div className="flex gap-2.5">
        <Avatar name={comment.author_name} src={comment.author_avatar} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{comment.author_name || 'Collector'}</span>
            <ExternalIndicator did={comment.did} />
            <span className="text-xs text-muted-foreground">{timeAgo(comment.created_date)}</span>
          </div>
          <RichText text={comment.content} className="mt-0.5 text-sm whitespace-pre-wrap break-words" />

          <div className="mt-2 space-y-1.5">
            <CommentActions comment={comment} onReply={onReply} onPosted={onPosted} compact />
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
                  {replies.map((reply) => {
                    const parent = replyToAuthor?.[reply.id];
                    const showReplyTo = parent && reply.reply_to !== topLevelId;
                    return (
                    <div key={reply.id} id={`comment-${reply.id}`} className={`flex gap-2 rounded-lg transition-shadow ${highlightClass(reply.id)}`}>
                      <CornerDownRight className="mt-1 h-3 w-3 shrink-0 text-muted-foreground/50" />
                      <Avatar name={reply.author_name} src={reply.author_avatar} size={24} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">{reply.author_name || 'Collector'}</span>
                          <ExternalIndicator did={reply.did} />
                          <span className="text-xs text-muted-foreground">{timeAgo(reply.created_date)}</span>
                        </div>
                        {showReplyTo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); scrollToComment(parent.id); }}
                            className="mt-0.5 text-xs text-muted-foreground hover:text-foreground"
                          >
                            replying to <span className="text-primary hover:underline">@{parent.handle || parent.name}</span>
                          </button>
                        )}
                        <RichText text={reply.content} className="text-sm whitespace-pre-wrap break-words" />
                        <div className="mt-1.5 space-y-1">
                          <CommentActions comment={reply} onReply={onReply} onPosted={onPosted} compact />
                          <CommentReactions post={reply} user={user} compact initialReactions={reactionsByPostId?.[reply.id]} />
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}