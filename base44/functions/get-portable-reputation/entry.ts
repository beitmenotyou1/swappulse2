// get-portable-reputation — fetches a collector's trade reputation from BOTH the
// local Reputation records AND the AT Protocol PDS (org.swappulse.tradingFeedback
// records listed via the public AppView), merging and deduplicating by at_uri.
//
// This makes trade reputation portable: even if the local DB loses data, the
// federated PDS records reconstruct a collector's reputation, and records
// created on another SwapPulse instance (or carried over from a PDS migration)
// are visible here.
//
// Input:  { did }  — the target collector's AT Protocol DID
// Output: { did, reviews: [{ rating, comment, rater_name, rater_handle,
//                            trade_uri, at_uri, federated, created_at }],
//           average, total, federated_count }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession } from '../../shared/pdsSession.ts';

const APPVIEW = 'https://public.api.bsky.app';
const COLLECTION = 'org.swappulse.tradingFeedback';
const MAX_RECORDS = 100;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetDid = String(body.did || '');
    if (!targetDid) return Response.json({ error: 'did required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // 1. Fetch local reputation records
    const local = await svc.entities.Reputation.filter({ did: targetDid }, '-created_date', 200).catch(() => []);

    // 2. Fetch federated tradingFeedback records from the PDS via the public
    //    AppView. We authenticate to get the shared PDS account's DID (the repo
    //    where SwapPulse writes records), then list records of our collection.
    let federatedRecords: any[] = [];
    try {
      const { session } = await getPdsSession();
      const listUrl = `${APPVIEW}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(session.did)}&collection=${COLLECTION}&limit=${MAX_RECORDS}`;
      const res = await fetch(listUrl);
      if (res.ok) {
        const data = await res.json();
        for (const rec of (data.records || [])) {
          const val = rec.value || {};
          if (val.rated_user_did === targetDid) {
            federatedRecords.push({
              rating: val.rating || 0,
              comment: val.comment || '',
              rater_name: val.rater_name || '',
              rater_handle: val.rater_handle || '',
              trade_uri: val.trade_uri || '',
              at_uri: rec.uri || '',
              federated: true,
              created_at: val.createdAt || rec.createdAt || '',
            });
          }
        }
      }
    } catch (e) {
      console.error('get-portable-reputation: PDS fetch failed', e?.message || e);
    }

    // 3. Merge: build a map keyed by at_uri. Local records that have an at_uri
    //    matching a federated record are marked federated. Federated records not
    //    in local are added (imported). Local-only records stay as-is.
    const merged = new Map();
    for (const r of federatedRecords) {
      if (r.at_uri) merged.set(r.at_uri, r);
    }
    for (const r of local) {
      const key = r.at_uri || `local:${r.id}`;
      if (!merged.has(key)) {
        merged.set(key, {
          rating: r.rating || 0,
          comment: r.comment || '',
          rater_name: r.rater_name || '',
          rater_handle: r.rater_handle || '',
          trade_uri: r.trade_uri || '',
          at_uri: r.at_uri || '',
          federated: !!r.bridged,
          created_at: r.created_date || '',
        });
      }
    }

    const reviews = [...merged.values()].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const total = reviews.length;
    const federatedCount = reviews.filter((r) => r.federated).length;
    const average = total > 0 ? Number((reviews.reduce((s, r) => s + (r.rating || 0), 0) / total).toFixed(1)) : 0;

    return Response.json({
      did: targetDid,
      reviews,
      average,
      total,
      federated_count: federatedCount,
    });
  } catch (error) {
    console.error('get-portable-reputation error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}