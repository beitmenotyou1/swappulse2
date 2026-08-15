import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// useMergedProfile — fetches the merged SwapPulse + Bluesky profile for a given
// DID or handle via the get-merged-profile backend function. Caches results for
// 60s in a module-level map so navigating between tabs/profiles doesn't
// refetch the same identity. Falls back gracefully: if the fetch fails, the
// hook surfaces an error but never blocks the page (callers render local data).
//
// Usage: const { profile, loading, error } = useMergedProfile({ did });
//        const { profile } = useMergedProfile({ handle: 'alice.bsky.social' });

const CACHE_TTL_MS = 60_000;
const cache = new Map(); // key -> { data, expires }

export function useMergedProfile({ did, handle } = {}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const key = did || handle || '';

  useEffect(() => {
    if (!key) {
      setLoading(false);
      return;
    }
    let active = true;

    (async () => {
      // Serve from cache when fresh.
      const cached = cache.get(key);
      if (cached && cached.expires > Date.now()) {
        setProfile(cached.data);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      try {
        const res = await base44.functions.invoke('get-merged-profile', { did, handle });
        const data = res?.data ?? res;
        if (!active) return;
        if (data?.found) {
          setProfile(data);
          setError(null);
          cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
        } else {
          setError(data?.error || 'Profile not found');
        }
      } catch (e) {
        if (!active) return;
        setError(e?.message || 'Could not load profile');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [key]);

  return { profile, loading, error };
}