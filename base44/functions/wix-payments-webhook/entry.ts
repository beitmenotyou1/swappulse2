// §2.9 wix-payments-webhook - receives Wix Payments order events. On order
// approved, matches the checkout session to a pending MarketListing and marks
// it sold. JWT is verified against the WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY.
// Returns 200 on processed or permanent errors (so Wix stops retrying), 500
// on transient DB errors (so Wix retries the delivery).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import jwt from 'npm:jsonwebtoken@9';

Deno.serve(async (req) => {
  try {
    const raw = await req.text();
    const publicKey = Deno.env.get('WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
    if (!publicKey) {
      console.error('wix-webhook: missing WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');
      return new Response('no key', { status: 500 });
    }

    let payload;
    try {
      payload = jwt.verify(raw, publicKey, { algorithms: ['RS256'] });
    } catch (e) {
      console.error('wix-webhook: JWT verify failed', e.message);
      return new Response('invalid signature', { status: 401 });
    }

    const event = JSON.parse(payload.data);
    const eventData = JSON.parse(event.data);
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    if (event.eventType === 'wix.ecom.v1.order_approved') {
      const order = eventData?.actionEvent?.body?.order;
      const checkoutId = order?.checkoutId;
      if (!checkoutId) return new Response('ok', { status: 200 });

      // DB read — let transient errors propagate to the outer catch (500) so
      // Wix retries. Do NOT swallow with .catch(() => []).
      const listings = await svc.entities.MarketListing.filter({ checkout_session_id: checkoutId });
      const pending = listings.filter((l) => l.status === 'pending');
      // Idempotent: only pending listings are moved to 'sold'; a redelivered
      // event finds no pending listings and returns 200.
      await Promise.all(pending.map((l) =>
        svc.entities.MarketListing.update(l.id, { status: 'sold', checkout_session_id: '' }),
      ));
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    // Transient error (DB unavailable, etc.) — return 500 so Wix retries.
    console.error('wix-webhook error', error?.message || error);
    return new Response('error', { status: 500 });
  }
});