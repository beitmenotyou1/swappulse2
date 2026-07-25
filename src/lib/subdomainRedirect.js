// Detects collector subdomains (e.g. john.swappulse.org) and redirects to the
// matching collector's profile. Requires a DNS wildcard so *.swappulse.org
// resolves to this app; this module only handles the in-app routing half.
export function handleSubdomainRedirect() {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname.toLowerCase();
  const SUFFIX = '.swappulse.org';
  if (!host.endsWith(SUFFIX)) return;
  if (host === 'www' + SUFFIX || host === 'swappulse.org') return;
  const handle = host.slice(0, -SUFFIX.length);
  if (!handle || handle.includes('.') || handle.includes('/')) return;
  // Only redirect when landed at the site root, to avoid loops once routed.
  if (window.location.pathname !== '/' && window.location.pathname !== '') return;
  window.location.replace(`/u/${handle}`);
}