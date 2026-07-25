import React from 'react';

// §Alpha 1.4 - LIVE badge for post cards whose author is currently live.
export default function LiveBadge({ title }) {
  return (
    <span className="flex items-center gap-1 rounded bg-[#FF0000] px-1.5 py-0.5 text-xs font-bold text-white shadow">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
    </span>
  );
}