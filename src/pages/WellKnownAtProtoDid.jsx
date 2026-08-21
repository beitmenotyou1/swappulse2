import React, { useEffect, useState } from 'react';

// WellKnownAtProtoDid — serves the user's DID at /.well-known/atproto-did so
// the PDS can verify handle ownership for username.swappulse.org handles.
// When the PDS receives a com.atproto.identity.updateHandle request, it
// fetches https://<handle>/.well-known/atproto-did and checks the body matches
// the user's DID. With wildcard DNS (*.swappulse.org → app), this route
// resolves any subdomain to the correct DID.
//
// The page reads the host from window.location to determine the requested
// handle, then calls the resolve-atproto-actor backend function to look up
// the DID. The response is rendered as plain text (no HTML wrapper) so the
// PDS can parse it directly.

export default function WellKnownAtProtoDid() {
  const [did, setDid] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // The handle is the full host (e.g. alice.swappulse.org).
        const handle = window.location.hostname;
        if (!handle) {
          if (alive) setError('no handle');
          return;
        }
        // Look up the DID for this handle via the resolve-atproto-actor
        // backend function, which queries the PLC directory.
        const { base44 } = await import('@/api/base44Client');
        const res = await base44.functions.invoke('resolve-atproto-actor', { handle });
        const data = res?.data ?? res;
        const resolvedDid = data?.did || '';
        if (alive) {
          if (resolvedDid) {
            setDid(resolvedDid);
          } else {
            setError('not found');
          }
        }
      } catch (e) {
        if (alive) setError(e?.message || 'lookup failed');
      }
    })();
    return () => { alive = false; };
  }, []);

  // Render as minimal plain text — the PDS reads the raw body.
  if (error) return <>{error}</>;
  if (!did) return null;
  return <>{did}</>;
}