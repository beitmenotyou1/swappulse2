// create-fiat-donation — initiates a Stripe Checkout Session for a fiat (card)
// donation in GBP. Validates the minimum charge (0.50), stores a pending
// FiatDonation record keyed by the Stripe session id, and returns the hosted
// checkout redirect URL. Public (no login) — donors may not have an account —
// but guarded by Cloudflare Turnstile to block automated abuse.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAppUrl } from '../../shared/appUrl.ts';
import { verifyTurnstile } from '../../shared/payments.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const donorName = String(body.donorName || '').slice(0, 100);
    const donorEmail = String(body.donorEmail || '').slice(0, 200);

    if (!Number.isFinite(amount) || amount < 0.50) {
      return Response.json({ error: 'The minimum donation is £0.50.' }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(body.turnstileToken);
    if (!turnstileOk) {
      return Response.json({ error: 'Bot verification failed.' }, { status: 403 });
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) {
      console.error('create-fiat-donation: STRIPE_SECRET_KEY not configured');
      return Response.json({ error: 'Card donations are not configured.' }, { status: 500 });
    }

    const appUrl = resolveAppUrl(req);
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('payment_method_types[0]', 'card');
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'gbp');
    params.append('line_items[0][price_data][product_data][name]', 'SwapPulse Community Donation');
    params.append('line_items[0][price_data][unit_amount]', String(Math.round(amount * 100)));
    params.append('line_items[0][adjustable_quantity][enabled]', 'true');
    params.append('line_items[0][adjustable_quantity][minimum]', '1');
    params.append('line_items[0][adjustable_quantity][maximum]', '100');
    params.append('success_url', `${appUrl}/donate/fiat-success`);
    params.append('cancel_url', `${appUrl}/donate`);
    params.append('metadata[type]', 'donation');
    params.append('metadata[donor_name]', donorName);
    params.append('metadata[donor_email]', donorEmail);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const session = await stripeRes.json().catch(() => ({}));
    if (!stripeRes.ok || !session.url || !session.id) {
      console.error('create-fiat-donation: Stripe error', JSON.stringify(session));
      return Response.json({ error: session?.error?.message || 'Checkout unavailable. Please try again later.' }, { status: 502 });
    }

    await svc.entities.FiatDonation.create({
      stripe_session_id: session.id,
      amount,
      currency: 'gbp',
      donor_email: donorEmail,
      donor_name: donorName,
      payment_status: 'pending',
    });

    return Response.json({ redirectUrl: session.url, checkoutSessionId: session.id });
  } catch (error) {
    console.error('create-fiat-donation error', error?.message || error);
    return Response.json({ error: 'Donation unavailable. Please try again later.' }, { status: 500 });
  }
}