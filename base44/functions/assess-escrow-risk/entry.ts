// assess-escrow-risk — computes a composite risk score for an escrow dispute
// and decides whether the agent can auto-resolve or must escalate to manual
// review. Pulls both parties' evidence (confirmation photos, tracking codes,
// carrier delivery status), trade history, and prior disputes, then runs the
// shared escrowRiskAssessment module.
//
// Called by the dispute-escrow flow (when a dispute is filed) and by the
// autonomous-moderation agent. Admin/moderator-gated; also callable by the
// internal service role.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  assessEscrowDispute,
  type RiskAssessment,
} from '../../shared/escrowRiskAssessment.ts';

// Count a user's completed trades by checking EscrowTrade records where they
// are buyer or seller and status is 'released' or 'delivered'.
async function countCompletedTrades(svc: any, did: string): Promise<number> {
  if (!did) return 0;
  try {
    const asBuyer = await svc.entities.EscrowTrade.filter(
      { buyer_did: did, status: 'released' },
      '-created_date',
      200
    ).catch(() => []);
    const asSeller = await svc.entities.EscrowTrade.filter(
      { seller_did: did, status: 'released' },
      '-created_date',
      200
    ).catch(() => []);
    const ids = new Set([...asBuyer.map((t: any) => t.id), ...asSeller.map((t: any) => t.id)]);
    return ids.size;
  } catch {
    return 0;
  }
}

// Count a user's prior disputes (disputes they filed or had filed against them
// that were resolved, excluding the current one).
async function countPriorDisputes(svc: any, did: string, excludeId: string): Promise<number> {
  if (!did) return 0;
  try {
    const asBuyer = await svc.entities.EscrowTrade.filter(
      { buyer_did: did, status: { $in: ['disputed', 'released', 'refunded', 'cancelled'] } },
      '-created_date',
      200
    ).catch(() => []);
    const asSeller = await svc.entities.EscrowTrade.filter(
      { seller_did: did, status: { $in: ['disputed', 'released', 'refunded', 'cancelled'] } },
      '-created_date',
      200
    ).catch(() => []);
    const ids = new Set([...asBuyer.map((t: any) => t.id), ...asSeller.map((t: any) => t.id)]);
    ids.delete(excludeId);
    return ids.size;
  } catch {
    return 0;
  }
}

// Fetch the user's account age in days from their created_date.
async function getAccountAgeDays(svc: any, did: string): Promise<number> {
  if (!did) return 9999;
  try {
    const users = await svc.entities.User.filter({ did }, '-created_date', 1).catch(() => []);
    const user = users?.[0];
    if (!user?.created_date) return 9999;
    const ageMs = Date.now() - new Date(user.created_date).getTime();
    return Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 9999;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    const isInternal = req.headers.get('base44-service-authorization') || req.headers.get('Base44-Service-Authorization');
    if ((!caller || !['admin', 'moderator'].includes(caller.role)) && !isInternal) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { escrow_id, agent_confidence } = body;
    if (!escrow_id) return Response.json({ error: 'Missing escrow_id' }, { status: 400 });
    if (typeof agent_confidence !== 'number') return Response.json({ error: 'Missing agent_confidence (0-1)' }, { status: 400 });

    const svc = base44.asServiceRole;
    const escrow = await svc.entities.EscrowTrade.get(escrow_id).catch(() => null);
    if (!escrow) return Response.json({ error: 'Escrow not found' }, { status: 404 });

    // Fetch the dispute record to get the dispute reason
    let disputeReason = 'other';
    try {
      const disputes = await svc.entities.TradeDispute.filter({ trade_id: escrow_id }, '-created_date', 1).catch(() => []);
      if (disputes.length > 0) disputeReason = disputes[0].reason || 'other';
    } catch { /* ignore */ }

    // Gather party context in parallel
    const [buyerAgeDays, sellerAgeDays, buyerTrades, sellerTrades, buyerPrior, sellerPrior] = await Promise.all([
      getAccountAgeDays(svc, escrow.buyer_did),
      getAccountAgeDays(svc, escrow.seller_did),
      countCompletedTrades(svc, escrow.buyer_did),
      countCompletedTrades(svc, escrow.seller_did),
      countPriorDisputes(svc, escrow.buyer_did, escrow_id),
      countPriorDisputes(svc, escrow.seller_did, escrow_id),
    ]);

    const assessment: RiskAssessment = assessEscrowDispute({
      usdc_amount_wei: escrow.usdc_amount_wei || '0',
      agent_confidence,
      evidence: {
        buyer_confirmed_receipt: !!escrow.buyer_confirmed_at,
        seller_confirmed_receipt: !!escrow.seller_confirmed_at,
        buyer_tracking_code: escrow.buyer_tracking_code || '',
        seller_tracking_code: escrow.seller_tracking_code || '',
        carrier_delivered: null, // populated by carrier verification (future)
        dispute_reason: disputeReason,
      },
      party_context: {
        buyer_account_age_days: buyerAgeDays,
        buyer_completed_trades: buyerTrades,
        seller_account_age_days: sellerAgeDays,
        seller_completed_trades: sellerTrades,
      },
      prior_disputes: {
        buyer_prior_disputes: buyerPrior,
        seller_prior_disputes: sellerPrior,
      },
    });

    return Response.json({
      ok: true,
      escrow_id,
      assessment,
      party_context: { buyerAgeDays, sellerAgeDays, buyerTrades, sellerTrades, buyerPrior, sellerPrior },
      dispute_reason: disputeReason,
    });
  } catch (error: any) {
    console.error('assess-escrow-risk error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});