import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import { canViewPost, filterVisiblePosts } from '@/lib/postVisibility';

// Resolves the current viewer's DID + the set of DIDs they follow, then exposes
// canView / filterPosts helpers that enforce post visibility_scope on the client.
// Guests (unauthenticated) get an empty viewerDid + empty followedDids, so only
// public posts pass the filter.
export function usePostVisibility() {
  const [viewerDid, setViewerDid] = useState('');
  const [followedDids, setFollowedDids] = useState(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) return;
        const me = await base44.auth.me().catch(() => null);
        const { did } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
        if (!active || !did) return;
        setViewerDid(did);
        const follows = await base44.entities.Follow.filter({ did }, '-created_date', 500).catch(() => []);
        if (!active) return;
        setFollowedDids(new Set((follows || []).map((f) => f.subject_did).filter(Boolean)));
      } catch {
        /* guests and unresolved DIDs get the empty defaults */
      }
    })();
    return () => { active = false; };
  }, []);

  const canView = useCallback((post) => canViewPost(post, viewerDid, followedDids), [viewerDid, followedDids]);
  const filterPosts = useCallback((posts) => filterVisiblePosts(posts, viewerDid, followedDids), [viewerDid, followedDids]);

  return { viewerDid, followedDids, canView, filterPosts };
}