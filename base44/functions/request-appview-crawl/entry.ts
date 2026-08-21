// request-appview-crawl — admin-only. For every provisioned user, calls the
// public Bluesky AppView's app.bsky.actor.getProfile for their DID. This both
// reports whether the AppView currently indexes the actor and nudges it to
// crawl the PDS repo if it hasn't already. Returns per-account indexed status.
//
// NOTE: the AppView only indexes repos whose DIDs are in the public
// plc.directory AND whose handles resolve. Run federation-diagnostics first;
// accounts flagged not_in_plc / handle_mismatch will not index until the PLC
// and DNS steps are completed on the PDS side.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const APPVIEW = 'https://public.api.bsky.app';

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

    const usersWithDid = await svc.entities.User
      .filter({ migrated_from_bluesky: true }, '-created_date', 500).catch(() => []);
    const results: any[] = [];

    for (const u of (usersWithDid || [])) {
      if (!u.did) continue;
      const did = u.did;
      let indexed = false; let profileHandle = '';
      try {
        const r = await fetch(`${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
        if (r.ok) {
          const d = await r.json();
          indexed = !!d.did;
          profileHandle = d.handle || '';
        }
      } catch (e) {
        console.error('request-appview-crawl: getProfile failed', did, e?.message || e);
      }
      results.push({ userId: u.id, did, indexed, profileHandle });
    }

    const indexedCount = results.filter((r) => r.indexed).length;
    return Response.json({ total: results.length, indexed: indexedCount, results });
  } catch (error) {
    console.error('request-appview-crawl error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}