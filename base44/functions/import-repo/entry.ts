// import-repo — restores a previously exported SwapPulse repo archive onto the
// current PDS under the requesting user's own did:plc, then upserts local
// entities so the user's full history is restored on a new instance.
//
// Input: { archive } — the parsed JSON archive object produced by export-repo
// (version 1, variant 'swappulse-repo-export-v1'). Each record entry carries
// { uri, cid, record } where `record` is already in AT Protocol format.
//
// For each collection/record: re-creates the record on the PDS via
// com.atproto.repo.createRecord (the user's PdsCredential session), then upserts
// the local entity by at_uri using the shared firehose field mappers. Requires a
// PdsCredential (the user must have a real did:plc on this PDS).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { FIELD_MAPPERS, COLLECTIONS } from '../../shared/firehoseMappers.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const archive = (body as any).archive;
    if (!archive || !archive.records) {
      return Response.json({ error: 'archive object with records is required' }, { status: 400 });
    }

    // Require a per-user PDS credential — import writes to the user's own repo.
    if (!user.did || !user.did.startsWith('did:plc:')) {
      return Response.json({ error: 'Import requires a federated identity (did:plc). Link your PDS account first.' }, { status: 403 });
    }
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');
    const identity = await getUserIdentity(svc, user);
    if (!identity) {
      return Response.json({ error: 'No PDS credential found. Link your PDS account first.' }, { status: 403 });
    }

    let session: any;
    let userPdsUrl = '';
    try {
      const s = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
      session = s.session;
      userPdsUrl = s.pdsUrl;
    } catch (e: any) {
      console.error('import-repo: session failed', e?.message || e);
      return Response.json({ error: `PDS session failed: ${e?.message || e}` }, { status: 502 });
    }

    let created = 0, upserted = 0, errors = 0;
    const collectionStats: Record<string, number> = {};

    for (const [collection, entries] of Object.entries(archive.records as Record<string, any[]>)) {
      if (!Array.isArray(entries)) continue;
      collectionStats[collection] = 0;
      const mapper = FIELD_MAPPERS[collection];
      const entityName = COLLECTIONS[collection];

      for (const entry of entries) {
        try {
          const record = entry.record || entry.value || {};
          const clean = { ...record };
          delete clean.$type;
          // Re-create on the PDS under the user's repo
          const res = await fetch(`${userPdsUrl}/xrpc/com.atproto.repo.createRecord`, {
            method: 'POST',
            redirect: 'error',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
            body: JSON.stringify({ repo: session.did, collection, record: clean }),
          });
          let newUri = entry.uri, newCid = entry.cid;
          if (res.ok) {
            const data = await res.json();
            newUri = data.uri || newUri;
            newCid = data.cid || newCid;
            created++;
          } else if (res.status !== 409) {
            // 409 = already exists, treat as success
            errors++;
            console.error('import-repo: createRecord failed', collection, res.status);
            continue;
          }

          // Upsert local entity by at_uri when a mapper exists
          if (mapper && entityName) {
            const mapped = mapper(clean, newUri, session.did);
            const existing = await svc.entities[entityName].filter({ at_uri: newUri }, '-created_date', 1).catch(() => []);
            if (existing && existing.length > 0) {
              await svc.entities[entityName].update(existing[0].id, mapped).catch(() => {});
            } else {
              await svc.entities[entityName].create(mapped).catch(() => {});
            }
            upserted++;
          }
          collectionStats[collection]++;
        } catch (e: any) {
          errors++;
          console.error('import-repo: entry error', collection, e?.message || e);
        }
      }
    }

    return Response.json({ created, upserted, errors, collectionStats, did: session.did });
  } catch (error) {
    console.error('import-repo error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}