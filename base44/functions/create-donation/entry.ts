// create-donation - initiates a Wix (Base44) Payments checkout session for an
// open amount donation. Validates the minimum charge (0.50) and returns the
// hosted checkout redirect URL. No auth required - visitors can donate.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    createClientFromRequest(req); // initialise context (not used for auth)

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0.50) {
      return Response.json({ error: 'The minimum donation is 0.50 in your currency.' }, { status: 400 });
    }

    const appUrl = req.headers.get('X-Base44-App-Url') || Deno.env.get('WIX_CHECKOUT_APP_URL');
    if (!appUrl) {
      console.error('create-donation: missing app URL (X-Base44-App-Url / WIX_CHECKOUT_APP_URL)');
      return Response.json({ error: 'Checkout not configured.' }, { status: 500 });
    }
    const apiKey = Deno.env.get('WIX_PAYMENTS_API_KEY');
    const siteId = Deno.env.get('WIX_PAYMENTS_SITE_ID');
    if (!apiKey || !siteId) {
      console.error('create-donation: missing Wix Payments env');
      return Response.json({ error: 'Payments are not configured right now.' }, { status: 500 });
    }

    const wixResp = await fetch('https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
        'wix-site-id': siteId,
      },
      body: JSON.stringify({
        cart: { items: [{ name: 'Donation to SwapPulse', quantity: 1, price: amount.toFixed(2) }] },
        callbackUrls: {
          postFlowUrl: `${appUrl}/`,
          thankYouPageUrl: `${appUrl}/donate/thanks`,
        },
      }),
    });

    const data = await wixResp.json().catch(() => ({}));
    if (!wixResp.ok || !data.checkoutSession?.redirectUrl) {
      console.error('create-donation: Wix error', JSON.stringify(data));
      return Response.json({ error: data?.message || 'Checkout is unavailable right now. Please try again later.' }, { status: 502 });
    }

    return Response.json({ redirectUrl: data.checkoutSession.redirectUrl, checkoutSessionId: data.checkoutSession.id });
  } catch (error) {
    console.error('create-donation error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});