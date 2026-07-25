import React from 'react';
import { Link } from 'react-router-dom';
import { Radio, Users, CalendarClock, Disc3 } from 'lucide-react';
import Avatar from '@/components/Avatar';

export default function SpaceCard({ space }) {
  const live = space.status === 'live';
  return (
    <Link to={`/spaces/${space.id}`} className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40 hover:shadow-raised">
      <div className="flex items-start gap-3">
        <span className="relative mt-1">
          <span className={`absolute -inset-0.5 rounded-full ${live ? 'animate-pulse bg-destructive/50' : 'bg-accent/30'}`} />
          <Avatar name={space.host_name} src={space.host_avatar} size={44} className="relative" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {live ? (
              <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive"><Radio className="h-3 w-3" /> LIVE</span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent"><CalendarClock className="h-3 w-3" /> Scheduled</span>
            )}
            {space.recording_enabled && <Disc3 className="h-3.5 w-3.5 text-primary" />}
          </div>
          <p className="mt-1 truncate font-bold">{space.title}</p>
          <p className="truncate text-xs text-muted-foreground">Hosted by {space.host_name || 'Collector'}</p>
          {space.topic_tags?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {space.topic_tags.slice(0, 4).map((t, i) => <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">#{t}</span>)}
            </div>
          )}
        </div>
        {live ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground"><Users className="h-3.5 w-3.5" /> {space.listener_count || 0}</span>
        ) : space.scheduled_at ? (
          <span className="shrink-0 text-xs text-muted-foreground">{new Date(space.scheduled_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        ) : null}
      </div>
    </Link>
  );
}