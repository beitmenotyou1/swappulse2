// create-fiat-donation — creates a Stripe Checkout Session for a fiat (card)
// donation. Validates the Cloudflare Turnstile token, creates a FiatDonation
// record (pending), and returns the Stripe redirect URL.
//
// Secrets: STRIPE_SECRET_KEY, TURNSTILE_SECRET_KEY
// Runs as the calling user; FiatDonation create is admin-only so the service
// role is used to create the record.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAppUrl } from '../../shared/appUrl.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { amount, donorName, donorEmail, turnstileToken } = body;

    // --- Validate input ---
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0.5) {
      return Response.json({ error: 'Minimum donation is £0.50' }, { status: 400 });
    }
    if (!donorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
      return Response.json({ error: 'A valid email is required' }, { status: 400 });
    }
    if (!turnstileToken) {
      return Response.json({ error: 'Bot verification required' }, { status: 400 });
    }

    // --- Verify Turnstile token ---
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!turnstileSecret) {
      console.error('create-fiat-donation: TURNSTILE_SECRET_KEY not configured');
      return Response.json({ error: 'Server not configured' }, { status: 500 });
    }
    const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: turnstileToken }),
    });
    const turnstileData = await turnstileRes.json();
    if (!turnstileData.success) {
      return Response.json({ error: 'Bot verification failed' }, { status: 403 });
    }

    // --- Create Stripe Checkout Session ---
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('create-fiat-donation: STRIPE_SECRET_KEY not configured');
      return Response.json({ error: 'Server not configured' }, { status: 500 });
    }

    const appUrl = resolveAppUrl(req);
    const amountPence = Math.round(value * 100);

    const stripeParams = new URLSearchParams();
    stripeParams.append('payment_method_types[0]', 'card');
    stripeParams.append('mode', 'payment');
    stripeParams.append('line_items[0][price_data][currency]', 'gbp');
    stripeParams.append('line_items[0][price_data][unit_amount]', String(amountPence));
    stripeParams.append('line_items[0][price_data][product_data][name]', 'SwapPulse Donation');
    stripeParams.append('line_items[0][quantity]', '1');
    stripeParams.append('customer_email', donorEmail);
    stripeParams.append('success_url', `${appUrl}/donate/fiat-success`);
    stripeParams.append('cancel_url', `${appUrl}/donate`);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeParams,
    });

    if (!stripeRes.ok) {
      const err = await stripeRes.json().catch(() => ({}));
      console.error('create-fiat-donation: Stripe error', err);
      return Response.json({ error: 'Payment provider error' }, { status: 502 });
    }

    const session = await stripeRes.json();

    // --- Create FiatDonation record (service role bypasses admin-only RLS) ---
    try {
      await base44.asServiceRole.entities.FiatDonation.create({
        stripe_session_id: session.id,
        amount: value,
        currency: 'gbp',
        donor_email: donorEmail,
        donor_name: donorName || '',
        payment_status: 'pending',
      });
    } catch (e) {
      console.error('create-fiat-donation: FiatDonation create failed', e?.message || e);
      // Non-fatal — the Stripe session is already created; donor can still pay.
    }

    return Response.json({ redirectUrl: session.url });
  } catch (e) {
    console.error('create-fiat-donation error', e?.message || e);
    return Response.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}