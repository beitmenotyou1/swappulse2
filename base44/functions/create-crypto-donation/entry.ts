// create-crypto-donation — initiates a NowPayments cryptocurrency donation.
// Validates the amount (min $0.50) and the pay_currency against the 13-symbol
// whitelist, generates a unique order id, calls the NowPayments API to create
// a payment, stores a waiting CryptoDonation record, and returns the deposit
// address + exact amount. Public (no login) but guarded by Turnstile.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveAppUrl } from '../../shared/appUrl.ts';
import { verifyTurnstile, isAllowedCryptoCurrency, generateOrderId } from '../../shared/payments.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const payCurrency = String(body.payCurrency || '');
    const donorName = String(body.donorName || '').slice(0, 100);
    const donorEmail = String(body.donorEmail || '').slice(0, 200);

    if (!Number.isFinite(amount) || amount < 0.50) {
      return Response.json({ error: 'The minimum donation is $0.50.' }, { status: 400 });
    }
    if (!isAllowedCryptoCurrency(payCurrency)) {
      return Response.json({ error: 'Selected cryptocurrency is not supported.' }, { status: 400 });
    }

    const turnstileOk = await verifyTurnstile(body.turnstileToken);
    if (!turnstileOk) {
      return Response.json({ error: 'Bot verification failed.' }, { status: 403 });
    }

    const apiKey = Deno.env.get('NOWPAYMENTS_API_KEY');
    if (!apiKey) {
      console.error('create-crypto-donation: NOWPAYMENTS_API_KEY not configured');
      return Response.json({ error: 'Crypto donations are not configured.' }, { status: 500 });
    }

    const appUrl = resolveAppUrl(req);
    const orderId = generateOrderId();
    const npRes = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: payCurrency,
        order_id: orderId,
        order_description: 'SwapPulse Community Donation',
        ipn_callback_url: `${appUrl}/api/functions/nowpayments-ipn`,
        success_url: `${appUrl}/donate/thanks`,
        cancel_url: `${appUrl}/donate`,
      }),
    });
    const data = await npRes.json().catch(() => ({}));
    if (!npRes.ok || !data.payment_id || !data.pay_address) {
      console.error('create-crypto-donation: NowPayments error', JSON.stringify(data));
      return Response.json({ error: data?.message || 'Crypto payment unavailable. Please try again later.' }, { status: 502 });
    }

    await svc.entities.CryptoDonation.create({
      nowpayments_id: String(data.payment_id),
      order_id: orderId,
      donor_name: donorName,
      donor_email: donorEmail,
      price_amount: amount,
      price_currency: 'usd',
      pay_currency: payCurrency,
      pay_amount: Number(data.pay_amount) || 0,
      pay_address: data.pay_address,
      payment_url: data.payment_url || '',
      payment_status: 'waiting',
    });

    return Response.json({
      paymentId: String(data.payment_id),
      payAddress: data.pay_address,
      payAmount: Number(data.pay_amount) || 0,
      payCurrency: payCurrency,
      paymentUrl: data.payment_url || '',
    });
  } catch (error) {
    console.error('create-crypto-donation error', error?.message || error);
    return Response.json({ error: 'Donation unavailable. Please try again later.' }, { status: 500 });
  }
}