import React from 'react';
import Avatar from '@/components/Avatar';
import { ExternalLink } from 'lucide-react';

// Renders a reply fetched from the wider Bluesky network (not a local SwapPulse
// post). Read-only — no reactions, replies, or moderation actions, since the
// record lives on an external PDS.
export default function ExternalReply({ reply }) {
  const handle = reply.author_handle ? `@${reply.author_handle}` : '';
  const profileUrl = reply.author_handle ? `https://bsky.app/profile/${reply.author_handle}` : '#';
  return (
    <div className="ml-6 border-l-2 border-border pl-3 py-2">
      <div className="flex items-start gap-2.5">
        <Avatar name={reply.author_name || reply.author_handle} src={reply.author_avatar} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold">{reply.author_name || reply.author_handle || 'Bluesky user'}</span>
            {handle && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
              >
                {handle} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
              <ExternalLink className="h-2.5 w-2.5" /> Bluesky
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{reply.content}</p>
        </div>
      </div>
    </div>
  );
}