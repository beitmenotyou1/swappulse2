import React, { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// InfiniteScrollSentinel — a bottom sentinel that triggers onLoadMore via
// IntersectionObserver when scrolled into view. Shows a subtle spinner while
// loading more and renders nothing once the feed is exhausted (hasMore=false).
// The 200px rootMargin pre-loads the next batch just before the user reaches
// the bottom for a seamless scroll.
export default function InfiniteScrollSentinel({ hasMore, loadingMore, onLoadMore }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (loadingMore) {
    return (
      <div className="flex justify-center py-6" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hasMore) return null;
  return <div ref={ref} className="h-1" aria-hidden="true" />;
}