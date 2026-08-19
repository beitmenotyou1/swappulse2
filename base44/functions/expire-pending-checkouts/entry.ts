// expire-pending-checkouts — reverts marketplace listings stuck in 'pending'
// when a buyer abandons Stripe Checkout. Queries all pending MarketListing
// records with a checkout_session_id, calls the Stripe API to check each
// session's actual expiry status, and reverts listings whose session has
// expired AND was not paid back to 'active' (clearing buyer fields).
// Idempotent: skips sessions that are paid or still active. Invoked by a
// scheduled workflow every 30 minutes.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('expire-pending-checkouts: STRIPE_SECRET_KEY not configured');
      return Response.json({ error: 'not configured' }, { status: 500 });
    }

    const pending = await svc.entities.MarketListing
      .filter({ status: 'pending' }, '-created_date', 500)
      .catch(() => []);

    if (!pending || pending.length === 0) {
      return Response.json({ checked: 0, reverted: 0 });
    }

    let checked = 0;
    let reverted = 0;
    const nowSec = Math.floor(Date.now() / 1000);

    for (const listing of pending) {
      if (!listing.checkout_session_id) continue;
      checked++;
      try {
        const res = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(listing.checkout_session_id)}`,
          { headers: { Authorization: `Bearer ${stripeKey}` } },
        );
        if (!res.ok) {
          console.error(`expire-pending-checkouts: Stripe API ${res.status} for ${listing.checkout_session_id}`);
          continue;
        }
        const session = await res.json();
        // Skip if payment was completed — the webhook handles that path.
        if (session.payment_status === 'paid') continue;
        // Revert only if the session has actually expired.
        const expiresAt = session.expires_at
          ? Math.floor(new Date(session.expires_at * 1000).getTime() / 1000)
          : 0;
        if (expiresAt && expiresAt < nowSec) {
          await svc.entities.MarketListing.update(listing.id, {
            status: 'active',
            checkout_session_id: '',
            buyer_did: '',
            buyer_name: '',
          });
          reverted++;
        }
      } catch (e) {
        console.error(`expire-pending-checkouts: error for ${listing.checkout_session_id}`, e?.message || e);
      }
    }

    return Response.json({ checked, reverted });
  } catch (error) {
    console.error('expire-pending-checkouts error', error?.message || error);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}