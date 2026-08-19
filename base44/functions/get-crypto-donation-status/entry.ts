// get-crypto-donation-status — polled by the crypto donation UI every 5
// seconds after a payment is created. Looks up the local CryptoDonation record
// by NowPayments payment id, queries NowPayments for the live status, and
// returns the current payment status + deposit details. Public (the donor may
// not be logged in); the payment id is a non-guessable NowPayments identifier.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const paymentId = String(body.paymentId || '');
    if (!paymentId) return Response.json({ error: 'paymentId required' }, { status: 400 });

    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    const svc = base44.asServiceRole;
    const records = await svc.entities.CryptoDonation.filter({ nowpayments_id: paymentId }, '-created_date', 1).catch(() => []);
    if (!records.length) return Response.json({ error: 'Donation not found' }, { status: 404 });
    const record = records[0];

    // If NowPayments is not configured, return the last known local status.
    if (!apiKey) {
      return Response.json({
        paymentStatus: record.payment_status,
        payAddress: record.pay_address,
        payAmount: record.pay_amount,
        payCurrency: record.pay_currency,
      });
    }

    const npRes = await fetch(`https://api.nowpayments.io/v1/payment/${encodeURIComponent(paymentId)}`, {
      headers: { 'x-api-key': apiKey },
    });
    const data = await npRes.json().catch(() => ({}));
    if (!npRes.ok) {
      console.error('get-crypto-donation-status: NowPayments error', JSON.stringify(data));
      return Response.json({
        paymentStatus: record.payment_status,
        payAddress: record.pay_address,
        payAmount: record.pay_amount,
        payCurrency: record.pay_currency,
      });
    }

    return Response.json({
      paymentStatus: String(data.payment_status || record.payment_status || 'waiting'),
      payAddress: record.pay_address,
      payAmount: record.pay_amount,
      payCurrency: record.pay_currency,
    });
  } catch (error) {
    console.error('get-crypto-donation-status error', error?.message || error);
    return Response.json({ error: 'Status check unavailable.' }, { status: 500 });
  }
}