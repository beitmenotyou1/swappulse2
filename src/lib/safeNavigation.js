// Canonical guard for any route string that originated outside the component
// rendering it (notifications, activity records, push payloads, etc.).
// React Router v6 has published open-redirect issues around backslash paths;
// reject those forms before they ever reach <Link> or navigate().
export function safeInternalPath(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim();
  if (!raw) return fallback;
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  // Relative route tokens are interpreted from the site root, never from the
  // current nested route.
  const candidate = raw.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(raw)
    ? raw
    : `/${raw}`;
  if (candidate.startsWith('//')) return fallback;

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://swappulse.invalid';
    const url = new URL(candidate, origin);
    if (url.origin !== origin) return fallback;
    if (!url.pathname.startsWith('/') || url.pathname.startsWith('//') || url.pathname.includes('\\')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
