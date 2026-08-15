// federation-diagnostics — admin-only, service role. For every provisioned
// user (those with a PdsCredential on the current PDS), checks three things:
//   1. PDS account exists — com.atproto.repo.describeRepo on the PDS for the DID.
//   2. DID in public PLC  — GET https://plc.directory/<did>.
//   3. Handle resolves    — GET https://<handle>/.well-known/atproto-did returns the DID.
// Returns a per-account status array. Status values:
//   ok | handle_mismatch | not_in_plc | no_pds_account | no_credential
// Optional ?userId=<id> restricts to a single account.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const PLC_DIR = 'https://plc.directory';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    const url = new URL(req.url);
    const singleUserId = url.searchParams.get('userId');

    // Map user_id → credential on the current PDS
    const creds = await svc.entities.PdsCredential.list('-created_date', 500).catch(() => []);
    const credByUser = new Map<string, any>();
    for (const c of (creds || [])) {
      if (c.pds_url === pdsUrl) credByUser.set(c.user_id, c);
    }

    const users = await svc.entities.User.list('-created_date', 200);
    const report: any[] = [];

    for (const u of users) {
      if (singleUserId && u.id !== singleUserId) continue;

      const cred = credByUser.get(u.id);
      const did = u.did || cred?.did || '';
      const handle = u.bsky_handle || '';

      if (!cred || !did) {
        report.push({
          userId: u.id, email: u.email,
          username: u.username || u.full_name || '',
          did, handle, status: 'no_credential',
        });
        continue;
      }

      // 1. PDS account exists
      let pdsAccount = false;
      try {
        const r = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`);
        if (r.ok) { const d = await r.json(); pdsAccount = !!d.did; }
      } catch (e) {
        console.error('federation-diagnostics: describeRepo failed', did, e?.message || e);
      }

      // 2. DID registered in the public PLC directory
      let inPlc = false; let plcHandle = ''; let plcPds = '';
      try {
        const r = await fetch(`${PLC_DIR}/${encodeURIComponent(did)}`);
        if (r.ok) {
          const d = await r.json();
          inPlc = true;
          const aka = d.alsoKnownAs?.[0] || '';
          plcHandle = aka.replace('at://', '');
          plcPds = d.service?.endpoint || '';
        }
      } catch (e) {
        console.error('federation-diagnostics: plc lookup failed', did, e?.message || e);
      }

      // 3. Handle resolves via well-known
      let handleResolves = false;
      if (handle) {
        try {
          const r = await fetch(`https://${handle}/.well-known/atproto-did`);
          if (r.ok) {
            const txt = (await r.text()).trim();
            handleResolves = txt === did;
          }
        } catch (e) {
          console.error('federation-diagnostics: well-known failed', handle, e?.message || e);
        }
      }

      let status = 'ok';
      if (!pdsAccount) status = 'no_pds_account';
      else if (!inPlc) status = 'not_in_plc';
      else if (!handleResolves) status = 'handle_mismatch';

      report.push({
        userId: u.id, email: u.email,
        username: u.username || u.full_name || '',
        did, handle,
        pdsAccount, inPlc, plcHandle, plcPds, handleResolves,
        status,
      });
    }

    return Response.json({ pdsUrl, total: report.length, report });
  } catch (error) {
    console.error('federation-diagnostics error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}