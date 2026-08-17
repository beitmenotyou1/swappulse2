// §2.9 create-checkout - initiates a Wix Payments checkout session for a
// marketplace listing. Validates the minimum charge (0.50), marks the listing
// pending, and returns the hosted checkout redirect URL.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Turnstile verification — keeps create-checkout public (no login, per the
// Base44 Payments integration) while blocking automated listing-locking abuse.
async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false;
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('create-checkout: TURNSTILE_SECRET_KEY not configured');
    return false;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return data?.success === true;
  } catch (e) {
    console.error('create-checkout: Turnstile verify failed', e?.message || e);
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const listingId = body.listingId;
    if (!listingId) return Response.json({ error: 'listingId required' }, { status: 400 });

    // Verify the Turnstile token before touching the listing — blocks
    // unauthenticated bots from locking listings via the public endpoint.
    const turnstileOk = await verifyTurnstile(body.turnstileToken);
    if (!turnstileOk) {
      return Response.json({ error: 'Bot verification failed.' }, { status: 403 });
    }

    const listing = await svc.entities.MarketListing.get(listingId).catch(() => null);
    if (!listing) return Response.json({ error: 'Listing not found' }, { status: 404 });
    if (listing.status !== 'active') return Response.json({ error: 'This listing is no longer available.' }, { status: 409 });

    const price = Number(listing.price);
    if (!Number.isFinite(price) || price < 0.50) {
      return Response.json({ error: 'Minimum sale price is 0.50 in the listing currency.' }, { status: 400 });
    }

    const appUrl = req.headers.get('X-Base44-App-Url') || Deno.env.get('WIX_CHECKOUT_APP_URL');
    if (!appUrl) {
      console.error('create-checkout: missing app URL (X-Base44-App-Url / WIX_CHECKOUT_APP_URL)');
      return Response.json({ error: 'Checkout not configured.' }, { status: 500 });
    }
    const apiKey = Deno.env.get('WIX_CHECKOUT_API_KEY') || Deno.env.get('WIX_PAYMENTS_API_KEY');
    const siteId = Deno.env.get('WIX_CHECKOUT_SITE_ID') || Deno.env.get('WIX_PAYMENTS_SITE_ID');
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