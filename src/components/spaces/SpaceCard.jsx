import React from 'react';
import { Link } from 'react-router-dom';
import { Radio, Users, ExternalLink } from 'lucide-react';
import Avatar from '@/components/Avatar';

const PLATFORM_LABEL = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick',
  facebook_gaming: 'Facebook Gaming',
  rumble: 'Rumble',
  custom: 'Custom',
  other: 'Other',
};

// Stream card for a manual Go Live declaration. Live streams link out to the
// external stream_url; legacy internal rooms (no stream_url) link in-app.
export default function SpaceCard({ space }) {
  const live = space.status === 'live';
  const external = !!space.stream_url;
  const url = space.stream_url || `/spaces/${space.id}`;

  const inner = (
    <div className="flex items-start gap-3">
      <span className="relative mt-1">
        <span className={`absolute -inset-0.5 rounded-full ${live ? 'animate-pulse bg-destructive/50' : 'bg-accent/30'}`} />
        <Avatar name={space.host_name} src={space.host_avatar} size={44} className="relative" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              <Radio className="h-3 w-3" /> LIVE
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Ended</span>
          )}
          {space.platform && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {PLATFORM_LABEL[space.platform] || space.platform}
            </span>
          )}
        </div>
        <p className="mt-1 truncate font-bold">{space.title}</p>
        <p className="truncate text-xs text-muted-foreground">Hosted by {space.host_name || 'Collector'}</p>
        {space.topic_tags?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {space.topic_tags.slice(0, 4).map((t, i) => (
              <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}
      </div>
      {live && (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {space.viewer_count_estimate || 0}
        </span>
      )}
      {external && <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
    </div>
  );

  if (external) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-raised"
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      to={url}
      className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-raised"
    >
      {inner}
    </Link>
  );
}