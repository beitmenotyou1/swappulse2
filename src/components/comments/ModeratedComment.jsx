import React, { useState } from 'react';
import CommentItem from './CommentItem';
import { ShieldAlert, EyeOff, AlertTriangle } from 'lucide-react';

// Determines display state from Post.moderation_status + moderation_labels.
function getDisplayState(comment) {
  const status = comment.moderation_status;
  const labels = Array.isArray(comment.moderation_labels) ? comment.moderation_labels : [];

  if (status === 'escalated') {
    return { state: 'quarantined', warnings: ['This comment is under review by moderators.'] };
  }
  const hasHide = labels.some((l) => l?.severity === 'hide');
  if (hasHide) {
    return { state: 'hidden', warnings: ['This comment has been hidden due to community guidelines.'] };
  }
  const warnLabels = labels.filter((l) => l?.severity === 'warn');
  if (warnLabels.length > 0 || status === 'pending') {
    return {
      state: 'warned',
      warnings: warnLabels.map((l) => l?.reason || `Flagged: ${l?.label || 'pending review'}`),
    };
  }
  return { state: 'visible', warnings: [] };
}

export default function ModeratedComment({ comment, replies, user, cardId, cardName, cardImage, onReply, onPosted, reactionsByPostId, replyToAuthor, topLevelId }) {
  const [revealHidden, setRevealHidden] = useState(false);
  const displayState = getDisplayState(comment);

  // Quarantined: notice only, no reveal
  if (displayState.state === 'quarantined') {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/5 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-warning">
          <ShieldAlert className="h-4 w-4" />
          Under review
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{displayState.warnings[0]}</p>
      </div>
    );
  }

  // Hidden: toggle to reveal
  if (displayState.state === 'hidden' && !revealHidden) {
    return (
      <div className="rounded-xl border border-border bg-secondary/50 p-3">
        <button
          onClick={() => setRevealHidden(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Show hidden comment
        </button>
        {displayState.warnings[0] && (
          <span className="ml-2 text-xs text-muted-foreground/70">({displayState.warnings[0]})</span>
        )}
      </div>
    );
  }

  return (
    <div>
      {displayState.state === 'warned' && (
        <div className="flex items-center gap-1.5 rounded-t-xl bg-warning/10 px-3 py-1.5 text-xs text-warning">
          <AlertTriangle className="h-3 w-3" />
          {displayState.warnings[0]}
        </div>
      )}
      <CommentItem
        comment={comment}
        replies={replies}
        user={user}
        cardId={cardId}
        cardName={cardName}
        cardImage={cardImage}
        onReply={onReply}
        onPosted={onPosted}
        dimmed={displayState.state === 'hidden' && revealHidden}
        reactionsByPostId={reactionsByPostId}
        replyToAuthor={replyToAuthor}
        topLevelId={topLevelId}
      />
    </div>
  );
}