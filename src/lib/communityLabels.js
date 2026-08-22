// communityLabels — module-level batch loader for community label badges.
// Multiple LabelBadges components in the same feed render cycle batch their
// subject URIs into a single get-community-labels backend call (debounced 50ms).
// Results are cached in a module-level Map so re-renders and scroll-back don't
// re-fetch. Labels are strictly opt-in: only labels from labelers the viewer
// has subscribed to are returned by the backend.

import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const cache = new Map();
const pending = new Set();
const listeners = new Map();
let flushTimer = null;

function notify(uris) {
  for (const uri of uris) {
    const cbs = listeners.get(uri);
    if (cbs) cbs.forEach((cb) => cb());
  }
}

function flush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const uris = [...pending];
    pending.clear();
    if (!uris.length) return;
    const toFetch = uris.filter((u) => !cache.has(u));
    if (!toFetch.length) { notify(uris); return; }
    try {
      const res = await base44.functions.invoke('get-community-labels', { subject_uris: toFetch });
      const labelsMap = res?.labels || {};
      for (const uri of toFetch) {
        cache.set(uri, labelsMap[uri] || []);
      }
    } catch {
      for (const uri of toFetch) {
        if (!cache.has(uri)) cache.set(uri, []);
      }
    }
    notify(toFetch);
  }, 50);
}

function request(uri) {
  if (cache.has(uri)) { notify([uri]); return; }
  pending.add(uri);
  flush();
}

export function useCommunityLabels(subjectUri) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!subjectUri) return;
    const cb = () => force((n) => n + 1);
    if (!listeners.has(subjectUri)) listeners.set(subjectUri, new Set());
    listeners.get(subjectUri).add(cb);
    request(subjectUri);
    return () => { listeners.get(subjectUri)?.delete(cb); };
  }, [subjectUri]);
  return subjectUri ? (cache.get(subjectUri) || []) : [];
}

export function invalidateCommunityLabels(subjectUri) {
  if (subjectUri) {
    cache.delete(subjectUri);
    pending.add(subjectUri);
    flush();
  } else {
    cache.clear();
  }
}