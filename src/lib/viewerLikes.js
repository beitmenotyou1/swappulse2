// Client-side cache of the viewer's PDS likes (app.bsky.feed.like records from
// their own Bluesky repo). Pre-fills liked state on posts that were liked
// directly on bsky.app, preventing duplicate like creation and matching
// bsky.app's viewer state. Loaded once per session via get-my-likes; updated
// optimistically when the user likes/unlikes via SwapPulse.

import { base44 } from '@/api/base44Client';

let cache = null; // Map<subjectUri, { likeUri, likeCid }> | null
let loading = null; // Promise | null

export async function loadViewerLikes() {
  if (cache) return cache;
  if (loading) return loading;
  loading = base44.functions.invoke('get-my-likes', {})
    .then((res) => {
      cache = new Map();
      if (res?.likes) {
        for (const l of res.likes) {
          cache.set(l.subjectUri, { likeUri: l.likeUri, likeCid: l.likeCid });
        }
      }
      return cache;
    })
    .catch(() => {
      cache = new Map();
      return cache;
    })
    .finally(() => { loading = null; });
  return loading;
}

export function isLikedByViewer(subjectUri) {
  if (!cache || !subjectUri) return false;
  return cache.has(subjectUri);
}

export function getViewerLike(subjectUri) {
  return cache?.get(subjectUri) || null;
}

export function setViewerLiked(subjectUri, likeUri = '', likeCid = '') {
  if (!cache || !subjectUri) return;
  cache.set(subjectUri, { likeUri, likeCid });
}

export function unsetViewerLiked(subjectUri) {
  if (!cache || !subjectUri) return;
  cache.delete(subjectUri);
}

export function clearViewerLikesCache() {
  cache = null;
  loading = null;
}