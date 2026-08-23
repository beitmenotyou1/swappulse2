import React, { useState, useRef, useCallback } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

const THRESHOLD = 70;
const MAX_PULL = 120;

// PullToRefresh — a lightweight touch-based pull-to-refresh wrapper for mobile
// WebView feeds. Tracks touch-drag distance when the viewport is scrolled to
// the top, shows a progress arrow that flips when the threshold is crossed, and
// triggers onRefresh (awaited) when released. No-op on desktop / non-touch.
export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e) => {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const onTouchMove = useCallback((e) => {
    if (!pulling.current || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) { setPullDistance(0); return; }
    // Rubber-band resistance so the pull feels natural, not 1:1.
    setPullDistance(Math.min(MAX_PULL, delta * 0.5));
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    pulling.current = false;
    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, onRefresh]);

  const progress = Math.min(1, pullDistance / THRESHOLD);

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pullDistance }}
      >
        {refreshing ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className="h-6 w-6 text-primary transition-transform duration-200"
            style={{ transform: `rotate(${progress * 180}deg)`, opacity: progress }}
          />
        )}
      </div>
      {children}
    </div>
  );
}