// provision-did — creates a real AT Protocol account on the configured PDS for
// a user, returning a genuine did:plc DID and a persistent app password for
// per-user PDS sessions. Called at registration to replace simulated DIDs.
//
// Flow:
//   1. Call com.atproto.server.createAccount on the PDS with the user's email,
//      a generated handle, and a generated password.
//   2. If successful, call com.atproto.server.createAppPassword to get a
//      persistent app password for future bridge sessions.
//   3. Return { did, handle, appPassword } so the caller can persist them on
//      the user record.
//
// If the PDS doesn't support account creation (invite codes required, etc.),
// the function returns an error and the caller falls back to a simulated DID.
//
// Input:  { email, handle }  — email + desired handle (without domain)
// Output: { did, handle, appPassword }  or  { error, fallback: true }

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

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || user.email || '').trim().toLowerCase();
    const handleInput = String(body.handle || '').trim().toLowerCase();

    if (!email) return Response.json({ error: 'email required' }, { status: 400 });

    // If the user already has a real DID, return it
    if (user.did && user.did.startsWith('did:plc:')) {
      return Response.json({ did: user.did, handle: user.custom_handle || handleInput, already_provisioned: true });
    }

    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      return Response.json({ error: 'PDS_URL not configured', fallback: true }, { status: 502 });
    }

    // Derive a handle — use the user's chosen handle + the PDS domain, or a
    // generated handle from the user id.
    const pdsHost = new URL(pdsUrl).hostname;
    const handle = handleInput
      ? `${handleInput.replace(/[^a-z0-9-]/g, '')}.${pdsHost}`
      : `user${user.id.replace(/-/g, '').slice(0, 8)}.${pdsHost}`;

    const password = generatePassword();

    // Step 1: Create the account on the PDS
    const createRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createAccount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, email, password }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error('provision-did: createAccount failed', createRes.status, errBody);
      // Fail gracefully — caller falls back to simulated DID
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
        const appData = await appRes.json();
        appPassword = appData.password || '';
      } else {
        console.error('provision-did: createAppPassword failed', appRes.status, await appRes.text());
      }
    } catch (e) {
      console.error('provision-did: createAppPassword error', e?.message || e);
    }

    // Step 3: Persist the DID + app password on the user record
    const updateData: any = { did };
    if (appPassword) updateData.pds_app_password = appPassword;
    if (handle) updateData.pds_handle = handle;
    await base44.auth.updateMe(updateData);

    return Response.json({ did, handle, appPassword, provisioned: true });
  } catch (error) {
    console.error('provision-did error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error', fallback: true }, { status: 500 });
  }
}