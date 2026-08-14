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

import { getPdsSession, getPdsSessionForUser, clearPdsSession, pdsRequest } from '../../shared/pdsSession.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Resolve the PDS session to use for this request. If the calling user has a
// real PDS-backed did:plc + a stored PdsCredential, use a per-user session
// (writes to the user's own repo). If the user has no did:plc, auto-provision
// one via provision-did before proceeding. Falls back to the shared bridge
// account only if per-user auth fails (e.g. PDS unreachable, no credential).
async function resolveSession(req: Request) {
  const pdsUrl = Deno.env.get('PDS_URL');
  if (!pdsUrl) throw new Error('PDS_URL not configured');

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.did?.startsWith('did:plc:')) {
      // Look up the per-user credential from the server-side store. Users
      // get a PdsCredential by linking a Bluesky account in Settings; until
      // then they fall through to the shared bridge session below.
      const creds = await base44.asServiceRole.entities.PdsCredential
        .filter({ user_id: user.id }).catch(() => []);
      if (creds && creds.length > 0 && creds[0].app_password) {
        try {
          return await getPdsSessionForUser(pdsUrl, user.did, creds[0].app_password);
        } catch (e) {
          console.error('atproto-bridge: per-user session failed, falling back to shared', e?.message || e);
        }
      }
    }
  } catch {
    // No auth context (e.g. workflow call) — use shared session
  }

  return getPdsSession();
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, collection, record, uri } = body;

    // Gate moderation-sensitive actions. emitLabels is admin-only (moderation
    // power). delete/update require an authenticated caller so the shared
    // bridge session can't be abused by unauthenticated requests.
    if (action === 'emitLabels' || action === 'delete' || action === 'update') {
      const base44Auth = createClientFromRequest(req);
      let caller: any;
      try { caller = await base44Auth.auth.me(); } catch { caller = null; }
      if (!caller) return Response.json({ error: 'Authentication required' }, { status: 401 });
      if (action === 'emitLabels' && caller.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    }

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
      const { pdsUrl, session } = await resolveSession(req);
      let result: any = await pdsRequest(
        pdsUrl, session.accessJwt, 'com.atproto.repo.deleteRecord',
        { repo: session.did, collection: collectionFromUri, rkey },
      );
      if (result?.error && result.status === 401) {
        clearPdsSession();
        const fresh = await resolveSession(req);
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

    // --- update action (putRecord replaces in place at the same rkey) ---
    if (action === 'update') {
      if (!uri || !collection || !record) {
        return Response.json({ error: 'uri, collection, and record are required for update' }, { status: 400 });
      }
      const segs = uri.replace(/^at:\/\//, '').split('/');
      const rkey = segs[2];
      if (!rkey) {
        return Response.json({ error: 'could not parse rkey from uri' }, { status: 400 });
      }
      const { pdsUrl, session } = await resolveSession(req);
      let result: any = await pdsRequest(
        pdsUrl, session.accessJwt, 'com.atproto.repo.putRecord',
        { repo: session.did, collection, rkey, record },
      );
      if (result?.error && result.status === 401) {
        clearPdsSession();
        const fresh = await resolveSession(req);
        result = await pdsRequest(
          fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.putRecord',
          { repo: fresh.session.did, collection, rkey, record },
        );
      }
      if (result?.error) {
        console.error('atproto-bridge: putRecord failed', result.status, result.body);
        return Response.json({ error: `putRecord failed (${result.status})` }, { status: 502 });
      }
      return Response.json({ uri: result.uri, cid: result.cid, did: session.did });
    }

    // --- emitLabels action (labeler: emit moderation labels to the network) ---
    if (action === 'emitLabels') {
      const { labels } = body;
      if (!Array.isArray(labels) || labels.length === 0) {
        return Response.json({ error: 'labels array is required for emitLabels' }, { status: 400 });
      }
      const { pdsUrl, session } = await resolveSession(req);
      let result: any = await pdsRequest(
        pdsUrl, session.accessJwt, 'com.atproto.label.emitLabels',
        { labels },
      );
      if (result?.error && result.status === 401) {
        clearPdsSession();
        const fresh = await resolveSession(req);
        result = await pdsRequest(
          fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.label.emitLabels',
          { labels },
        );
      }
      if (result?.error) {
        console.error('atproto-bridge: emitLabels failed', result.status, result.body);
        return Response.json({ error: `emitLabels failed (${result.status})` }, { status: 502 });
      }
      return Response.json({ ok: true, emitted: true });
    }

    // --- create action (default) ---
    if (!collection || !record) {
      return Response.json({ error: 'collection and record are required' }, { status: 400 });
    }
    const { pdsUrl, session } = await resolveSession(req);
    let result: any = await pdsRequest(
      pdsUrl, session.accessJwt, 'com.atproto.repo.createRecord',
      { repo: session.did, collection, record },
    );
    if (result?.error && result.status === 401) {
      clearPdsSession();
      const fresh = await resolveSession(req);
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