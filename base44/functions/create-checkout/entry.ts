// create-checkout — initiates a Stripe Checkout Session for a marketplace
// listing purchase. Validates the listing is active and the price meets the
// minimum (0.50), creates the Stripe session with metadata marking it as a
// marketplace purchase, marks the listing pending, and returns the hosted
// checkout redirect URL. Public (buyers may not have an account) but guarded
// by Cloudflare Turnstile. The stripe-webhook confirms the payment and marks
// the listing sold.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAppUrl } from '../../shared/appUrl.ts';
import { verifyTurnstile } from '../../shared/payments.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const listingId = body.listingId;
    if (!listingId) return Response.json({ error: 'listingId required' }, { status: 400 });

    const turnstileOk = await verifyTurnstile(body.turnstileToken);
    if (!turnstileOk) return Response.json({ error: 'Bot verification failed.' }, { status: 403 });

    const listing = await svc.entities.MarketListing.get(listingId).catch(() => null);
    if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
    if (listing.status !== 'active') return Response.json({ error: 'This listing is no longer available.' }, { status: 409 });

    const price = Number(listing.price);
    if (!Number.isFinite(price) || price < 0.50) {
      return Response.json({ error: 'Minimum sale price is 0.50 in the listing currency.' }, { status: 400 });
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) {
      console.error('create-checkout: STRIPE_SECRET_KEY not configured');
      return Response.json({ error: 'Payments are not configured.' }, { status: 500 });
    }

    const appUrl = resolveAppUrl(req);
    const currency = String(listing.currency || 'GBP').toLowerCase();
    const conditionLabel = listing.condition ? ` · ${listing.condition.replace(/_/g, ' ')}` : '';
    const itemName = `${listing.card_name}${conditionLabel}`.slice(0, 255);

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('payment_method_types[0]', 'card');
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', currency);
    params.append('line_items[0][price_data][product_data][name]', itemName);
    params.append('line_items[0][price_data][unit_amount]', String(Math.round(price * 100)));
    params.append('success_url', `${appUrl}/order-complete`);
    params.append('cancel_url', `${appUrl}/trades`);
    params.append('metadata[type]', 'marketplace');
    params.append('metadata[listing_id]', listingId);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const session = await stripeRes.json().catch(() => ({}));
    if (!stripeRes.ok || !session.url || !session.id) {
      console.error('create-checkout: Stripe error', JSON.stringify(session));
      return Response.json({ error: session?.error?.message || 'Checkout unavailable. Please try again later.' }, { status: 502 });
    }

    await svc.entities.MarketListing.update(listingId, {
      status: 'pending',
      checkout_session_id: session.id,
      buyer_did: body.buyerDid || '',
      buyer_name: body.buyerName || '',
    });

    return Response.json({ redirectUrl: session.url, checkoutSessionId: session.id });
  } catch (error) {
    console.error('create-checkout error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}