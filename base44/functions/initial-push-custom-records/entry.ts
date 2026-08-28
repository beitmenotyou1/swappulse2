// initial-push-custom-records — one-time admin-triggered bulk push of all
// historical unbridged org.swappulse.* records to the PDS. For each user with a
// PdsCredential, lists records where bridged != true across every custom
// collection, builds a lexicon-valid record via buildRecord, and creates it on
// the PDS under the user's DID. Time-bounded (~100s) — returns a remaining
// count so the Federation Finalization workflow can re-invoke until done.
//
// Idempotent: records that get bridged are marked bridged=true and skipped on
// subsequent runs. createRecord failures don't crash the function. Skips the
// 4 app.bsky.* collections (strict lexicons, handled at create/update time).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { COLLECTIONS, buildRecord } from '../../shared/firehoseMappers.ts';
import { getConsentMap, isDoNotSell } from '../../shared/consentCheck.ts';

const SKIP_COLLECTIONS = new Set([
  'app.bsky.feed.post',
  'app.bsky.feed.repost',
  'app.bsky.feed.like',
  'app.bsky.graph.follow',
]);

const TIME_BUDGET_MS = 100_000; // ~100s, leaving margin under the function limit
const BATCH_LIMIT = 100; // records per collection per user per run

// Privacy containment. Raw collection entries are private source data and must
// never be bulk-federated. Only explicitly public binders may be published.
function isPublicationEligible(collection: string, rec: any): boolean {
  if (collection === 'org.swappulse.collectionEntry') return false;
  if (collection === 'org.swappulse.binder') return rec?.visibility === 'public';
  return true;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const pdsUrl = Deno.env.get('PDS_URL');
    if (!pdsUrl) {
      console.error('initial-push: PDS_URL not configured');
      return Response.json({ error: 'PDS_URL not configured' }, { status: 500 });
    }

    const svc = base44.asServiceRole;
    const startTime = Date.now();
    let pushed = 0;
    let errors = 0;
    let remaining = 0;
    const perCollection: Record<string, { pushed: number; errors: number; remaining: number }> = {};

    // All users provisioned on the current PDS (consolidated identity on User)
    const usersWithDid = await svc.entities.User
      .filter({ migrated_from_bluesky: true }, '-created_date', 100).catch(() => []);
    const consentMap = await getConsentMap(svc);
    const { getUserIdentity } = await import('../../shared/userIdentity.ts');

    for (const user of usersWithDid || []) {
      if (Date.now() - startTime > TIME_BUDGET_MS) break;

      const identity = await getUserIdentity(svc, user);
      if (!identity) continue;

      // CCPA opt-out: skip users who enabled Do Not Sell or Share
      if (isDoNotSell(consentMap.get(user.id))) {
        console.log('initial-push: skipping user (do-not-sell)', identity.did);
        continue;
      }

      let session: any;
      try {
        const s = await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword);
        session = s.session;
      } catch (e: any) {
        console.error('initial-push: session failed for', identity.did, e?.message || e);
        continue;
      }

      for (const [collection, entityName] of Object.entries(COLLECTIONS)) {
        if (SKIP_COLLECTIONS.has(collection)) continue;
        if (Date.now() - startTime > TIME_BUDGET_MS) break;

        if (!perCollection[collection]) {
          perCollection[collection] = { pushed: 0, errors: 0, remaining: 0 };
        }

        try {
          // Unbridged records for this user: either did matches the credential,
          // or created_by_id matches and did is unset (pre-provision records).
          const records = await svc.entities[entityName]
            .filter({
              $or: [
                { did: identity.did, bridged: { $ne: true } },
                { created_by_id: user.id, did: { $in: [null, ''] }, bridged: { $ne: true } },
              ],
            }, '-created_date', BATCH_LIMIT)
            .catch(() => []);

          for (const rec of records || []) {
            if (!isPublicationEligible(collection, rec)) {
              // Intentionally leave unbridged. A later sanitised public projection
              // may become eligible, but private source entities never are.
              continue;
            }
            // Ensure the record's did is set to the user's DID before bridging
            const didWasUnset = !rec.did;
            if (didWasUnset) rec.did = identity.did;
            if (Date.now() - startTime > TIME_BUDGET_MS) {
              remaining++;
              perCollection[collection].remaining++;
              continue;
            }

            const record = buildRecord(rec, collection);
            try {
              const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
                body: JSON.stringify({ repo: session.did, collection, record }),
              });

              if (res.ok) {
                const data = await res.json();
                const updateData: any = { at_uri: data.uri, cid: data.cid, bridged: true };
                // Persist the did if it was previously unset
                if (didWasUnset) updateData.did = identity.did;
                await svc.entities[entityName].update(rec.id, updateData).catch(() => {});
                pushed++;
                perCollection[collection].pushed++;
              } else {
                errors++;
                perCollection[collection].errors++;
                const body = await res.text().catch(() => '');
                console.error('initial-push: createRecord failed', collection, rec.id, res.status, body);
              }
            } catch (e: any) {
              errors++;
              perCollection[collection].errors++;
              console.error('initial-push: error', collection, rec.id, e?.message || e);
            }
          }

          // Count any remaining unbridged records we didn't get to this run
          if (records && records.length >= BATCH_LIMIT) {
            // There may be more — we'll count them as remaining for the workflow to continue
            remaining += records.length; // at least this many were in this batch
            perCollection[collection].remaining += records.length;
          }
        } catch (e: any) {
          console.error('initial-push: collection error', collection, e?.message || e);
        }
      }
    }

    const done = remaining === 0;
    return Response.json({ pushed, errors, remaining, done, perCollection });
  } catch (error) {
    console.error('initial-push error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}