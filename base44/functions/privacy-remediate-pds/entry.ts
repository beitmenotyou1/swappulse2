import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession, getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';
import { COLLECTIONS } from '../../shared/firehoseMappers.ts';
import { isPublicationEligible } from '../../shared/federationPolicy.ts';

const FETCH_LIMIT = 5000;
const DEFAULT_BATCH = 50;
const MAX_BATCH = 100;
const CONFIRM_PHRASE = 'DELETE_PDS_PRIVACY_COPIES';

type Candidate = {
  kind: 'federated_record' | 'standard_document';
  collection: string;
  entityName: string;
  id: string;
  uri: string;
  reason: string;
};

function parseAtUri(uri: string) {
  const segs = String(uri || '').replace(/^at:\/\//, '').split('/');
  if (segs.length < 3) return null;
  return { repoDid: segs[0], collection: segs[1], rkey: segs[2] };
}

async function sessionForRepo(svc: any, repoDid: string, shared: any) {
  if (shared?.session?.did === repoDid) return shared;

  const users = await svc.entities.User.filter({ did: repoDid }, '-created_date', 1).catch(() => []);
  const user = users?.[0];
  if (!user) throw new Error('No local user identity for target PDS repo');

  const identity = await getUserIdentity(svc, user);
  if (!identity) throw new Error('No usable PDS credential for target user');

  const resolved = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
  if (resolved?.session?.did !== repoDid) throw new Error('Resolved PDS session does not match target repo');
  return resolved;
}

async function deletePdsUri(svc: any, uri: string, shared: any) {
  const parsed = parseAtUri(uri);
  if (!parsed) throw new Error('Invalid AT URI');
  const resolved = await sessionForRepo(svc, parsed.repoDid, shared);
  const result = await pdsRequest(
    resolved.pdsUrl,
    resolved.session.accessJwt,
    'com.atproto.repo.deleteRecord',
    { repo: parsed.repoDid, collection: parsed.collection, rkey: parsed.rkey },
  );
  if (result?.error && result.status !== 404) {
    throw new Error(`deleteRecord failed (${result.status || 'unknown'})`);
  }
}

function privacyReason(collection: string, rec: any): string {
  if (collection === 'app.bsky.feed.post') return `post visibility=${rec?.visibility_scope || 'unknown'}`;
  if (rec?.visibility) return `visibility=${rec.visibility}`;
  if (rec?.audience) return `audience=${rec.audience}`;
  if (rec?.scope) return `scope=${rec.scope}`;
  return 'collection is not eligible for public federation';
}

async function collectCandidates(svc: any): Promise<{ candidates: Candidate[]; capped: boolean; scanned: Record<string, number> }> {
  const candidates: Candidate[] = [];
  const scanned: Record<string, number> = {};
  let capped = false;

  // One entity can back more than one collection (e.g. BlueskyList), so the
  // collection is taken from each row's record_type when available and the
  // configured mapping is used only as the fallback.
  const uniquePairs = [...new Map(
    Object.entries(COLLECTIONS).map(([collection, entityName]) => [`${collection}:${entityName}`, { collection, entityName }])
  ).values()];

  for (const { collection, entityName } of uniquePairs) {
    const rows = await svc.entities[entityName]
      .filter({ bridged: true }, '-created_date', FETCH_LIMIT)
      .catch(() => []);
    scanned[`${collection}:${entityName}`] = rows.length;
    if (rows.length >= FETCH_LIMIT) capped = true;

    for (const rec of rows || []) {
      if (!rec?.at_uri) continue;
      const effectiveCollection = String(rec.record_type || collection);
      if (isPublicationEligible(effectiveCollection, rec)) continue;
      candidates.push({
        kind: 'federated_record',
        collection: effectiveCollection,
        entityName,
        id: rec.id,
        uri: rec.at_uri,
        reason: privacyReason(effectiveCollection, rec),
      });
    }
  }

  // standard.site documents are separate public records. If a binder/journal
  // is no longer public, its standard document must be removed as well.
  for (const entityName of ['Binder', 'Journal']) {
    const rows = await svc.entities[entityName].filter({}, '-created_date', FETCH_LIMIT).catch(() => []);
    scanned[`standard:${entityName}`] = rows.length;
    if (rows.length >= FETCH_LIMIT) capped = true;
    for (const rec of rows || []) {
      if (rec?.visibility === 'public' || !rec?.standard_doc_uri) continue;
      candidates.push({
        kind: 'standard_document',
        collection: 'site.standard.document',
        entityName,
        id: rec.id,
        uri: rec.standard_doc_uri,
        reason: `visibility=${rec.visibility || 'unknown'}`,
      });
    }
  }

  // Deduplicate by URI. A malformed local state should never cause the same
  // public record to be deleted twice in one run.
  const deduped = [...new Map(candidates.map((c) => [c.uri, c])).values()];
  return { candidates: deduped, capped, scanned };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (caller.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const execute = body.execute === true;
    const batchSize = Math.min(Math.max(Number(body.batch_size) || DEFAULT_BATCH, 1), MAX_BATCH);

    if (execute && body.confirm !== CONFIRM_PHRASE) {
      return Response.json({
        error: 'Explicit confirmation required',
        required_confirmation: CONFIRM_PHRASE,
      }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const { candidates, capped, scanned } = await collectCandidates(svc);
    const byCollection: Record<string, number> = {};
    for (const c of candidates) byCollection[c.collection] = (byCollection[c.collection] || 0) + 1;

    const summary = {
      total_operations: candidates.length,
      by_collection: byCollection,
      capped,
      fetch_limit: FETCH_LIMIT,
    };

    if (!execute) {
      return Response.json({
        ok: true,
        dry_run: true,
        summary,
        scanned,
        sample: candidates.slice(0, 20).map((c) => ({
          collection: c.collection,
          entity: c.entityName,
          id: c.id,
          reason: c.reason,
        })),
        message: 'No records were changed. Re-run with execute=true and the required confirmation phrase to process a batch.',
        required_confirmation: CONFIRM_PHRASE,
        generated_at: new Date().toISOString(),
      });
    }

    const shared = await getPdsSession();
    const selected = candidates.slice(0, batchSize);
    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ collection: string; entity: string; id: string; error: string }> = [];

    for (const candidate of selected) {
      try {
        await deletePdsUri(svc, candidate.uri, shared);

        if (candidate.kind === 'standard_document') {
          await svc.entities[candidate.entityName].update(candidate.id, { standard_doc_uri: '' });
        } else {
          await svc.entities[candidate.entityName].update(candidate.id, {
            bridged: false,
            at_uri: '',
            cid: '',
            content_hash: '',
          });
        }
        succeeded++;
      } catch (e: any) {
        failed++;
        if (failures.length < 20) {
          failures.push({
            collection: candidate.collection,
            entity: candidate.entityName,
            id: candidate.id,
            error: e?.message || String(e),
          });
        }
        console.error('privacy-remediate-pds failed', candidate.collection, candidate.entityName, candidate.id, e?.message || e);
      }
    }

    return Response.json({
      ok: failed === 0,
      dry_run: false,
      summary,
      batch: {
        requested: batchSize,
        attempted: selected.length,
        succeeded,
        failed,
        remaining_estimate: Math.max(candidates.length - succeeded, 0),
      },
      failures: failures.length ? failures : undefined,
      note: 'Only ineligible public PDS copies and local bridge metadata were changed. Underlying local source records were not deleted.',
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('privacy-remediate-pds error', e?.message || e);
    return Response.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}