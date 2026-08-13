// §2.9 create-checkout - initiates a Wix Payments checkout session for a
// marketplace listing. Validates the minimum charge (0.50), marks the listing
// pending, and returns the hosted checkout redirect URL.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const listingId = body.listingId;
    if (!listingId) return Response.json({ error: 'listingId required' }, { status: 400 });

    const listing = await svc.entities.MarketListing.get(listingId).catch(() => null);
    if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
    if (listing.status !== 'active') return Response.json({ error: 'This listing is no longer available.' }, { status: 409 });

    const price = Number(listing.price);
    if (!Number.isFinite(price) || price < 0.50) {
      return Response.json({ error: 'Minimum sale price is 0.50 in the listing currency.' }, { status: 400 });
    }

    const appUrl = req.headers.get('X-Base44-App-Url') || Deno.env.get('WIX_CHECKOUT_APP_URL') || `https://${req.headers.get('host') || ''}`;
    const apiKey = Deno.env.get('WIX_PAYMENTS_API_KEY');
    const siteId = Deno.env.get('WIX_PAYMENTS_SITE_ID');
    if (!apiKey || !siteId) {
      console.error('create-checkout: missing Wix Payments env');
      return Response.json({ error: 'Payments not configured.' }, { status: 500 });
    }

    const conditionLabel = listing.condition ? ` · ${listing.condition.replace(/_/g, ' ')}` : '';
    const itemName = `${listing.card_name}${conditionLabel}`.slice(0, 255);

    const wixResp = await fetch('https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
        'wix-site-id': siteId,
      },
      body: JSON.stringify({
        cart: { items: [{ name: itemName, quantity: 1, price: price.toFixed(2) }] },
        callbackUrls: {
          postFlowUrl: `${appUrl}/`,
          thankYouPageUrl: `${appUrl}/order-complete`,
        },
      }),
    });

    const data = await wixResp.json().catch(() => ({}));
    if (!wixResp.ok || !data.checkoutSession?.redirectUrl) {
      console.error('create-checkout: Wix error', JSON.stringify(data));
      return Response.json({ error: data?.message || 'Checkout unavailable. Please try again later.' }, { status: 502 });
    }

    const sessionId = data.checkoutSession.id;
    await svc.entities.MarketListing.update(listingId, {
      status: 'pending',
      checkout_session_id: sessionId,
      buyer_did: body.buyerDid || '',
      buyer_name: body.buyerName || '',
    });

    return Response.json({ redirectUrl: data.checkoutSession.redirectUrl, checkoutSessionId: sessionId });
  } catch (error) {
    console.error('create-checkout error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});