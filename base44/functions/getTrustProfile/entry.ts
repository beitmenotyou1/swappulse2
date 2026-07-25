// §2.5 getTrustProfile — computes a collector's trust score from incoming
// vouches and returns incoming + outgoing vouch lists. Mirrors the Social
// Service trust.service.ts computation (no Redis adjacency list; scans Vouch
// records per call — fine at this scale).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

    const incoming = await svc.entities.Vouch.filter({ vouched_did: targetDid }, '-created_date', 200);
    const outgoing = await svc.entities.Vouch.filter({ did: targetDid }, '-created_date', 200);

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