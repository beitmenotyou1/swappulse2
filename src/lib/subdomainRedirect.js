// Detects collector subdomains (e.g. john.swappulse.org) and redirects to the
// matching collector's profile. Requires a DNS wildcard so *.swappulse.org
// resolves to this app; this module only handles the in-app routing half.
//
// Reserved subdomains (explorer, status, api, etc.) are NOT treated as
// collector handles — they either serve their own content via slash URLs
// (e.g. /pulse-explorer) or are handled by the platform's custom domain
// system. Only non-reserved single-label subdomains redirect to /u/{handle}.
const RESERVED_SUBDOMAINS = new Set([
  'www', 'explorer', 'status', 'api', 'admin', 'mail', 'docs',
  'blog', 'app', 'staging', 'dev', 'test', 'localhost',
]);

export function handleSubdomainRedirect() {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname.toLowerCase();
  const SUFFIX = '.swappulse.org';
  if (!host.endsWith(SUFFIX)) return;
  if (host === 'www' + SUFFIX || host === 'swappulse.org') return;
  const handle = host.slice(0, -SUFFIX.length);
  if (!handle || handle.includes('.') || handle.includes('/')) return;
  // Skip reserved subdomains — they are not collector handles.
  if (RESERVED_SUBDOMAINS.has(handle)) return;
  // Only redirect when landed at the site root, to avoid loops once routed.
  if (window.location.pathname !== '/' && window.location.pathname !== '') return;
  window.location.replace(`/u/${handle}`);
}