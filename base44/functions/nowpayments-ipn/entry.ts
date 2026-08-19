// nowpayments-ipn — receives NowPayments IPN (Instant Payment Notification)
// webhooks. Verifies the HMAC-SHA-512 signature manually (Web Crypto) using
// NOWPAYMENTS_IPN_SECRET: the body is parsed, keys sorted alphabetically,
// JSON-stringified, and HMAC'd; the hex digest is compared with the
// x-nowpayments-sig header. On a valid notification it updates the
// CryptoDonation status and, when the payment finishes, emails the donor a
// confirmation receipt via SMTP. Idempotent: status updates are safe to apply
// repeatedly. Returns 200 on processed/permanent errors, 500 on transient DB
// errors, 401 on bad signatures.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';
import { buildDonationThankYouEmail } from '../../shared/emailContent.ts';
import { timingSafeEqual } from '../../shared/cryptoCompare.ts';

function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return sorted;
}

async function verifyIpnSignature(rawBody: string, signature: string, ipnSecret: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(rawBody);
    const sortedJson = JSON.stringify(sortObjectKeys(parsed));
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(ipnSecret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(sortedJson));
    const computed = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return timingSafeEqual(computed, signature);
  } catch (e) {
    console.error('nowpayments-ipn: signature verify failed', e?.message || e);
    return false;
  }
}

export default async function(req) {
  const ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_SECRET');
  if (!ipnSecret) {
    console.error('nowpayments-ipn: NOWPAYMENTS_IPN_SECRET not configured');
    return new Response('not configured', { status: 500 });
  }
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-nowpayments-sig') || '';
    const valid = await verifyIpnSignature(rawBody, signature, ipnSecret);
    if (!valid) {
      console.error('nowpayments-ipn: invalid signature');
      return new Response('invalid signature', { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const parsed = JSON.parse(rawBody);
    const paymentId = String(parsed.payment_id || '');
    const status = String(parsed.payment_status || '');
    if (!paymentId || !status) return new Response('ok', { status: 200 });

    const records = await svc.entities.CryptoDonation.filter({ nowpayments_id: paymentId }).catch(() => []);
    if (!records.length) return new Response('ok', { status: 200 });
    const record = records[0];

    await svc.entities.CryptoDonation.update(record.id, {
      payment_status: status,
      ipn_received_at: new Date().toISOString(),
    });

    if (status === 'finished' && record.donor_email) {
      try {
        const email = buildDonationThankYouEmail(record.price_amount, 'USD', 'crypto', record.donor_name || '');
        await sendBrandedEmail({ to: record.donor_email, ...email });
      } catch (e) {
        console.error('nowpayments-ipn: confirmation email failed', e?.message || e);
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('nowpayments-ipn error', error?.message || error);
    return new Response('error', { status: 500 });
  }
}