// migrate-pds — initiates a PDS migration for the current user.
//
// Exports the user's repo from the current bridge PDS as a CAR file via
// com.atproto.sync.getRepo, imports it to the new PDS via
// com.atproto.repo.importRepo, and updates the user's local pds_url field.
//
// In production, full PDS migration also requires updating the PLC directory
// and DNS records. This function handles the repo transfer; the user must
// complete the DID/plc update separately.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { newPdsUrl } = body;
    if (!newPdsUrl || typeof newPdsUrl !== 'string') {
      return Response.json({ error: 'newPdsUrl is required' }, { status: 400 });
    }
    if (!newPdsUrl.startsWith('https://')) {
      return Response.json({ error: 'newPdsUrl must be a valid HTTPS URL' }, { status: 400 });
    }

    const pdsUrl = Deno.env.get('PDS_URL');
    const identifier = Deno.env.get('PDS_IDENTIFIER');
    const password = Deno.env.get('PDS_APP_PASSWORD');
    if (!pdsUrl || !identifier || !password) {
      return Response.json({ error: 'PDS not configured' }, { status: 500 });
    }

    // Authenticate with the current bridge PDS
    const sessionRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    if (!sessionRes.ok) {
      const errBody = await sessionRes.text();
      console.error('[migrate-pds] createSession failed', sessionRes.status, errBody);
      return Response.json({ error: `PDS auth failed (${sessionRes.status})` }, { status: 502 });
    }
    const session = await sessionRes.json();
    const userDid = (user as any).did || session.did;

    // Export the user's repo as a CAR file from the current PDS
    const exportUrl = `${pdsUrl}/xrpc/com.atproto.sync.getRepo?did=${encodeURIComponent(userDid)}`;
    const exportRes = await fetch(exportUrl, {
      headers: { 'Authorization': `Bearer ${session.accessJwt}` },
    });
    if (!exportRes.ok) {
      const errBody = await exportRes.text();
      console.error('[migrate-pds] getRepo failed', exportRes.status, errBody);
      return Response.json({ error: `Repo export failed (${exportRes.status})` }, { status: 502 });
    }
    const repoBytes = await exportRes.arrayBuffer();

    // Import the repo to the new PDS
    const importRes = await fetch(`${newPdsUrl}/xrpc/com.atproto.repo.importRepo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessJwt}`,
        'Content-Type': 'application/vnd.ipld.car',
      },
      body: repoBytes,
    });
    if (!importRes.ok) {
      const errBody = await importRes.text();
      console.error('[migrate-pds] importRepo failed', importRes.status, errBody);
      return Response.json({ error: `Import to new PDS failed (${importRes.status}): ${errBody}` }, { status: 502 });
    }

    // Update the user's local PDS URL
    await base44.auth.updateMe({ pds_url: newPdsUrl });

    console.log(`[migrate-pds] user ${user.id} migrated to ${newPdsUrl}`);
    return Response.json({
      ok: true,
      migrated: true,
      newPdsUrl,
      message: 'Repository transferred to new PDS. Update your PLC directory entry to complete the migration.',
    });
  } catch (error) {
    console.error('[migrate-pds] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}