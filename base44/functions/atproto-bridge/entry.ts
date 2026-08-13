// atproto-bridge — writes records to a real AT Protocol PDS via XRPC.
//
// Uses a shared bridge PDS account (PDS_URL, PDS_IDENTIFIER, PDS_APP_PASSWORD
// secrets) so SwapPulse posts/follows are mirrored onto the federated network
// as real app.bsky.feed.post / app.bsky.graph.follow records.
//
// Returns { uri, cid, did } — the authoritative at:// URI, content ID, and the
// bridge account's DID. Callers update the local entity's at_uri + cid with
// these real values. If the PDS is not configured or unreachable, the call
// errors (non-fatal — the local record still persists with simulated values).

let cachedSession: { accessJwt: string; did: string; handle: string; expiresAt: number } | null = null;

async function getSession() {
  const pdsUrl = Deno.env.get('PDS_URL');
  const identifier = Deno.env.get('PDS_IDENTIFIER');
  const password = Deno.env.get('PDS_APP_PASSWORD');
  if (!pdsUrl || !identifier || !password) {
    throw new Error('PDS not configured. Set PDS_URL, PDS_IDENTIFIER, PDS_APP_PASSWORD secrets.');
  }
  if (cachedSession && Date.now() < cachedSession.expiresAt) {
    return { pdsUrl, session: cachedSession };
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
    did: data.did,
    handle: data.handle,
    // accessJwt lasts ~30 min; refresh well before expiry
    expiresAt: Date.now() + 25 * 60 * 1000,
  };
  return { pdsUrl, session: cachedSession };
}

async function createRecord(pdsUrl: string, accessJwt: string, repo: string, collection: string, record: object) {
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({ repo, collection, record }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { error: true, status: res.status, body };
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { collection, record } = body;
    if (!collection || !record) {
      return Response.json({ error: 'collection and record are required' }, { status: 400 });
    }

    const { pdsUrl, session } = await getSession();
    let result: any = await createRecord(pdsUrl, session.accessJwt, session.did, collection, record);

    // Token expired — refresh session and retry once.
    if (result?.error && result.status === 401) {
      cachedSession = null;
      const fresh = await getSession();
      result = await createRecord(fresh.pdsUrl, fresh.session.accessJwt, fresh.session.did, collection, record);
    }

    if (result?.error) {
      console.error('atproto-bridge: createRecord failed', result.status, result.body);
      return Response.json({ error: `createRecord failed (${result.status})` }, { status: 502 });
    }

    return Response.json({ uri: result.uri, cid: result.cid, did: session.did });
  } catch (error) {
    console.error('atproto-bridge error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});