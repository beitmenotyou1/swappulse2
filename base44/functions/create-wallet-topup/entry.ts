// create-wallet-topup — creates a Stripe PaymentIntent for a wallet top-up.
// The user pays fiat via Stripe (card, Google Pay, Apple Pay). On success
// (via stripe-webhook), the fiat is credited to the user's WalletBalance
// and a 2% fee is converted to USDC and sent to the platform fee wallet.
// If crypto is OFF, the fiat is routed to the user's bank account instead.

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
    const { amount_cents, currency = 'GBP' } = body;
    if (!amount_cents || amount_cents < 50) {
      return Response.json({ error: 'Minimum top-up is 0.50' }, { status: 400 });
    }

    const stripeKey = secrets.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return Response.json({ error: 'Stripe not configured' }, { status: 500 });

    // Create a Stripe PaymentIntent
    const piRes = await fetch(`${STRIPE_API}/payment_intents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(amount_cents),
        currency: currency.toLowerCase(),
        'automatic_payment_methods[enabled]': 'true',
        'metadata[type]': 'wallet_topup',
        'metadata[did]': did,
        'metadata[user_id]': user.id,
        'metadata[amount_cents]': String(amount_cents),
      }),
    });

    if (!piRes.ok) {
      const err = await piRes.json().catch(() => ({}));
      return Response.json({ error: err.error?.message || 'Stripe error' }, { status: 400 });
    }

    const paymentIntent = await piRes.json();
    const feeCents = Math.floor((amount_cents * 200) / 10000);

    // Create a pending FiatTopUp record
    await base44.entities.FiatTopUp.create({
      did,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents,
      currency,
      fee_cents: feeCents,
      refundable_cents: amount_cents,
      status: 'pending',
    });

    return Response.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      fee_cents: feeCents,
    });
  } catch (error: any) {
    console.error('create-wallet-topup error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}