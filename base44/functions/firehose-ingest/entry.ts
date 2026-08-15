// firehose-ingest — polls the AT Protocol PDS/AppView for SwapPulse custom-
// lexicon records and ingests remote creates/updates/deletes into the local DB
// (scheduled polling within serverless constraints; a true persistent
// WebSocket firehose would need external hosting).
//
// For each SwapPulse collection, lists records from the shared PDS repo AND
// from remote DIDs discovered via Follow records. New/updated records are
// upserted into the local DB by at_uri. Records that exist locally but are gone
// from the PDS (per repo) are deleted — true bidirectional delete sync.
//
// Runs as a service-role function (invoked by the Firehose Ingestion workflow).
// Writes ingested records with created_by_id = null (remote-originated).
//
// Output: { ingested, updated, deleted, errors, collections }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession } from '../../shared/pdsSession.ts';
import { COLLECTIONS, FIELD_MAPPERS } from '../../shared/firehoseMappers.ts';

const APPVIEW = 'https://public.api.bsky.app';

// Resolve a remote actor's profile (displayName, handle, avatar) from the
// AppView once per repo DID, so inbound posts carry author metadata for
// rendering. Cached for the duration of the ingest run.
const profileCache = new Map<string, any>();
async function getProfile(repoDid: string): Promise<any> {
  if (profileCache.has(repoDid)) return profileCache.get(repoDid);
  let profile: any = null;
  try {
    const url = new URL(`${APPVIEW}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set('actor', repoDid);
    const res = await fetch(url);
    if (res.ok) profile = await res.json();
  } catch (e) {
    console.error(`firehose-ingest: getProfile failed for ${repoDid}`, e?.message || e);
  }
  profileCache.set(repoDid, profile);
  return profile;
}

async function listRecords(baseUrl: string, repoDid: string, collection: string, accessJwt?: string) {
  const all: any[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(`${baseUrl}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', repoDid);
    url.searchParams.set('collection', collection);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: accessJwt ? { Authorization: `Bearer ${accessJwt}` } : {} });
    if (!res.ok) return all;
    const data = await res.json();
    all.push(...(data.records || []));
    cursor = data.cursor || null;
  } while (cursor);
  return all;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const { pdsUrl, session } = await getPdsSession();
    const localDid = session.did;
    const accessJwt = session.accessJwt;

    // Discover remote DIDs to ingest from (via Follow records)
    const follows = await svc.entities.Follow.list('-created_date', 200).catch(() => []);
    const remoteDids = new Set<string>();
    for (const f of follows) {
      if (f.subject_did && f.subject_did !== localDid) remoteDids.add(f.subject_did);
    }

    const reposToScan = [localDid, ...remoteDids];

    let ingested = 0, updated = 0, deleted = 0, errors = 0;
    const collectionStats: Record<string, number> = {};

    for (const [collection, entityName] of Object.entries(COLLECTIONS)) {
      const mapper = FIELD_MAPPERS[collection];
      if (!mapper) continue;
      collectionStats[collection] = 0;

      for (const repoDid of reposToScan) {
        try {
          const isLocal = repoDid === localDid;
          const listUrl = isLocal ? pdsUrl : APPVIEW;
          const records = await listRecords(listUrl, repoDid, collection, isLocal ? accessJwt : undefined);
          const pdsUriSet = new Set(records.map((r: any) => r.uri));

          // Resolve the remote actor's profile once per repo for post records
          // so inbound posts carry author_name/handle/avatar for rendering.
          const profile = !isLocal && collection === 'app.bsky.feed.post'
            ? await getProfile(repoDid) : undefined;

          for (const rec of records) {
            try {
              const atUri = rec.uri || '';
              const val = rec.value || {};
              if (!atUri) continue;

              // Skip records already local (authored by the local PDS account)
              if (isLocal) {
                const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
                if (existing && existing.length > 0) continue;
              }

              const mapped = mapper(val, atUri, repoDid, profile);
              const existing = await svc.entities[entityName].filter({ at_uri: atUri }, '-created_date', 1).catch(() => []);
              if (existing && existing.length > 0) {
                await svc.entities[entityName].update(existing[0].id, mapped).catch(() => {});
                updated++;
              } else {
                await svc.entities[entityName].create(mapped).catch(() => {});
                ingested++;
              }
              collectionStats[collection]++;
            } catch (e) {
              errors++;
              console.error(`firehose-ingest: record error for ${collection}`, e?.message || e);
            }
          }

          // Delete detection: local bridged records authored by this repo whose
          // at_uri is gone from the PDS are tombstoned locally.
          try {
            const localByDid = await svc.entities[entityName]
              .filter({ did: repoDid, bridged: true }, '-created_date', 200).catch(() => []);
            for (const local of localByDid || []) {
              if (!local.at_uri) continue;
              if (!pdsUriSet.has(local.at_uri)) {
                await svc.entities[entityName].delete(local.id).catch(() => {});
                deleted++;
              }
            }
          } catch (e) {
            console.error(`firehose-ingest: delete-detect error for ${collection} ${repoDid}`, e?.message || e);
          }
        } catch (e) {
          errors++;
          console.error(`firehose-ingest: repo scan error for ${collection} ${repoDid}`, e?.message || e);
        }
      }
    }

    return Response.json({
      ingested, updated, deleted, errors,
      collections: collectionStats,
      repos_scanned: reposToScan.length,
    });
  } catch (error) {
    console.error('firehose-ingest error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}