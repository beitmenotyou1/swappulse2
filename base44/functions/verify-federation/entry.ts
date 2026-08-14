// verify-federation — admin-triggered end-to-end check that the current PDS
// cutover is working. Picks the first user provisioned on the current PDS and:
//   1. Resolves their handle via the public AppView (public.api.bsky.app) —
//      confirms the handle + DID are discoverable on the federated network.
//   2. Lists their posts from the current PDS — confirms records are actually
//      written to the new PDS repo.
// Returns { ok, handle, did, handleResolved, postsOnPds, pdsUrl }.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const APPVIEW = 'https://public.api.bsky.app';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });

    const svc = base44.asServiceRole;

    // Find the first user provisioned on the current PDS
    const creds = await svc.entities.PdsCredential
      .filter({ pds_url: pdsUrl }, '-created_date', 1).catch(() => []);
    if (!creds || creds.length === 0) {
      return Response.json({
        ok: false,
        message: 'No users provisioned on the current PDS yet. Run "Provision all identities" first.',
      });
    }
    const cred = creds[0];
    const u = await svc.entities.User.get(cred.user_id).catch(() => null);
    const handle = u?.bsky_handle || '';
    const did = cred.did;

    // 1. Resolve handle via the public AppView
    let handleResolved = false;
    let resolvedDid = '';
    if (handle) {
      try {
        const res = await fetch(`${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
        if (res.ok) {
          const data = await res.json();
          resolvedDid = data.did || '';
          handleResolved = resolvedDid === did;
        }
      } catch (e) {
        console.error('verify-federation: resolveHandle failed', e?.message || e);
      }
    }

    // 2. List posts from the current PDS for this user
    let postsOnPds = 0;
    try {
      const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=app.bsky.feed.post&limit=50`);
      if (res.ok) {
        const data = await res.json();
        postsOnPds = (data.records || []).length;
      }
    } catch (e) {
      console.error('verify-federation: listRecords failed', e?.message || e);
    }

    return Response.json({
      ok: handleResolved || postsOnPds > 0,
      handle,
      did,
      handleResolved,
      resolvedDid,
      postsOnPds,
      pdsUrl,
    });
  } catch (error) {
    console.error('verify-federation error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}