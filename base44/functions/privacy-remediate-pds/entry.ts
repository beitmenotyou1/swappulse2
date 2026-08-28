import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession, getPdsSessionForUser, pdsRequest } from '../../shared/pdsSession.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';

const FETCH_LIMIT = 5000;
const DEFAULT_BATCH = 50;
const MAX_BATCH = 100;
const CONFIRM_PHRASE = 'DELETE_PDS_PRIVACY_COPIES';

type Candidate = {
  kind: 'collection_entry' | 'binder_record' | 'binder_standard_document';
  entityName: 'CollectionEntry' | 'Binder';
  id: string;
  uri: string;
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
  return true;
}

function collectCandidates(entries: any[], binders: any[]): Candidate[] {
  const out: Candidate[] = [];

  for (const entry of entries) {
    if (entry?.bridged === true && entry?.at_uri) {
      out.push({ kind: 'collection_entry', entityName: 'CollectionEntry', id: entry.id, uri: entry.at_uri });
    }
  }

  for (const binder of binders) {
    const nonPublic = binder?.visibility !== 'public';
    if (!nonPublic) continue;
    if (binder?.bridged === true && binder?.at_uri) {
      out.push({ kind: 'binder_record', entityName: 'Binder', id: binder.id, uri: binder.at_uri });
    }
    if (binder?.standard_doc_uri) {
      out.push({ kind: 'binder_standard_document', entityName: 'Binder', id: binder.id, uri: binder.standard_doc_uri });
    }
  }

  return out;
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
    const [entries, binders] = await Promise.all([
      svc.entities.CollectionEntry.filter({}, '-created_date', FETCH_LIMIT).catch(() => []),
      svc.entities.Binder.filter({}, '-created_date', FETCH_LIMIT).catch(() => []),
    ]);

    const candidates = collectCandidates(entries, binders);
    const summary = {
      collection_entry_pds_records: candidates.filter((c) => c.kind === 'collection_entry').length,
      non_public_binder_pds_records: candidates.filter((c) => c.kind === 'binder_record').length,
      non_public_binder_standard_documents: candidates.filter((c) => c.kind === 'binder_standard_document').length,
      total_operations: candidates.length,
      capped: entries.length >= FETCH_LIMIT || binders.length >= FETCH_LIMIT,
      fetch_limit: FETCH_LIMIT,
    };

    if (!execute) {
      return Response.json({
        ok: true,
        dry_run: true,
        summary,
        message: 'No records were changed. Re-run with execute=true and the required confirmation phrase to process a batch.',
        required_confirmation: CONFIRM_PHRASE,
        generated_at: new Date().toISOString(),
      });
    }

    const shared = await getPdsSession();
    const selected = candidates.slice(0, batchSize);
    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ kind: string; id: string; error: string }> = [];

    for (const candidate of selected) {
      try {
        await deletePdsUri(svc, candidate.uri, shared);

        if (candidate.kind === 'collection_entry') {
          await svc.entities.CollectionEntry.update(candidate.id, {
            bridged: false,
            at_uri: '',
            cid: '',
            content_hash: '',
          });
        } else if (candidate.kind === 'binder_record') {
          await svc.entities.Binder.update(candidate.id, {
            bridged: false,
            at_uri: '',
            cid: '',
            content_hash: '',
          });
        } else if (candidate.kind === 'binder_standard_document') {
          await svc.entities.Binder.update(candidate.id, { standard_doc_uri: '' });
        }

        succeeded++;
      } catch (e: any) {
        failed++;
        if (failures.length < 20) {
          failures.push({ kind: candidate.kind, id: candidate.id, error: e?.message || String(e) });
        }
        console.error('privacy-remediate-pds failed', candidate.kind, candidate.id, e?.message || e);
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
      note: 'Only PDS federation copies and local bridge metadata were changed. Underlying CollectionEntry and Binder source records were not deleted.',
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('privacy-remediate-pds error', e?.message || e);
    return Response.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
