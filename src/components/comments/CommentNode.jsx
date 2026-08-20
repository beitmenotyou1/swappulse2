import React, { useState } from 'react';
import ModeratedComment from './ModeratedComment';

// Recursive comment tree node. Renders a single comment (via ModeratedComment)
// then its children indented beneath, to full recursive depth. Visual
// indentation is capped at 6 levels to stay mobile-friendly; deeper replies
// still nest structurally but don't indent further. Each node owns its own
// expand/collapse state (preserved across re-renders via stable keys).
const VISUAL_DEPTH_CAP = 6;

export default function CommentNode({
  comment,
  childrenByParent,
  depth = 0,
  user,
  cardId,
  cardName,
  cardImage,
  onReply,
  onPosted,
  reactionsByPostId,
}) {
  const [showReplies, setShowReplies] = useState(true);
  const children = childrenByParent[comment.id] || [];
  const indent = depth < VISUAL_DEPTH_CAP;

  return (
    <div>
      <ModeratedComment
        comment={comment}
        user={user}
        cardId={cardId}
        cardName={cardName}
        cardImage={cardImage}
        onReply={onReply}
        onPosted={onPosted}
        reactionsByPostId={reactionsByPostId}
      />
      {children.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowReplies((v) => !v)}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {showReplies ? 'Hide' : 'Show'} {children.length} {children.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies && (
            <div className={`mt-2 space-y-2 ${indent ? 'ml-3 sm:ml-4 ' : ''}border-l-2 border-border pl-3 sm:pl-4`}>
              {children.map((child) => (
                <CommentNode
                  key={child.id}
                  comment={child}
                  childrenByParent={childrenByParent}
                  depth={depth + 1}
                  user={user}
                  cardId={cardId}
                  cardName={cardName}
                  cardImage={cardImage}
                  onReply={onReply}
                  onPosted={onPosted}
                  reactionsByPostId={reactionsByPostId}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}