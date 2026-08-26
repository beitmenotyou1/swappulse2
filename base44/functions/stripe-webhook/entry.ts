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
import { timingSafeEqual } from '../../shared/cryptoCompare.ts';

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
  return timingSafeEqual(computed, v1);
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

    // Handle wallet top-up PaymentIntent success
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data?.object || {};
      const type = pi.metadata?.type;
      if (type === 'wallet_topup') {
        const did = pi.metadata?.did;
        const amountCents = Number(pi.metadata?.amount_cents || pi.amount || 0);
        if (did && amountCents > 0) {
          try {
            // Find the pending FiatTopUp record
            const topups = await svc.entities.FiatTopUp
              .filter({ stripe_payment_intent_id: pi.id }).catch(() => []);
            const pending = topups.filter((t) => t.status === 'pending');
            if (pending.length) {
              const topup = pending[0];
              const feeCents = Math.floor((amountCents * 200) / 10000);

              // Mark the top-up as succeeded
              await svc.entities.FiatTopUp.update(topup.id, {
                status: 'succeeded',
                stripe_charge_id: String(pi.latest_charge || pi.charges?.data?.[0]?.id || ''),
              });

              // Get or create the wallet balance — resolve active wallet
              // (MultiChainWallet preferred, CustodialWallet fallback)
              const { resolveActiveWallet } = await import('../../shared/walletEscrow.ts');
              const activeWallet = await resolveActiveWallet(base44, did);
              if (activeWallet) {
                const walletAddress = activeWallet.wallet_address;
                const balances = await svc.entities.WalletBalance
                  .filter({ did }, '-created_date', 1).catch(() => []);
                let balance = balances[0];
                if (!balance) {
                  balance = await svc.entities.WalletBalance.create({
                    did,
                    wallet_address: walletAddress,
                    fiat_cents: 0,
                    usdc_wei: '0',
                    total_topup_cents: 0,
                    total_fees_paid_wei: '0',
                    last_updated_at: new Date().toISOString(),
                  });
                }
                // Credit the fiat balance (amount minus fee)
                await svc.entities.WalletBalance.update(balance.id, {
                  fiat_cents: (balance.fiat_cents || 0) + amountCents - feeCents,
                  total_topup_cents: (balance.total_topup_cents || 0) + amountCents - feeCents,
                  last_updated_at: new Date().toISOString(),
                });

                // Record the top-up credit transfer
                await svc.entities.CryptoTransfer.create({
                  did,
                  transfer_type: 'topup_credit',
                  from_address: 'stripe',
                  to_address: walletAddress,
                  amount_wei: '0',
                  fee_wei: '0',
                  status: 'confirmed',
                  description: `Top-up of ${(amountCents / 100).toFixed(2)} ${topup.currency || 'GBP'} via Stripe`,
                  fiat_topup_id: topup.id,
                });

                // Record the top-up fee in the ledger as pending on-chain
                // sweep. The sweep-fees function will swap POL for USDC
                // (if needed) and send the USDC to the platform fee wallet
                // on Polygon. Gas is paid in POL from the platform wallet.
                try {
                  const { fiatCentsToUsdcWei } = await import('../../shared/walletEscrow.ts');
                  const feeUsdcWei = fiatCentsToUsdcWei(feeCents);
                  if (feeUsdcWei > 0n) {
                    await svc.entities.FiatTopUp.update(topup.id, {
                      fee_usdc_wei: feeUsdcWei.toString(),
                    });
                    await svc.entities.FeeLedger.create({
                      fee_source: 'topup',
                      source_did: did,
                      original_amount_cents: amountCents,
                      fee_usdc_wei: feeUsdcWei.toString(),
                      swept: false,
                      reference_id: topup.id,
                    });
                  }
                } catch (e) {
                  console.error('Fee recording failed:', (e as any)?.message);
                }

                // Auto-mint welcome NFTs on the user's first successful top-up.
                // Mints the soulbound username NFT and a fixed platform welcome
                // card NFT into the collector's wallet. Only fires once (the
                // username NFT check in autoMint prevents re-runs).
                try {
                  const allTopups = await svc.entities.FiatTopUp
                    .filter({ did }, '-created_date', 500).catch(() => []);
                  const succeededCount = allTopups.filter(t => t.status === 'succeeded').length;
                  if (succeededCount <= 1) {
                    const { mintWelcomeNfts } = await import('../../shared/autoMint.ts');
                    const users = await svc.entities.User.filter({ did }).catch(() => []);
                    const handle = users[0]?.bsky_handle || users[0]?.username || '';
                    await mintWelcomeNfts(svc, did, walletAddress, handle, req.url);
                  }
                } catch (e) {
                  console.error('autoMint on top-up failed:', (e as any)?.message || e);
                }

                // Send top-up complete notification (in-app + push)
                try {
                  const { dispatchNotification } = await import('../../shared/notificationDispatcher.ts');
                  const currency = topup.currency || 'GBP';
                  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
                  const netCents = amountCents - feeCents;
                  await svc.entities.Notification.create({
                    did,
                    action_type: 'wallet_topup',
                    actor_name: 'SwapPulse',
                    actor_handle: 'swappulse',
                    target_type: 'wallet',
                    target_path: '/wallet',
                    target_label: `${symbol}${(netCents / 100).toFixed(2)} added`,
                    is_read: false,
                    metadata: { amountCents, feeCents, currency, topupId: topup.id },
                  });
                  await dispatchNotification(svc, {
                    recipientDid: did,
                    type: 'wallet_topup',
                    title: '💰 Top-up Complete',
                    body: `Your ${symbol}${(netCents / 100).toFixed(2)} top-up is now available in your wallet.`,
                    params: {},
                    priority: 'standard',
                  });
                } catch (e) {
                  console.error('Top-up notification failed:', (e as any)?.message);
                }
              }
            }
          } catch (e) {
            console.error('wallet top-up webhook handling failed:', (e as any)?.message);
          }
        }
      }
    }

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
              // Best-effort: look up the donor's saved locale if they're a registered user.
              let donorLocale: string | undefined;
              try {
                const users = await svc.entities.User.list('-created_date', 500);
                const donor = users.find((x) => (x.email || '').toLowerCase() === donorEmail.toLowerCase());
                donorLocale = donor?.locale;
              } catch {}
              const email = buildDonationThankYouEmail(pending[0].amount, 'GBP', 'card', donorName, donorLocale);
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