import React from 'react';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/format';

export default function ConversationList({ conversations, activeId, onSelect, myDid }) {
  if (!conversations.length) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        No conversations yet. Tap Message on a collector's profile to start chatting.
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      {conversations.map((c) => {
        const isActive = c.id === activeId;
        const isLastMine = c.last_message_did && c.last_message_did === myDid;
        const hasUnread = !isLastMine && c.last_message_at && (!c.last_read_at || new Date(c.last_read_at) < new Date(c.last_message_at));
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`flex items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-secondary ${
              isActive ? 'bg-secondary' : ''
            }`}
          >
            <Avatar name={c.recipient_name} src={c.recipient_avatar} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{c.recipient_name || c.recipient_handle || 'Collector'}</p>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {c.last_message_at ? timeAgo(c.last_message_at) : ''}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {isLastMine ? 'You: ' : ''}
                  {c.last_message_preview || 'Start a conversation'}
                </p>
                {hasUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}