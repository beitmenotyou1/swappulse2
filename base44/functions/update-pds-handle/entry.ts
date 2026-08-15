// update-pds-handle — after a user verifies ownership of a custom domain
// (DNS TXT record or well-known file via verifyHandleClaim), updates their
// PDS account's handle to that domain through com.atproto.identity.updateHandle.
// The PDS re-verifies the handle resolves to the user's DID, then updates the
// PLC directory entry so the new handle is discoverable across the wider AT
// Protocol (bsky.app, etc.). Also persists the new handle on the User record
// (bsky_handle) so profile headers and Bluesky links reflect it immediately.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const handle = String(body.handle || body.domain || '').trim().toLowerCase();
    if (!handle) return Response.json({ error: 'handle is required' }, { status: 400 });

    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });

    if (!user.did || !user.did.startsWith('did:plc:')) {
      return Response.json({
        error: 'No federated identity yet. Your account is provisioned on login — try again in a moment.',
      }, { status: 400 });
    }

    const creds = await base44.asServiceRole.entities.PdsCredential
      .filter({ user_id: user.id }).catch(() => []);
    if (!creds || creds.length === 0) {
      return Response.json({ error: 'No PDS credential found. Re-link your Bluesky account.' }, { status: 400 });
    }
    const cred = creds[0];

    const { session } = await getPdsSessionForUser(pdsUrl, user.did, cred.app_password);

    // The PDS verifies the new handle resolves to the user's DID (DNS TXT or
    // well-known), then updates the PLC directory entry.
    const res = await pdsRequest(pdsUrl, session.accessJwt, 'com.atproto.identity.updateHandle', {
      handle,
    });
    if (res?.error) {
      const errBody = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
      console.error('update-pds-handle: PDS rejected', res.status, errBody);
      return Response.json({
        error: `PDS rejected handle update (${res.status}). Ensure the DNS TXT record _atproto.${handle} is published with did=${user.did} and has propagated.`,
        pdsError: errBody.slice(0, 300),
      }, { status: 400 });
    }

    // Persist the new handle on the User record so profile headers and Bluesky
    // links reflect it immediately.
    await base44.asServiceRole.entities.User.update(user.id, {
      bsky_handle: handle,
    }).catch(() => {});

    return Response.json({ ok: true, handle, did: user.did });
  } catch (error) {
    console.error('update-pds-handle error:', error?.message || error);
    return Response.json({ error: error?.message || 'Failed to update handle' }, { status: 500 });
  }
}