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
import { attachHashtagFacets } from '../../shared/hashtagFacets.ts';
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

// Security: verify the caller owns the federated record identified by `uri`
// before deleting/updating it on the PDS. Without this, any authenticated user
// could delete or mutate another user's records stored in the shared bridge
// repo. Ownership is proven by a local entity record whose at_uri matches and
// whose created_by_id/did matches the caller. Admins bypass (moderation).
const COLLECTION_ENTITY_MAP: Record<string, string> = {
  'app.bsky.feed.post': 'Post',
  'app.bsky.graph.follow': 'Follow',
  'app.bsky.feed.like': 'Like',
  'app.bsky.feed.repost': 'Repost',
  'org.swappulse.conversation': 'Conversation',
  'org.swappulse.directMessage': 'DirectMessage',
  'org.swappulse.voiceSpace': 'VoiceSpace',
  'org.swappulse.podcastEpisode': 'PodcastEpisode',
  'org.swappulse.tradeListing': 'TradeListing',
  'org.swappulse.binder': 'Binder',
  'org.swappulse.journal': 'Journal',
  'org.swappulse.cardReview': 'CardReview',
  'org.swappulse.meetup': 'Meetup',
  'org.swappulse.circle': 'Circle',
  'org.swappulse.reaction': 'Reaction',
  'org.swappulse.vouch': 'Vouch',
};

async function verifyOwnership(base44: any, caller: any, uri: string, collection: string): Promise<boolean> {
  if (caller?.role === 'admin') return true;
  const entityName = COLLECTION_ENTITY_MAP[collection];
  if (!entityName) return false; // unknown collection — fail closed
  try {
    const matches = await base44.asServiceRole.entities[entityName]
      .filter({ at_uri: uri }, '-created_date', 1).catch(() => []);
    const rec = matches?.[0];
    if (!rec) return false; // no local record — fail closed
    const ownsByCreator = !!rec.created_by_id && rec.created_by_id === caller.id;
    const ownsByDid = !!rec.did && !!caller.did && rec.did === caller.did;
    return ownsByCreator || ownsByDid;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, collection, record, uri } = body;

    // Every action writes to or deletes from the PDS, so every action requires
    // an authenticated caller — the shared bridge session must never be usable
    // by unauthenticated requests. emitLabels additionally requires an admin.
    const base44Auth = createClientFromRequest(req);
    let caller: any;
    try { caller = await base44Auth.auth.me(); } catch { caller = null; }
    if (!caller) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (action === 'emitLabels' && caller.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
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
      // Verify the caller owns the target record before deleting on the PDS.
      if (!(await verifyOwnership(base44Auth, caller, uri, collectionFromUri))) {
        return Response.json({ error: 'You can only delete your own records' }, { status: 403 });
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
      const collectionFromUri = segs[1];
      const rkey = segs[2];
      if (!rkey || !collectionFromUri) {
        return Response.json({ error: 'could not parse rkey/collection from uri' }, { status: 400 });
      }
      if (collectionFromUri !== collection) {
        return Response.json({ error: 'collection mismatch with uri' }, { status: 400 });
      }
      // Verify the caller owns the target record before updating on the PDS.
      if (!(await verifyOwnership(base44Auth, caller, uri, collectionFromUri))) {
        return Response.json({ error: 'You can only update your own records' }, { status: 403 });
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

    // --- uploadBlob action (fetch a remote image and upload it to the PDS as a blob) ---
    // Used to attach card images as app.bsky.embed.external thumbnails so posts
    // render as rich link cards on Bluesky. Returns { blob } — the blob ref object
    // to place directly in embed.external.thumb. Best-effort: callers fall back
    // to a thumb-less embed or plain text if this fails.
    if (action === 'uploadBlob') {
      const { imageUrl, mimeType } = body;
      if (!imageUrl || !mimeType) {
        return Response.json({ error: 'imageUrl and mimeType are required for uploadBlob' }, { status: 400 });
      }
      // SSRF protection: only allow https URLs to public, non-internal hosts.
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(imageUrl);
      } catch {
        return Response.json({ error: 'Invalid imageUrl' }, { status: 400 });
      }
      if (parsedUrl.protocol !== 'https:') {
        return Response.json({ error: 'imageUrl must use HTTPS' }, { status: 400 });
      }
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedPatterns = [
        /^127\./, /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./,
        /^169\.254\./, /^0\./, /^localhost$/i, /\.local$/i, /^::1$/, /^fe80:/, /^fc00:/, /^fd00:/,
      ];
      if (blockedPatterns.some(re => re.test(hostname))) {
        return Response.json({ error: 'imageUrl hostname is not allowed' }, { status: 400 });
      }
      const { pdsUrl, session } = await resolveSession(req);
      // SSRF: do NOT follow redirects — an attacker's public HTTPS URL can
      // 302 to an internal/cloud-metadata endpoint, bypassing the hostname
      // blocklist above. Fail the fetch on any redirect instead.
      const imgRes = await fetch(imageUrl, { redirect: 'error' });
      if (!imgRes.ok) {
        console.error('atproto-bridge: image fetch failed', imgRes.status, imageUrl);
        return Response.json({ error: `image fetch failed (${imgRes.status})` }, { status: 502 });
      }
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      const uploadRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          'Authorization': `Bearer ${session.accessJwt}`,
        },
        body: bytes,
      });
      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        console.error('atproto-bridge: uploadBlob failed', uploadRes.status, text.slice(0, 300));
        return Response.json({ error: `uploadBlob failed (${uploadRes.status})` }, { status: 502 });
      }
      const data = await uploadRes.json();
      return Response.json({ blob: data.blob });
    }

    // --- create action (default) ---
    if (!collection || !record) {
      return Response.json({ error: 'collection and record are required' }, { status: 400 });
    }
    // Attach hashtag facets to posts so #hashtags render as clickable,
    // searchable tag links on Bluesky (the `tags` field alone only handles
    // search indexing). Existing caller-provided facets are preserved.
    if (collection === 'app.bsky.feed.post') {
      attachHashtagFacets(record);
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