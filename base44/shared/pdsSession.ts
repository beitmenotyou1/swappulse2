// Shared PDS session management for AT Protocol bridge functions.
// Authenticates to the configured PDS (PDS_URL, PDS_IDENTIFIER, PDS_APP_PASSWORD
// secrets) and caches the session. Used by atproto-bridge (create/delete/update
// records) and get-portable-reputation (list records) so both share one auth
// implementation instead of duplicating createSession logic.

let cachedSession: { accessJwt: string; refreshJwt: string; did: string; handle: string; expiresAt: number } | null = null;

export async function getPdsSession() {
  const pdsUrl = Deno.env.get('PDS_URL');
  const identifier = Deno.env.get('PDS_IDENTIFIER');
  const password = Deno.env.get('PDS_APP_PASSWORD');
  if (!pdsUrl || !identifier || !password) {
    throw new Error('PDS not configured. Set PDS_URL, PDS_IDENTIFIER, PDS_APP_PASSWORD secrets.');
  }

  if (cachedSession && Date.now() < cachedSession.expiresAt) {
    return { pdsUrl, session: cachedSession };
  }

  if (cachedSession?.refreshJwt) {
    try {
      const refreshRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cachedSession.refreshJwt}` },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        cachedSession = {
          accessJwt: data.accessJwt,
          refreshJwt: data.refreshJwt || cachedSession.refreshJwt,
          did: data.did || cachedSession.did,
          handle: data.handle || cachedSession.handle,
          expiresAt: Date.now() + 25 * 60 * 1000,
        };
        return { pdsUrl, session: cachedSession };
      }
    } catch (e) {
      console.error('pdsSession: refreshSession error', e?.message);
    }
  }

  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PDS createSession failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  cachedSession = {
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
    did: data.did,
    handle: data.handle,
    expiresAt: Date.now() + 25 * 60 * 1000,
  };
  return { pdsUrl, session: cachedSession };
}

// Per-user session cache: did → session. Used when the bridge writes records
// to a user's own PDS repo (real DIDs) instead of the shared account repo.
const userSessions = new Map<string, { accessJwt: string; refreshJwt: string; did: string; handle: string; expiresAt: number }>();

// Get a PDS session for a specific user, authenticated with their app password.
// Used by the atproto-bridge when a user has a real PDS-backed DID + app password.
export async function getPdsSessionForUser(pdsUrl: string, userDid: string, appPassword: string) {
  const cacheKey = userDid;
  const cached = userSessions.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { pdsUrl, session: cached };
  }

  // Try refresh first
  if (cached?.refreshJwt) {
    try {
      const refreshRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cached.refreshJwt}` },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        const session = {
          accessJwt: data.accessJwt,
          refreshJwt: data.refreshJwt || cached.refreshJwt,
          did: data.did || cached.did,
          handle: data.handle || cached.handle,
          expiresAt: Date.now() + 25 * 60 * 1000,
        };
        userSessions.set(cacheKey, session);
        return { pdsUrl, session };
      }
    } catch (e) {
      console.error('pdsSession: user refreshSession error', e?.message);
    }
  }

  // Create a new session with the user's app password
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: userDid, password: appPassword }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PDS createSession (user) failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const session = {
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
    did: data.did,
    handle: data.handle,
    expiresAt: Date.now() + 25 * 60 * 1000,
  };
  userSessions.set(cacheKey, session);
  return { pdsUrl, session };
}

export function clearPdsSession() {
  cachedSession = null;
  userSessions.clear();
}

export async function pdsRequest(pdsUrl: string, accessJwt: string, endpoint: string, payload: object) {
  const res = await fetch(`${pdsUrl}/xrpc/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessJwt}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    return { error: true, status: res.status, body };
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}