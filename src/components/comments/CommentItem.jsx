import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '@/components/Avatar';
import CommentReactions from './CommentReactions';
import CommentActions from './CommentActions';
import ExternalIndicator from '@/components/ExternalIndicator';
import { useMembership } from '@/lib/membershipContext';
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

// Renders a single comment card (avatar, author, text, actions, reactions).
// Nesting under the parent is handled by CommentNode, which wraps this via
// ModeratedComment and recurses for children.
export default function CommentItem({ comment, user, cardId, cardName, cardImage, onReply, onPosted, dimmed, reactionsByPostId }) {
  const { registerDid } = useMembership();
  const navigate = useNavigate();
  const detailPath = getPostDetailPath(comment);
  const handleCommentClick = (e) => {
    if (isInteractiveTarget(e) || !detailPath) return;
    navigate(detailPath);
  };

  useEffect(() => {
    if (comment?.did) registerDid(comment.did);
  }, [comment?.did, registerDid]);

  return (
    <div
      id={`comment-${comment.id}`}
      onClick={handleCommentClick}
      className={`rounded-xl border border-border bg-card p-3 transition-shadow ${dimmed ? 'opacity-50' : ''} ${detailPath ? 'cursor-pointer hover:border-border-strong transition-colors' : ''}`}
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
        </div>
      </div>
    </div>
  );
}