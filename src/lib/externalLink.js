// Module-level external link confirmation store. Any component can call
// confirmExternalLink(url) to trigger the shared dialog (mounted once at the
// app root). Keeps a single source of truth so every surface (posts, comments,
// bios, journals) uses the same leave-site confirmation behaviour.

const listeners = new Set();
let pendingUrl = null;

// Only ordinary web URLs may leave SwapPulse. Schemes such as javascript:,
// data:, file:, blob: and custom protocols are rejected rather than passed to
// an anchor or window.open.
export function getSafeHttpUrl(href) {
  if (!href || typeof href !== 'string') return null;
  try {
    const url = new URL(href, window.location.origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

export function confirmExternalLink(url) {
  const safe = getSafeHttpUrl(url);
  if (!safe) return false;
  pendingUrl = safe;
  listeners.forEach((l) => l(pendingUrl));
  return true;
}

export function subscribeExternalLink(listener) {
  listeners.add(listener);
  if (pendingUrl !== null) listener(pendingUrl);
  return () => listeners.delete(listener);
}

export function clearExternalLink() {
  pendingUrl = null;
  listeners.forEach((l) => l(null));
}

// Returns true if the given href points outside the current app origin.
export function isExternalUrl(href) {
  const safe = getSafeHttpUrl(href);
  // Treat unsafe schemes as external so existing renderers suppress their href
  // and route them through confirmExternalLink, which rejects them.
  if (!safe) return true;
  return new URL(safe).origin !== window.location.origin;
}