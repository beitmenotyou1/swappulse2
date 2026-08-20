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
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // Security: PDS migration transmits the system PDS access token to the
    // target PDS. Restrict to admins — a regular user could otherwise point
    // newPdsUrl at an attacker-controlled origin and exfiltrate the system
    // token. Admins are trusted operators who configure legitimate targets.
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required for PDS migration' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { newPdsUrl } = body;
    if (!newPdsUrl || typeof newPdsUrl !== 'string') {
      return Response.json({ error: 'newPdsUrl is required' }, { status: 400 });
    }
    if (!newPdsUrl.startsWith('https://')) {
      return Response.json({ error: 'newPdsUrl must be a valid HTTPS URL' }, { status: 400 });
    }
    // SSRF guard: reject localhost / private / link-local / loopback ranges
    // so the system token is never sent to an internal or attacker-local
    // endpoint even by a compromised admin.
    const parsed = (() => { try { return new URL(newPdsUrl); } catch { return null; } })();
    if (!parsed) {
      return Response.json({ error: 'newPdsUrl must be a valid HTTPS URL' }, { status: 400 });
    }
    const host = parsed.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
    if (blockedHosts.includes(host) || host.endsWith('.local') || host.endsWith('.internal')) {
      return Response.json({ error: 'newPdsUrl must not point to a local or internal address' }, { status: 400 });
    }
    // Reject obvious private IPv4 ranges (10.x, 172.16-31.x, 192.168.x).
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [a, b] = [parseInt(ipv4Match[1]), parseInt(ipv4Match[2])];
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127) {
        return Response.json({ error: 'newPdsUrl must not point to a private address' }, { status: 400 });
      }
    }

    const pdsUrl = Deno.env.get('PDS_URL');
    // Security: PDS migration transmits the system PDS access token to the
    // target URL. Restrict newPdsUrl to a strict allowlist of trusted PDS
    // hosts so a compromised admin cannot exfiltrate the token to an
    // arbitrary attacker-controlled origin. The allowlist always includes
    // the official Bluesky PDS and this app's own PDS host; it can be
    // extended via the TRUSTED_PDS_HOSTS env var (comma-separated).
    const trustedHosts = new Set<string>(['bsky.social', 'pds.bsky.app']);
    const currentPdsHost = (() => { try { return new URL(pdsUrl || '').hostname.toLowerCase(); } catch { return ''; } })();
    if (currentPdsHost) trustedHosts.add(currentPdsHost);
    const extra = Deno.env.get('TRUSTED_PDS_HOSTS');
    if (extra) {
      extra.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean).forEach((h) => trustedHosts.add(h));
    }
    if (!trustedHosts.has(host)) {
      return Response.json({ error: 'newPdsUrl host is not a trusted PDS provider' }, { status: 400 });
    }
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