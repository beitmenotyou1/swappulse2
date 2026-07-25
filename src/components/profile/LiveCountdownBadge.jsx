import React, { useState, useEffect } from 'react';

// Circular countdown badge overlaid on the profile avatar while the collector
// is live. Shows mm:ss remaining until auto_end_at, updating every second.
export default function LiveCountdownBadge({ autoEndAt, size = 36 }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const r = Math.max(0, Math.floor((new Date(autoEndAt).getTime() - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autoEndAt]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <span
      className="absolute -right-1 -top-1 z-10 flex items-center justify-center rounded-full bg-destructive/80 font-mono text-[10px] font-bold text-white ring-2 ring-background"
      style={{ width: size, height: size }}
    >
      {mm}:{ss}
    </span>
  );
}