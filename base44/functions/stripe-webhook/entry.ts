// stripe-webhook — receives Stripe checkout events. Verifies the HMAC-SHA-256
// signature manually (Web Crypto) using STRIPE_WEBHOOK_SECRET before any state
// change. On checkout.session.completed it routes by metadata.type:
//   - 'marketplace': marks the pending MarketListing sold.
//   - 'donation' (default): marks the FiatDonation completed and emails the
//     donor a confirmation receipt via SMTP.
// On checkout.session.expired it marks pending donations expired. Idempotent:
// redelivered events find no pending records and no-op. Returns 200 on
// processed/permanent errors (so Stripe stops retrying), 500 on transient DB
// errors (so Stripe retries), 401 on bad signatures.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';
import { buildDonationThankYouEmail } from '../../shared/emailContent.ts';

async function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const part of sigHeader.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k && v) parts[k] = v;
  }
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (Number.isNaN(age) || age > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  const computed = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return computed === v1;
}

export default async function(req) {
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET not configured');
    return new Response('not configured', { status: 500 });
  }
  try {
    const rawBody = await req.text();
    const sig = req.headers.get('stripe-signature') || '';
    const valid = await verifyStripeSignature(rawBody, sig, webhookSecret);
    if (!valid) {
      console.error('stripe-webhook: signature verification failed');
      return new Response('invalid signature', { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const event = JSON.parse(rawBody);

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object || {};
      const type = session.metadata?.type || 'donation';

      if (type === 'marketplace') {
        const listingId = session.metadata?.listing_id;
        if (listingId) {
          const listings = await svc.entities.MarketListing.filter({ checkout_session_id: session.id }).catch(() => []);
          const pending = listings.filter((l) => l.status === 'pending');
          await Promise.all(pending.map((l) =>
            svc.entities.MarketListing.update(l.id, { status: 'sold', checkout_session_id: '' }),
          ));
        }
      } else {
        const records = await svc.entities.FiatDonation.filter({ stripe_session_id: session.id }).catch(() => []);
        const pending = records.filter((r) => r.payment_status === 'pending');
        if (pending.length) {
          await Promise.all(pending.map((r) =>
            svc.entities.FiatDonation.update(r.id, {
              payment_status: 'completed',
              payment_intent_id: String(session.payment_intent || ''),
              stripe_customer_id: String(session.customer || ''),
            }),
          ));
          const donorEmail = session.metadata?.donor_email || pending[0].donor_email;
          const donorName = session.metadata?.donor_name || pending[0].donor_name || '';
          if (donorEmail) {
            try {
              const email = buildDonationThankYouEmail(pending[0].amount, 'GBP', 'card', donorName);
              await sendBrandedEmail({ to: donorEmail, ...email });
            } catch (e) {
              console.error('stripe-webhook: confirmation email failed', e?.message || e);
            }
          }
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data?.object || {};
      const records = await svc.entities.FiatDonation.filter({ stripe_session_id: session.id }).catch(() => []);
      const pending = records.filter((r) => r.payment_status === 'pending');
      await Promise.all(pending.map((r) =>
        svc.entities.FiatDonation.update(r.id, { payment_status: 'expired' }),
      ));
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('stripe-webhook error', error?.message || error);
    return new Response('error', { status: 500 });
  }
}