import React from 'react';
import { Users, Twitch, Youtube, MonitorPlay } from 'lucide-react';
import Avatar from '@/components/Avatar';

// Platform → brand icon + thumbnail placeholder gradient.
const PLATFORM_META = {
  twitch: { label: 'Twitch', Icon: Twitch, gradient: 'from-[#9146FF] to-[#5a189a]' },
  youtube: { label: 'YouTube', Icon: Youtube, gradient: 'from-[#FF0000] to-[#7a0d0d]' },
  kick: { label: 'Kick', Icon: MonitorPlay, gradient: 'from-[#53FC18] to-[#1a7a0c]' },
  facebook_gaming: { label: 'Facebook', Icon: MonitorPlay, gradient: 'from-[#1877F2] to-[#0a3d80]' },
  rumble: { label: 'Rumble', Icon: MonitorPlay, gradient: 'from-[#85C742] to-[#3d6b1e]' },
  custom: { label: 'Custom', Icon: MonitorPlay, gradient: 'from-primary to-primary-muted' },
  other: { label: 'Other', Icon: MonitorPlay, gradient: 'from-muted-foreground to-secondary' },
};

// Grid card for the Live Now discovery feed. Streams have no real preview in
// the manual-live model, so the thumbnail is a platform-tinted gradient.
export default function LiveStreamCard({ space }) {
  const meta = PLATFORM_META[space.platform] || PLATFORM_META.custom;
  const handle = space.host_handle
    || String(space.host_name || 'collector').toLowerCase().replace(/\s+/g, '');
  const viewers = space.viewer_count_estimate || 0;

  const open = (e) => {
    e.preventDefault();
    if (space.stream_url) window.open(space.stream_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-primary/40 hover:shadow-raised">
      <div className={`relative aspect-video bg-gradient-to-br ${meta.gradient}`}>
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> LIVE
        </span>
        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-black/40 text-white backdrop-blur">
          <meta.Icon className="h-4 w-4" />
        </span>
        <div className="absolute inset-0 grid place-items-center">
          <meta.Icon className="h-10 w-10 text-white/30" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{space.title}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Avatar name={space.host_name} src={space.host_avatar} size={18} />
          <span className="truncate">@{handle}</span>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" /> ~{viewers} watching
        </span>
        <button
          onClick={open}
          disabled={!space.stream_url}
          className="mt-1 w-full rounded-md bg-destructive py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          Watch Stream
        </button>
      </div>
    </div>
  );
}