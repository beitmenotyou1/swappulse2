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
import { isPublicationEligible } from '../../shared/federationPolicy.ts';
import { computeContentHash } from '../../shared/bridgePublish.ts';
import { getConsentMap, isDoNotSell } from '../../shared/consentCheck.ts';

// bsky.* collections have strict lexicons and are bridged at create/update
// time with the correct record shape — the generic entityToRecord serializer
// would produce invalid records the PDS rejects, so skip them here.
const SKIP_FOR_RECONCILE = new Set([
  'app.bsky.feed.post',
  'app.bsky.feed.repost',
  'app.bsky.feed.like',
  'app.bsky.graph.follow',
]);
const PDS_FETCH_TIMEOUT_MS = 10_000;
const MAX_PDS_PAGES = 20;
const MAX_LOCAL_RECORDS = 500;

async function fetchWithTimeout(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PDS_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function listPdsRecords(pdsUrl: string, accessJwt: string, did: string, collection: string): Promise<any[] | null> {
  const all: any[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    if (cursor) {
      if (seenCursors.has(cursor)) {
        console.error('outbound-reconcile: repeated PDS cursor', collection, did);
        return null;
      }
      seenCursors.add(cursor);
    }
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', collection);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetchWithTimeout(url, { redirect: 'error', headers: { Authorization: `Bearer ${accessJwt}` } });
    if (!res.ok) return null;
    const data = await res.json();
    all.push(...(data.records || []));
    cursor = data.cursor || null;
    pages += 1;
    if (cursor && pages >= MAX_PDS_PAGES) {
      console.error('outbound-reconcile: PDS page cap reached', collection, did);
      return null;
    }
  } while (cursor);
  return all;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const usersWithDid = await svc.entities.User
      .filter({ migrated_from_bluesky: true }, '-created_date', 10).catch(() => []);
    const consentMap = await getConsentMap(svc);
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');
    let reconciled = 0, created = 0, updated = 0, errors = 0, skipped = 0, deleted = 0;
    const perUser: any[] = [];

    for (const user of usersWithDid) {
      const identity = await getUserIdentity(svc, user);
      if (!identity) { skipped++; continue; }
      // CCPA opt-out: skip users who enabled Do Not Sell or Share
      if (isDoNotSell(consentMap.get(user.id))) {
        console.log('outbound-reconcile: skipping user (do-not-sell)', identity.did);
        skipped++;
        continue;
      }
      let session: any;
      let userPdsUrl = '';
      try {
        const s = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
        session = s.session;
        userPdsUrl = s.pdsUrl;
      } catch (e: any) {
        console.error('outbound-reconcile: session failed for', identity.did, e?.message || e);
        errors++;
        continue;
      }

      let userReconciled = 0;
      for (const [collection, entityName] of Object.entries(COLLECTIONS)) {
        if (SKIP_FOR_RECONCILE.has(collection)) continue;
        try {
          const local = await svc.entities[entityName]
            .filter({ did: identity.did, bridged: true }, '-updated_date', MAX_LOCAL_RECORDS).catch(() => []);
          const pdsRecords = await listPdsRecords(userPdsUrl, session.accessJwt, session.did, collection);
          if (!pdsRecords) {
            errors++;
            console.error('outbound-reconcile: incomplete PDS listing; skipping collection', collection, identity.did);
            continue;
          }
          if ((!local || local.length === 0) && pdsRecords.length === 0) continue;
          const localListingComplete = (local || []).length < MAX_LOCAL_RECORDS;
          const pdsByUri = new Map(pdsRecords.map((r: any) => [r.uri, r.cid]));

          for (const rec of local) {
            if (!rec.at_uri) continue;
            const pdsCid = pdsByUri.get(rec.at_uri);

            // Privacy must be evaluated before drift. If a previously bridged
            // record is no longer eligible, remove the public PDS copy and mark
            // the local source unbridged so this reconciler cannot recreate it.
            if (!isPublicationEligible(collection, rec)) {
              const rkey = rec.at_uri.split('/').pop();
              try {
                if (pdsCid) {
                  const res = await fetchWithTimeout(`${userPdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
                    redirect: 'error',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
                    body: JSON.stringify({ repo: session.did, collection, rkey }),
                  });
                  if (!res.ok && res.status !== 404) {
                    errors++;
                    console.error('outbound-reconcile: privacy deleteRecord failed', collection, res.status);
                    continue;
                  }
                  deleted++; reconciled++; userReconciled++;
                }
                await svc.entities[entityName].update(rec.id, {
                  bridged: false,
                  at_uri: '',
                  cid: '',
                  content_hash: '',
                }).catch(() => {});
              } catch (e: any) {
                errors++;
                console.error('outbound-reconcile: privacy deleteRecord error', collection, e?.message || e);
              }
              continue;
            }

            const record = buildRecord(rec, collection);
            const newHash = await computeContentHash(record).catch(() => '');
            const hashDrift = rec.content_hash ? (rec.content_hash !== newHash) : false;
            const cidDrift = rec.cid ? (pdsCid !== rec.cid) : false;
            try {
              if (!pdsCid) {
                // Missing on PDS → re-create
                const rkey = rec.at_uri.split('/').pop();
                const res = await fetchWithTimeout(`${userPdsUrl}/xrpc/com.atproto.repo.createRecord`, {
                  redirect: 'error',
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
                  body: JSON.stringify({ repo: session.did, collection, rkey, record }),
                });
                if (res.ok) {
                  const data = await res.json();
                  await svc.entities[entityName].update(rec.id, { at_uri: data.uri, cid: data.cid, bridged: true, content_hash: newHash }).catch(() => {});
                  created++; reconciled++; userReconciled++;
                } else {
                  errors++;
                  console.error('outbound-reconcile: createRecord failed', collection, res.status);
                }
              } else if (hashDrift || cidDrift) {
                // Content-hash or CID mismatch → update in place
                const rkey = rec.at_uri.split('/').pop();
                const res = await fetchWithTimeout(`${userPdsUrl}/xrpc/com.atproto.repo.putRecord`, {
                  redirect: 'error',
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
                  body: JSON.stringify({ repo: session.did, collection, rkey, record }),
                });
                if (res.ok) {
                  const data = await res.json();
                  await svc.entities[entityName].update(rec.id, { cid: data.cid, content_hash: newHash }).catch(() => {});
                  updated++; reconciled++; userReconciled++;
                } else {
                  errors++;
                  console.error('outbound-reconcile: putRecord failed', collection, res.status);
                }
              } else if (!rec.content_hash && newHash) {
                // No drift but content_hash missing (pre-migration) → backfill without pushing
                await svc.entities[entityName].update(rec.id, { content_hash: newHash }).catch(() => {});
              }
            } catch (e: any) {
              errors++;
              console.error('outbound-reconcile: record error', collection, e?.message || e);
            }
          }
          // Tombstone PDS records whose local copy was deleted, but only when
          // the local listing is known to be complete. The previous 50-record
          // window could misclassify valid older PDS records as deleted.
          if (localListingComplete) {
            const localUris = new Set((local || []).map((r: any) => r.at_uri).filter(Boolean));
            for (const [uri] of pdsByUri) {
              if (localUris.has(uri)) continue;
              const rkey = uri.split('/').pop();
              try {
                const res = await fetchWithTimeout(`${userPdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
                  redirect: 'error',
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
                  body: JSON.stringify({ repo: session.did, collection, rkey }),
                });
                if (res.ok || res.status === 404) { deleted++; reconciled++; userReconciled++; }
                else { errors++; console.error('outbound-reconcile: deleteRecord failed', collection, res.status); }
              } catch (e: any) {
                errors++;
                console.error('outbound-reconcile: deleteRecord error', collection, e?.message || e);
              }
            }
          } else {
            console.log('outbound-reconcile: local record cap reached; skipping tombstone deletion', collection, identity.did);
          }
        } catch (e: any) {
          console.error('outbound-reconcile: collection error', collection, e?.message || e);
        }
      }
      perUser.push({ did: identity.did, reconciled: userReconciled });
    }

    return Response.json({ reconciled, created, updated, deleted, errors, skipped, users: usersWithDid.length, perUser });
  } catch (error) {
    console.error('outbound-reconcile error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}