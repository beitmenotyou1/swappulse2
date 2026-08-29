import { safeInternalPath } from '@/lib/safeNavigation';

// Deep link parser — parses a route string from a push notification payload
// into a React Router path. Used by NotificationHandler and InAppBanner to
// navigate when a notification is tapped. The route strings are built
// server-side by deepLinkRoutes.ts ROUTE_MAP (e.g. "/trades", "/card/abc123").

export function parseDeepLink(route) {
  if (!route || typeof route !== 'string') return { path: '/notifications', query: {} };
  const safe = safeInternalPath(route, '/notifications');
  try {
    const url = new URL(safe, typeof window !== 'undefined' ? window.location.origin : 'https://swappulse.invalid');
    return { path: url.pathname, query: Object.fromEntries(url.searchParams) };
  } catch {
    return { path: '/notifications', query: {} };
  }
}

export function navigateFromDeepLink(navigate, route) {
  if (!navigate) return;
  const { path, query } = parseDeepLink(route);
  const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
  navigate(path + qs);
}