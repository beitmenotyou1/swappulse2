import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '@/components/Avatar';
import { useLivePresence } from '@/lib/livePresence';

// §Alpha 1.4 - wraps an avatar with a pulsing red ring when the user is live
// (hosting a voice space or streaming externally). Clicking opens the live
// content: voice spaces open in-app; external streams open in a new tab.
// Desktop hover shows a tooltip with title, duration, and a Join button.
export default function LiveAvatar({ did, name, src, size = 40, className = '', online = false }) {
  const { liveByDid } = useLivePresence();
  const navigate = useNavigate();
  const [hover, setHover] = useState(false);
  const info = did ? liveByDid.get(did) : null;
  const inner = <Avatar name={name} src={src} size={size} className={className} online={online} />;

  if (!info) return inner;

  const open = (e) => {
    e?.stopPropagation?.();
    if (info.sourceType === 'voice_space' && info.spaceId) navigate(`/spaces/${info.spaceId}`);
    else if (info.url) window.open(info.url, '_blank', 'noopener,noreferrer');
  };

  const startedMins = info.startedAt
    ? Math.max(1, Math.round((Date.now() - new Date(info.startedAt).getTime()) / 60000))
    : null;

  return (
    <span
      className="relative inline-block cursor-pointer align-top"
      onClick={open}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="pointer-events-none absolute -inset-[3px] rounded-full border-[3px] border-[#FF0000] live-ring" />
      {inner}
      {hover && (
        <span className="absolute left-1/2 top-full z-50 mt-2 w-max max-w-xs -translate-x-1/2 rounded-lg bg-popover p-2.5 text-xs text-popover-foreground shadow-elevated">
          <span className="flex items-center gap-1 font-bold text-destructive">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> LIVE: {info.title || 'Live now'}
          </span>
          {startedMins != null && <span className="mt-1 block text-muted-foreground">Started {startedMins} min ago</span>}
          {info.viewerCount != null && info.viewerCount > 0 && <span className="block text-muted-foreground">{info.viewerCount} viewers</span>}
          <button onClick={open} className="mt-2 w-full rounded bg-destructive py-1.5 text-center font-bold text-white">Join</button>
        </span>
      )}
    </span>
  );
}