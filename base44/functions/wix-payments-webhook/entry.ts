// §2.9 wix-payments-webhook — receives Wix Payments order events. On order
// approved, matches the checkout session to a pending MarketListing and marks
// it sold. JWT is verified against the WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY.
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

      const listings = await svc.entities.MarketListing.filter({ checkout_session_id: checkoutId }).catch(() => []);
      for (const l of listings) {
        if (l.status === 'pending') {
          await svc.entities.MarketListing.update(l.id, { status: 'sold', checkout_session_id: '' });
        }
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('wix-webhook error', error);
    return new Response('error', { status: 200 });
  }
});