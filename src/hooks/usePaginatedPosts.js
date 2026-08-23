import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { sortPostsDescending } from '@/lib/postSort';

const BATCH_SIZE = 50;

// usePaginatedPosts — skip-based infinite-scroll pagination for a collector's
// posts. Members load from the local Post entity (skip offset, 50 per batch);
// externals load a single batch from the federated Bluesky author feed (the
// AppView caps at 50, so no further pagination). Returns the raw (unfiltered)
// posts plus loading/hasMore/loadMore for the scroll sentinel. Visibility
// filtering (usePostVisibility) is applied by the caller.
export function usePaginatedPosts(did, isExternal) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const skipRef = useRef(0);

  const fetchBatch = useCallback(async (skip) => {
    if (!did) return [];
    if (isExternal) {
      const res = await base44.functions.invoke('get-author-feed', { did, limit: BATCH_SIZE });
      const data = res?.data ?? res;
      return data?.items || [];
    }
    return base44.entities.Post.filter({ did }, '-created_date', BATCH_SIZE, skip)
      .then((posts) => sortPostsDescending(posts || []))
      .catch(() => []);
  }, [did, isExternal]);

  // Initial load — resets whenever the target did or external flag changes.
  useEffect(() => {
    let active = true;
    setPosts([]);
    setHasMore(!isExternal);
    skipRef.current = 0;
    setLoading(true);
    (async () => {
      const batch = await fetchBatch(0).catch(() => []);
      if (!active) return;
      setPosts(batch);
      skipRef.current = batch.length;
      if (batch.length < BATCH_SIZE) setHasMore(false);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [did, isExternal, fetchBatch]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const batch = await fetchBatch(skipRef.current).catch(() => []);
      if (!batch || batch.length === 0) {
        setHasMore(false);
      } else {
        setPosts((prev) => [...prev, ...batch]);
        skipRef.current += batch.length;
        if (batch.length < BATCH_SIZE) setHasMore(false);
      }
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchBatch, loadingMore, hasMore, loading]);

  return { posts, loading, loadingMore, hasMore, loadMore };
}