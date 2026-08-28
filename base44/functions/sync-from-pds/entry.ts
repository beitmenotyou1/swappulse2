// sync-from-pds — scheduled polling sync from the AT Protocol PDS.
//
// Lists records from the bridge PDS account's repo for each bridged collection,
// diffs against local entities (matched by at_uri), and:
//   - Deletes local entities whose at_uri is missing from PDS (inbound deletion cleanup)
//   - Logs CID mismatches for manual review (inbound update detection)
//
// Called by the "PDS Sync" workflow every 5 minutes. Admin-only.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Some entities are locally authoritative and must never be deleted merely
// because a PDS copy is missing. CollectionEntry is now private Base44 source
// data, so it is intentionally excluded from this PDS-authoritative sync.
const COLLECTION_MAP = [
  { collection: 'app.bsky.feed.post', entity: 'Post' },
  { collection: 'app.bsky.feed.repost', entity: 'Repost' },
  { collection: 'org.swappulse.tradeListing', entity: 'TradeListing' },
];

async function getSession() {
  const pdsUrl = Deno.env.get('PDS_URL');
  const identifier = Deno.env.get('PDS_IDENTIFIER');
  const password = Deno.env.get('PDS_APP_PASSWORD');
  if (!pdsUrl || !identifier || !password) {
    throw new Error('PDS not configured. Set PDS_URL, PDS_IDENTIFIER, PDS_APP_PASSWORD secrets.');
  }
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createSession failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return { pdsUrl, accessJwt: data.accessJwt, did: data.did };
}

async function listRecords(pdsUrl: string, accessJwt: string, repoDid: string, collection: string) {
  const all: any[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', repoDid);
    url.searchParams.set('collection', collection);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessJwt}` },
    });
    if (!res.ok) {
      console.error(`[sync-from-pds] listRecords failed for ${collection}: ${res.status}`);
      return all;
    }
    const data = await res.json();
    all.push(...(data.records || []));
    cursor = data.cursor || null;
  } while (cursor);
  return all;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    const svc = base44.asServiceRole;
    const { pdsUrl, accessJwt, did } = await getSession();

    const results: any[] = [];
    for (const { collection, entity } of COLLECTION_MAP) {
      const pdsRecords = await listRecords(pdsUrl, accessJwt, did, collection);
      const pdsUriSet = new Set(pdsRecords.map((r: any) => r.uri));

      const localRecords = await svc.entities[entity].filter({ bridged: true }, '-updated_date', 500);

      const bridgePrefix = `at://${did}/`;
      let deleted = 0;
      let cidMismatches = 0;
      let skipped = 0;
      for (const local of localRecords) {
        if (!local.at_uri) continue;
        // Only verify/delete records that live under the shared bridge account's
        // own repo — that's the only repo this sync can list. Records bridged
        // under a user's own did:plc live in a repo we can't see from here, so
        // skip them entirely (never delete user-repo content).
        if (!local.at_uri.startsWith(bridgePrefix)) {
          skipped++;
          continue;
        }
        if (!pdsUriSet.has(local.at_uri)) {
          // Orphaned — deleted on PDS, delete locally
          try {
            await svc.entities[entity].delete(local.id);
            deleted++;
          } catch (e) {
            console.error(`[sync-from-pds] delete failed for ${entity} ${local.id}:`, e?.message);
          }
        } else {
          // Check for CID mismatch (PDS record was updated)
          const pdsRec = pdsRecords.find((r: any) => r.uri === local.at_uri);
          if (pdsRec && pdsRec.cid && local.cid && pdsRec.cid !== local.cid) {
            cidMismatches++;
            // Update local CID to match PDS
            try {
              await svc.entities[entity].update(local.id, { cid: pdsRec.cid });
            } catch {}
          }
        }
      }

      results.push({
        collection,
        entity,
        pdsCount: pdsRecords.length,
        localBridged: localRecords.length,
        deleted,
        skipped,
        cidMismatches,
      });
    }

    console.log('[sync-from-pds] sync complete', JSON.stringify(results));
    return Response.json({ ok: true, synced: results, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[sync-from-pds] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}