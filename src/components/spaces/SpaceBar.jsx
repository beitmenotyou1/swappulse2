import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, CalendarClock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Avatar from '@/components/Avatar';

// Discovery bar of live + upcoming voice spaces, surfaced on the home feed.
export default function SpaceBar() {
  const [spaces, setSpaces] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.VoiceSpace.list('-created_date', 30);
        const live = all.filter((s) => s.status === 'live');
        const upcoming = all
          .filter((s) => s.status === 'scheduled')
          .sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0));
        setSpaces([...live, ...upcoming].slice(0, 10));
      } catch {
        setSpaces([]);
      }
    })();
  }, []);

  if (!spaces.length) return null;
  return (
    <div className="border-b border-border bg-card/60">
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-3">
        <div className="flex shrink-0 items-center gap-1.5 pr-2 text-xs font-bold uppercase tracking-wide text-primary">
          <Radio className="h-4 w-4" /> Spaces
        </div>
        {spaces.map((s) => {
          const isLive = s.status === 'live';
          return (
            <Link key={s.id} to={`/spaces/${s.id}`} className="flex shrink-0 flex-col items-center gap-1">
              <span className="relative inline-block">
                <span className={`absolute -inset-0.5 rounded-full ${isLive ? 'animate-pulse bg-destructive/60' : 'bg-accent/40'}`} />
                <Avatar name={s.host_name} src={s.host_avatar} size={48} className="relative" />
              </span>
              <span className="max-w-[64px] truncate text-[11px] font-semibold">{s.title}</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {isLive ? <span className="text-destructive">● {s.listener_count || 0}</span> : <CalendarClock className="h-3 w-3" />}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}