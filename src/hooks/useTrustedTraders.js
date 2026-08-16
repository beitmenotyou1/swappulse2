import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Module-level cache so every PostCard in a feed and every profile share one
// fetch + one realtime subscription. The trusted_trader set is small (requires
// 50+ distinct vouches), so a single filter call loads all holders.
let trustedDids = null;
let fetchPromise = null;
let listeners = new Set();

async function loadTrusted() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const records = await base44.entities.Achievement.filter(
        { achievement_type: 'trusted_trader', status: 'granted' },
        '-created_date',
        500,
      );
      trustedDids = new Set(records.map((r) => r.did).filter(Boolean));
    } catch {
      trustedDids = new Set();
    } finally {
      fetchPromise = null;
    }
    listeners.forEach((fn) => fn());
  })();
  return fetchPromise;
}

export function useTrustedTraders() {
  const [, force] = useState(0);

  useEffect(() => {
    let mounted = true;
    const update = () => { if (mounted) force((n) => n + 1); };
    listeners.add(update);
    if (trustedDids === null) loadTrusted();

    // Live: keep the set in sync as achievements are granted/revoked.
    const unsubscribe = base44.entities.Achievement.subscribe((event) => {
      const d = event?.data?.did;
      if (!d || event?.data?.achievement_type !== 'trusted_trader') return;
      if (!trustedDids) return;
      if (event.type === 'delete' || event.data.status === 'revoked') {
        trustedDids.delete(d);
      } else if (event.type === 'create' && event.data.status === 'granted') {
        trustedDids.add(d);
      }
      update();
    });

    return () => {
      mounted = false;
      listeners.delete(update);
      unsubscribe?.();
    };
  }, []);

  const isTrusted = (did) => !!did && !!trustedDids && trustedDids.has(did);
  return { isTrusted, loading: trustedDids === null };
}