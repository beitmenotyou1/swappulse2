// Module-level external link confirmation store. Any component can call
// confirmExternalLink(url) to trigger the shared dialog (mounted once at the
// app root). Keeps a single source of truth so every surface (posts, comments,
// bios, journals) uses the same leave-site confirmation behaviour.

const listeners = new Set();
let pendingUrl = null;

export function confirmExternalLink(url) {
  pendingUrl = url;
  listeners.forEach((l) => l(pendingUrl));
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
  if (!href) return false;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}