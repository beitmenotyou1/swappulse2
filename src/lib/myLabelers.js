// myLabelers — session-level cache of the current user's approved
// CommunityLabeler records. Used by LabelContentButton to decide whether to
// render (hidden entirely if the user owns no approved labelers) and to
// populate the labeler dropdown without a per-click fetch.

import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

let cache = null;
const listeners = new Set();
let fetchPromise = null;

async function load() {
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const rows = await base44.entities.CommunityLabeler.filter({ approval_status: 'approved' }, '-created_date', 50);
      cache = rows || [];
    } catch {
      cache = [];
    } finally {
      fetchPromise = null;
    }
    listeners.forEach((fn) => fn());
  })();
  return fetchPromise;
}

export function useMyLabelers() {
  const { user } = useAuth();
  const [, force] = useState(0);
  useEffect(() => {
    if (!user?.id) return;
    const update = () => force((n) => n + 1);
    listeners.add(update);
    if (cache === null) load();
    return () => { listeners.delete(update); };
  }, [user?.id]);
  if (!user?.id || !cache) return [];
  return cache.filter((l) => {
    if (l.created_by_id && l.created_by_id === user.id) return true;
    if (l.did && user.did && l.did === user.did) return true;
    return false;
  });
}

export function invalidateMyLabelers() {
  cache = null;
  load();
}