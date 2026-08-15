// outbound-reconcile — pushes locally-changed org.swappulse.* records to the
// PDS, reconciling drift. For each user with a PdsCredential, lists their
// bridged records, compares each against the PDS record by at_uri:
//   - missing on PDS → re-create (com.atproto.repo.createRecord)
//   - cid mismatch  → update in place (com.atproto.repo.putRecord)
// Records are rebuilt from the entity via the generic entityToRecord mapper.
//
// Runs as a service role (invoked by the Firehose Ingestion workflow). Processes
// up to 10 users + 50 records per collection per run. Idempotent — re-run until
// counts stop changing.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { COLLECTIONS, buildRecord } from '../../shared/firehoseMappers.ts';

// bsky.* collections have strict lexicons and are bridged at create/update
// time with the correct record shape — the generic entityToRecord serializer
// would produce invalid records the PDS rejects, so skip them here.
const SKIP_FOR_RECONCILE = new Set([
  'app.bsky.feed.post',
  'app.bsky.feed.repost',
  'app.bsky.feed.like',
  'app.bsky.graph.follow',
]);

async function listPdsRecords(pdsUrl: string, accessJwt: string, did: string, collection: string) {
  const all: any[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', collection);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessJwt}` } });
    if (!res.ok) return all;
    const data = await res.json();
    all.push(...(data.records || []));
    cursor = data.cursor || null;
  } while (cursor);
  return all;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      console.error('outbound-reconcile: PDS_URL not configured');
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    const creds = await svc.entities.PdsCredential.list('-created_date', 10).catch(() => []);
    let reconciled = 0, created = 0, updated = 0, errors = 0;
    const perUser: any[] = [];

    for (const cred of creds) {
      let session: any;
      try {
        const s = await getPdsSessionForUser(pdsUrl, cred.did, cred.app_password);
        session = s.session;
      } catch (e: any) {
        console.error('outbound-reconcile: session failed for', cred.did, e?.message || e);
        errors++;
        continue;
      }

      let userReconciled = 0;
      for (const [collection, entityName] of Object.entries(COLLECTIONS)) {
        if (SKIP_FOR_RECONCILE.has(collection)) continue;
        try {
          const local = await svc.entities[entityName]
            .filter({ did: cred.did, bridged: true }, '-updated_date', 50).catch(() => []);
          if (!local || local.length === 0) continue;

          const pdsRecords = await listPdsRecords(pdsUrl, session.accessJwt, session.did, collection);
          const pdsByUri = new Map(pdsRecords.map((r: any) => [r.uri, r.cid]));

          for (const rec of local) {
            if (!rec.at_uri) continue;
            const pdsCid = pdsByUri.get(rec.at_uri);
            const record = buildRecord(rec, collection);
            try {
              if (!pdsCid) {
                // Missing on PDS → re-create
                const rkey = rec.at_uri.split('/').pop();
                const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
                  body: JSON.stringify({ repo: session.did, collection, rkey, record }),
                });
                if (res.ok) {
                  const data = await res.json();
                  await svc.entities[entityName].update(rec.id, { at_uri: data.uri, cid: data.cid, bridged: true }).catch(() => {});
                  created++; reconciled++; userReconciled++;
                } else {
                  errors++;
                  console.error('outbound-reconcile: createRecord failed', collection, res.status);
                }
              } else if (rec.cid && pdsCid !== rec.cid) {
                // CID mismatch → update in place
                const rkey = rec.at_uri.split('/').pop();
                const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
                  body: JSON.stringify({ repo: session.did, collection, rkey, record }),
                });
                if (res.ok) {
                  const data = await res.json();
                  await svc.entities[entityName].update(rec.id, { cid: data.cid }).catch(() => {});
                  updated++; reconciled++; userReconciled++;
                } else {
                  errors++;
                  console.error('outbound-reconcile: putRecord failed', collection, res.status);
                }
              }
            } catch (e: any) {
              errors++;
              console.error('outbound-reconcile: record error', collection, e?.message || e);
            }
          }
        } catch (e: any) {
          console.error('outbound-reconcile: collection error', collection, e?.message || e);
        }
      }
      perUser.push({ did: cred.did, reconciled: userReconciled });
    }

    return Response.json({ reconciled, created, updated, errors, users: creds.length, perUser });
  } catch (error) {
    console.error('outbound-reconcile error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}