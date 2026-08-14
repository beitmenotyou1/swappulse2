// provision-did — creates a real AT Protocol account on the configured PDS for
// a user, returning a genuine did:plc DID and persisting the app password in a
// server-side PdsCredential record (never on the User entity, never returned to
// the client).
//
// Flow:
//   1. If the user already has a PdsCredential, return { did, already_provisioned }.
//   2. Otherwise, call com.atproto.server.createAccount on the PDS with the
//      user's email, a generated handle, and a generated password.
//   3. Call com.atproto.server.createAppPassword to get a persistent app password.
//   4. Persist { user_id, did, pds_url, app_password } in PdsCredential (service role).
//   5. Call updateMe({ did }) so the User record carries the did:plc.
//   6. Return { did, handle, provisioned } — app_password is NOT returned.
//
// For users who already have a did:plc on their User record but no PdsCredential
// (the app password was lost because the User entity had no field to store it),
// a NEW PDS account is created (the old one is inaccessible and has no real
// content since resolveSession always fell back to the shared bridge account).
//
// Input:  { email, handle }  — optional overrides; defaults from user record
// Output: { did, handle, provisioned } or { did, already_provisioned }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function generatePassword(len = 24): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      return Response.json({ error: 'PDS_URL not configured', fallback: true }, { status: 502 });
    }

    // If the user already has a credential, return it
    const existing = await base44.asServiceRole.entities.PdsCredential
      .filter({ user_id: user.id }).catch(() => []);
    if (existing && existing.length > 0) {
      return Response.json({ did: existing[0].did, already_provisioned: true });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || user.email || '').trim().toLowerCase();
    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

    // Generate a unique handle — add a short random suffix to avoid conflicts
    // with any old orphaned PDS account from a previous provisioning attempt.
    const pdsHost = new URL(pdsUrl).hostname;
    const baseHandle = String(body.handle || user.username || `user${user.id.replace(/-/g, '').slice(0, 8)}`)
      .toLowerCase().replace(/[^a-z0-9-]/g, '');
    const suffix = Math.random().toString(36).slice(2, 6);
    const handle = `${baseHandle}${suffix}.${pdsHost}`;

    const password = generatePassword();

    // Step 1a: Fetch a one-use invite code via the admin API. The PDS rejects
    // createAccount without either phone verification or an invite code; the
    // admin-issued invite code bypasses phone verification (same pattern as
    // the official pdsadmin account-create script). If PDS_ADMIN_PASSWORD is
    // not set, fall back to the shared bridge account.
    const adminPassword = Deno.env.get('PDS_ADMIN_PASSWORD');
    let inviteCode = '';
    if (adminPassword) {
      try {
        const invRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createInviteCode`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`admin:${adminPassword}`)}`,
          },
          body: JSON.stringify({ useCount: 1 }),
        });
        if (invRes.ok) {
          inviteCode = (await invRes.json()).code || '';
        } else {
          console.error('provision-did: createInviteCode failed', invRes.status, await invRes.text());
        }
      } catch (e) {
        console.error('provision-did: createInviteCode error', e?.message || e);
      }
    } else {
      console.warn('provision-did: PDS_ADMIN_PASSWORD not set — createAccount will likely fail without an invite code');
    }

    // Step 1b: Create the account on the PDS
    const createBody: Record<string, string> = { handle, email, password };
    if (inviteCode) createBody.inviteCode = inviteCode;
    const createRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAccount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error('provision-did: createAccount failed', createRes.status, errBody);
      return Response.json({
        error: `createAccount failed (${createRes.status})`,
        details: errBody,
        fallback: true,
      }, { status: 502 });
    }

    const createData = await createRes.json();
    const did = createData.did;
    const accessJwt = createData.accessJwt;

    if (!did || !accessJwt) {
      console.error('provision-did: createAccount returned no did/accessJwt', createData);
      return Response.json({ error: 'createAccount returned incomplete data', fallback: true }, { status: 502 });
    }

    // Step 2: Create a persistent app password for future bridge sessions
    let appPassword = '';
    try {
      const appRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAppPassword`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessJwt}`,
        },
        body: JSON.stringify({ name: 'swappulse-bridge' }),
      });
      if (appRes.ok) {
        appPassword = (await appRes.json()).password || '';
      } else {
        console.error('provision-did: createAppPassword failed', appRes.status, await appRes.text());
      }
    } catch (e) {
      console.error('provision-did: createAppPassword error', e?.message || e);
    }

    // Step 3: Persist the did:plc on the User record (needed by resolveSession)
    await base44.auth.updateMe({ did });

    // Step 4: Store the app password in PdsCredential (service role bypasses RLS)
    await base44.asServiceRole.entities.PdsCredential.create({
      user_id: user.id,
      did,
      pds_url: pdsUrl,
      app_password: appPassword,
    });

    return Response.json({ did, handle, provisioned: true });
  } catch (error) {
    console.error('provision-did error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error', fallback: true }, { status: 500 });
  }
}