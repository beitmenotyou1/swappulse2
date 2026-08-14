// §2.5 getTrustProfile - computes a collector's trust score from incoming
// vouches and returns incoming + outgoing vouch lists. Now federated: merges
// local Vouch records with remote org.swappulse.vouch records fetched from the
// AT Protocol PDS via the public AppView, so a collector's trust graph is
// portable and verifiable across instances.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSession } from '../../shared/pdsSession.ts';
import { mergeFederatedRecords } from '../../shared/federatedMerge.ts';

const APPVIEW = 'https://public.api.bsky.app';
const VOUCH_COLLECTION = 'org.swappulse.vouch';

const RELATIONSHIP_WEIGHT = {
  repeat_trader: 3,
  trade_partner: 2,
  personal_acquaintance: 2,
  community_member: 1,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const targetDid = String(body.did || '');
    if (!targetDid) return Response.json({ error: 'did required' }, { status: 400 });

    // Fetch remote vouches from the PDS (records where vouchedDid === targetDid)
    let remoteIncoming: any[] = [];
    let remoteOutgoing: any[] = [];
    try {
      const { session } = await getPdsSession();
      const listUrl = `${APPVIEW}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(session.did)}&collection=${VOUCH_COLLECTION}&limit=100`;
      const res = await fetch(listUrl);
      if (res.ok) {
        const data = await res.json();
        for (const rec of (data.records || [])) {
          const val = rec.value || {};
          const atUri = rec.uri || '';
          if (val.vouchedDid === targetDid) {
            remoteIncoming.push({
              did: val.voucherDid || session.did,
              vouched_did: val.vouchedDid,
              relationship: val.relationship || 'community_member',
              context: val.context || '',
              voucher_name: val.voucherName || '',
              voucher_handle: val.voucherHandle || '',
              revoked_at: val.revokedAt || '',
              created_date: val.createdAt || '',
              at_uri: atUri,
              bridged: true,
            });
          }
          if (val.voucherDid === targetDid) {
            remoteOutgoing.push({
              did: val.voucherDid,
              vouched_did: val.vouchedDid,
              relationship: val.relationship || 'community_member',
              context: val.context || '',
              vouched_name: val.vouchedName || '',
              vouched_handle: val.vouchedHandle || '',
              revoked_at: val.revokedAt || '',
              created_date: val.createdAt || '',
              at_uri: atUri,
              bridged: true,
            });
          }
        }
      }
    } catch (e) {
      console.error('getTrustProfile: PDS fetch failed', e?.message || e);
    }

    // Fetch local vouches and merge with remote
    const [localIncoming, localOutgoing] = await Promise.all([
      svc.entities.Vouch.filter({ vouched_did: targetDid }, '-created_date', 200),
      svc.entities.Vouch.filter({ did: targetDid }, '-created_date', 200),
    ]);

    // Merge local + remote by at_uri (dedup)
    const incoming = mergeFederatedRecords(localIncoming, remoteIncoming, { sortField: 'created_date' });
    const outgoing = mergeFederatedRecords(localOutgoing, remoteOutgoing, { sortField: 'created_date' });

    const activeIncoming = incoming.filter((v) => !v.revoked_at);
    // Hardening: count each voucher at most once (latest active vouch wins) to
    // prevent score inflation from duplicate vouches.
    const seen = new Map();
    for (const v of activeIncoming) {
      if (!seen.has(v.did)) seen.set(v.did, v);
    }
    const dedupedIncoming = [...seen.values()];
    const outgoingDids = new Set(outgoing.filter((v) => !v.revoked_at).map((v) => v.vouched_did));
    const mutualVouches = dedupedIncoming.filter((v) => outgoingDids.has(v.did)).length;

    const rawScore = dedupedIncoming.reduce(
      (s, v) => s + (RELATIONSHIP_WEIGHT[v.relationship] || 1),
      0,
    );
    const normalised = Math.min(100, Math.round(rawScore * 8 + mutualVouches * 5));

    const topVouchers = activeIncoming
      .map((v) => ({
        did: v.did,
        name: v.voucher_name,
        handle: v.voucher_handle,
        weight: RELATIONSHIP_WEIGHT[v.relationship] || 1,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    return Response.json({
      did: targetDid,
      vouch_count: activeIncoming.length,
      mutual_vouches: mutualVouches,
      raw_score: rawScore,
      normalised_score: normalised,
      top_vouchers: topVouchers,
      incoming: incoming.map((v) => ({
        id: v.id,
        relationship: v.relationship,
        context: v.context,
        voucher_name: v.voucher_name,
        voucher_handle: v.voucher_handle,
        created_at: v.created_date,
        revoked_at: v.revoked_at,
      })),
      outgoing: outgoing.map((v) => ({
        id: v.id,
        relationship: v.relationship,
        context: v.context,
        vouched_name: v.vouched_name,
        vouched_handle: v.vouched_handle,
        created_at: v.created_date,
        revoked_at: v.revoked_at,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});