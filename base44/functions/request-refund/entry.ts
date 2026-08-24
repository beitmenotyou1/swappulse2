// request-refund — refunds unused fiat top-up balance back to the original
// Stripe payment method. Only the original fiat top-up amount can be refunded
// (not converted USDC). No fee is charged on refunds. The backend finds
// FiatTopUp records with refundable_cents > 0, issues a Stripe refund, and
// debits the wallet balance.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const STRIPE_API = 'https://api.stripe.com/v1';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { refund_cents } = body;
    if (!refund_cents || refund_cents < 100) {
      return Response.json({ error: 'Minimum refund is 1.00' }, { status: 400 });
    }

    const stripeKey = secrets.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return Response.json({ error: 'Stripe not configured' }, { status: 500 });

    // Check the user has enough fiat balance
    const balances = await base44.entities.WalletBalance
      .filter({ did }, '-created_date', 1).catch(() => []);
    if (!balances.length || balances[0].fiat_cents < refund_cents) {
      return Response.json({ error: 'Insufficient fiat balance for refund' }, { status: 400 });
    }
    const balance = balances[0];

    // Find FiatTopUp records with refundable balance, oldest first
    const topups = await base44.entities.FiatTopUp
      .filter({ did, status: 'succeeded' }, 'created_date', 50).catch(() => []);
    const refundable = topups.filter((t: any) => t.refundable_cents > 0);
    if (!refundable.length) {
      return Response.json({ error: 'No refundable top-up balance available' }, { status: 400 });
    }

    // Calculate total available refund
    const totalRefundable = refundable.reduce((sum: number, t: any) => sum + t.refundable_cents, 0);
    if (totalRefundable < refund_cents) {
      return Response.json({
        error: `Only ${(totalRefundable / 100).toFixed(2)} is refundable (the rest was converted to USDC)`,
      }, { status: 400 });
    }

    // Issue refunds from the oldest top-ups first
    let remainingRefund = refund_cents;
    const refundedTopups: any[] = [];

    for (const topup of refundable) {
      if (remainingRefund <= 0) break;
      const refundAmount = Math.min(topup.refundable_cents, remainingRefund);

      // Issue Stripe refund
      const refundRes = await fetch(`${STRIPE_API}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          payment_intent: topup.stripe_payment_intent_id,
          amount: String(refundAmount),
          metadata: JSON.stringify({
            type: 'wallet_refund',
            did,
            user_id: user.id,
          }),
        }),
      });

      if (!refundRes.ok) {
        const err = await refundRes.json().catch(() => ({}));
        return Response.json({
          error: `Stripe refund failed: ${err.error?.message || 'unknown error'}`,
        }, { status: 400 });
      }

      const refund = await refundRes.json();
      const newRefundable = topup.refundable_cents - refundAmount;
      const newRefunded = (topup.refunded_cents || 0) + refundAmount;

      await base44.entities.FiatTopUp.update(topup.id, {
        refundable_cents: newRefundable,
        refunded_cents: newRefunded,
        refund_status: newRefundable === 0 ? 'refunded' : 'partial',
      });

      refundedTopups.push({
        topup_id: topup.id,
        refund_amount: refundAmount,
        stripe_refund_id: refund.id,
      });

      remainingRefund -= refundAmount;
    }

    // Debit the wallet balance
    await base44.asServiceRole.entities.WalletBalance.update(balance.id, {
      fiat_cents: balance.fiat_cents - refund_cents,
      total_topup_cents: (balance.total_topup_cents || 0) - refund_cents,
      last_updated_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      refunded_cents: refund_cents,
      refunds: refundedTopups,
    });
  } catch (error: any) {
    console.error('request-refund error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}