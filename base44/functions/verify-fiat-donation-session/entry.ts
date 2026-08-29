import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SESSION_RE = /^cs_(?:test|live)_[A-Za-z0-9_]+$/;

// verify-fiat-donation-session — server-side confirmation for the Stripe return
// page. A browser redirect is never treated as proof of payment; this function
// retrieves the Checkout Session from Stripe and reconciles the local record.
export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const sessionId = String((body as any).sessionId || '').trim();
    if (!SESSION_RE.test(sessionId) || sessionId.length > 255) {
      return Response.json({ verified: false, error: 'Invalid checkout session' }, { status: 400 });
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('verify-fiat-donation-session: STRIPE_SECRET_KEY not configured');
      return Response.json({ verified: false, error: 'Payment verification unavailable' }, { status: 500 });
    }

    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
      redirect: 'error',
    });
    if (!stripeRes.ok) {
      console.error('verify-fiat-donation-session: Stripe lookup failed', stripeRes.status);
      return Response.json({ verified: false, error: 'Could not verify checkout session' }, { status: 502 });
    }

    const session = await stripeRes.json();
    if (session.id !== sessionId || session.mode !== 'payment') {
      return Response.json({ verified: false, error: 'Checkout session mismatch' }, { status: 409 });
    }

    const currency = String(session.currency || '').toLowerCase();
    const amountPence = Number(session.amount_total);
    if (currency !== 'gbp' || !Number.isInteger(amountPence) || amountPence < 50 || amountPence > 1_000_000) {
      console.error('verify-fiat-donation-session: invalid Stripe amount/currency', currency, amountPence);
      return Response.json({ verified: false, error: 'Checkout amount could not be verified' }, { status: 409 });
    }

    const paid = session.status === 'complete' && session.payment_status === 'paid';
    const svc = base44.asServiceRole;
    const rows = await svc.entities.FiatDonation.filter({ stripe_session_id: sessionId }, '-created_date', 2).catch(() => []);
    if (rows.length > 1) {
      console.error('verify-fiat-donation-session: duplicate local session id', sessionId);
      return Response.json({ verified: false, error: 'Donation record conflict' }, { status: 409 });
    }

    const local = rows[0];
    if (local) {
      const localPence = Math.round(Number(local.amount || 0) * 100);
      if (localPence !== amountPence || String(local.currency || '').toLowerCase() !== currency) {
        console.error('verify-fiat-donation-session: local/Stripe mismatch', sessionId);
        return Response.json({ verified: false, error: 'Donation amount mismatch' }, { status: 409 });
      }
    }

    if (!paid) {
      if (local && session.status === 'expired' && local.payment_status !== 'expired') {
        await svc.entities.FiatDonation.update(local.id, { payment_status: 'expired' }).catch(() => {});
      }
      return Response.json({ verified: false, status: session.payment_status || session.status || 'pending' });
    }

    const update = {
      payment_status: 'completed',
      payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : '',
      stripe_customer_id: typeof session.customer === 'string' ? session.customer : '',
    };

    if (local) {
      if (local.payment_status !== 'completed' || local.payment_intent_id !== update.payment_intent_id) {
        await svc.entities.FiatDonation.update(local.id, update);
      }
    } else {
      const donorEmail = String(session.customer_details?.email || session.customer_email || '').slice(0, 200);
      const donorName = String(session.metadata?.donor_name || session.customer_details?.name || '').slice(0, 100);
      await svc.entities.FiatDonation.create({
        stripe_session_id: sessionId,
        amount: amountPence / 100,
        currency,
        donor_email: donorEmail,
        donor_name: donorName,
        ...update,
      });
    }

    return Response.json({
      verified: true,
      amount: amountPence / 100,
      currency,
      receipt_email: String(session.customer_details?.email || session.customer_email || '').replace(/^(.{0,2}).*(@.*)$/, '$1***$2'),
    });
  } catch (error: any) {
    console.error('verify-fiat-donation-session error:', error?.message || error);
    return Response.json({ verified: false, error: 'Could not verify donation' }, { status: 500 });
  }
}
