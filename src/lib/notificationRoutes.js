// Shared helper for resolving notification target_paths to on-site routes.
// Converts external bsky.app URLs (stored historically by ingest-notifications)
// into on-site routes so no notification ever sends the user away from SwapPulse.
// Post URLs → /post/at/:encodedAtUri (on-demand fetch); profile URLs → /profile/:did.

export function bskyUrlToOnSiteRoute(url) {
  if (!url || typeof url !== 'string') return null;
  // Post URL: https://bsky.app/profile/:did/post/:rkey
  const postMatch = url.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/);
  if (postMatch) {
    const atUri = `at://${postMatch[1]}/app.bsky.feed.post/${postMatch[2]}`;
    return `/post/at/${encodeURIComponent(atUri)}`;
  }
  // Profile URL: https://bsky.app/profile/:did
  const profileMatch = url.match(/bsky\.app\/profile\/([^/?#]+)/);
  if (profileMatch) {
    return `/profile/${profileMatch[1]}`;
  }
  return null;
}

// Resolve a notification's target_path to an on-site route. External bsky.app
// URLs are converted to on-site routes; internal paths pass through. Returns
// '/notifications' as a safe fallback when no usable route can be derived.
export function resolveNotificationRoute(n) {
  const path = n?.target_path || '';
  if (!path) return '/notifications';
  if (path.startsWith('http')) {
    return bskyUrlToOnSiteRoute(path) || '/notifications';
  }
  return path.startsWith('/') ? path : `/${path}`;
}