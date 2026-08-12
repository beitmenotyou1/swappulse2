// Deep link parser — parses a route string from a push notification payload
// into a React Router path. Used by NotificationHandler and InAppBanner to
// navigate when a notification is tapped. The route strings are built
// server-side by deepLinkRoutes.ts ROUTE_MAP (e.g. "/trades", "/card/abc123").

export function parseDeepLink(route) {
  if (!route || typeof route !== 'string') return { path: '/notifications', query: {} };
  let path = route;
  // Strip query string
  let query = {};
  const qIdx = path.indexOf('?');
  if (qIdx !== -1) {
    const qs = path.slice(qIdx + 1);
    path = path.slice(0, qIdx);
    try { query = Object.fromEntries(new URLSearchParams(qs)); } catch {}
  }
  // Strip protocol/host if full URL
  if (path.startsWith('http')) {
    try { path = new URL(path).pathname; } catch {}
  }
  // Ensure leading slash
  if (!path.startsWith('/')) path = '/' + path;
  return { path, query };
}

export function navigateFromDeepLink(navigate, route) {
  if (!navigate) return;
  const { path, query } = parseDeepLink(route);
  const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
  navigate(path + qs);
}