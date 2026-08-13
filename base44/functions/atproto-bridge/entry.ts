// atproto-bridge — writes and deletes records on a real AT Protocol PDS via XRPC.
//
// Uses a shared bridge PDS account (PDS_URL, PDS_IDENTIFIER, PDS_APP_PASSWORD
// secrets) so SwapPulse posts/follows/likes are mirrored onto the federated
// network as real app.bsky.* records, and deletions propagate too.
//
// Actions:
//   create (default): { collection, record } → { uri, cid, did }
//   delete:          { action: 'delete', uri } → { ok, deleted }
//
// Callers update the local entity's at_uri + cid with the real values on
// create, and delete the local record on delete. If the PDS is unreachable
// the call errors (non-fatal — the local record still persists).

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

async function pdsRequest(pdsUrl: string, accessJwt: string, endpoint: string, payload: object) {
  const res = await fetch(`${pdsUrl}/xrpc/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessJwt}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    return { error: true, status: res.status, body };
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, collection, record, uri } = body;

    // --- delete action ---
    if (action === 'delete') {
      if (!uri || typeof uri !== 'string') {
        return Response.json({ error: 'uri is required for delete' }, { status: 400 });
      }
      // at://did:plc:abc/app.bsky.graph.follow/rkey → strip prefix, then [did, collection, rkey]
      const segs = uri.replace(/^at:\/\//, '').split('/');
      const collectionFromUri = segs[1];
      const rkey = segs[2];
      if (!rkey || !collectionFromUri) {
        return Response.json({ error: 'could not parse rkey/collection from uri' }, { status: 400 });
      }
      const { pdsUrl, session } = await getSession();
      let result: any = await pdsRequest(
        pdsUrl, session.accessJwt, 'com.atproto.repo.deleteRecord',
        { repo: session.did, collection: collectionFromUri, rkey },
      );
      if (result?.error && result.status === 401) {
        cachedSession = null;
        const fresh = await getSession();
        result = await pdsRequest(
          fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.deleteRecord',
          { repo: fresh.session.did, collection: collectionFromUri, rkey },
        );
      }
      if (result?.error) {
        // 404 = already gone; treat as success
        if (result.status === 404) return Response.json({ ok: true, deleted: true });
        console.error('atproto-bridge: deleteRecord failed', result.status, result.body);
        return Response.json({ error: `deleteRecord failed (${result.status})` }, { status: 502 });
      }
      return Response.json({ ok: true, deleted: true });
    }

    // --- create action (default) ---
    if (!collection || !record) {
      return Response.json({ error: 'collection and record are required' }, { status: 400 });
    }
    const { pdsUrl, session } = await getSession();
    let result: any = await pdsRequest(
      pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord',
      { repo: session.did, collection, record },
    );
    if (result?.error && result.status === 401) {
      cachedSession = null;
      const fresh = await getSession();
      result = await pdsRequest(
        fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.createRecord',
        { repo: fresh.session.did, collection, record },
      );
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