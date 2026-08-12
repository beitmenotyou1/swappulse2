import React from 'react';
import CommentThread from './CommentThread';

export default function DiscussionTab({ card }) {
  return (
    <div className="p-4">
      <CommentThread
        cardId={card.id}
        cardName={card.name}
        cardImage={card.image || ''}
      />
    </div>
  );
}