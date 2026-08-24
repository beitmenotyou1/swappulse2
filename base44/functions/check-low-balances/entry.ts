// check-low-balances — scheduled by the Low Balance Alerts workflow every 5
// minutes. Scans all WalletBalance records with a low_balance_threshold_cents > 0,
// and for any whose fiat_cents has dropped below their threshold (and who haven't
// been notified in the last 24h), sends an in-app + push notification. Also resets
// the notified timestamp when a balance recovers above the threshold so the alert
// can fire again on the next dip.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Security: this endpoint scans all users' wallet balances and bulk-creates
    // Notification records + dispatches push notifications via the service role,
    // so it must not be callable by arbitrary internet callers. The platform
    // injects an internal service JWT on workflow/function-to-function calls;
    // base44.auth.me() resolves that to an admin caller. A public internet
    // caller has no such token and is rejected with 403.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const balances = await svc.entities.WalletBalance.list('-created_date', 500).catch(() => []);

    let notified = 0;
    let reset = 0;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const bal of balances) {
      const threshold = bal.low_balance_threshold_cents || 0;
      if (threshold <= 0) continue;

      const fiatCents = bal.fiat_cents || 0;
      const currency = bal.currency || 'GBP';
      const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
      const did = bal.did;
      if (!did) continue;

      if (fiatCents < threshold) {
        // Throttle: skip if already notified within the last 24h
        const lastNotified = bal.low_balance_notified_at ? new Date(bal.low_balance_notified_at) : null;
        if (lastNotified && lastNotified > oneDayAgo) continue;

        try {
          await svc.entities.Notification.create({
            did,
            action_type: 'low_balance',
            actor_name: 'SwapPulse',
            actor_handle: 'swappulse',
            target_type: 'wallet',
            target_path: '/wallet',
            target_label: `${symbol}${(fiatCents / 100).toFixed(2)} remaining`,
            is_read: false,
            metadata: { thresholdCents: threshold, currentCents: fiatCents, currency },
          });
          await dispatchNotification(svc, {
            recipientDid: did,
            type: 'low_balance',
            title: '⚠️ Low Wallet Balance',
            body: `Your wallet balance is ${symbol}${(fiatCents / 100).toFixed(2)}, below your alert threshold of ${symbol}${(threshold / 100).toFixed(2)}.`,
            params: {},
            priority: 'standard',
          });
          await svc.entities.WalletBalance.update(bal.id, {
            low_balance_notified_at: now.toISOString(),
          });
          notified++;
        } catch (e) {
          console.error('[check-low-balances] notification failed for', did, (e as any)?.message);
        }
      } else if (bal.low_balance_notified_at) {
        // Balance recovered above threshold — reset so the alert can fire again
        try {
          await svc.entities.WalletBalance.update(bal.id, { low_balance_notified_at: null });
          reset++;
        } catch {}
      }
    }

    return Response.json({ success: true, checked: balances.length, notified, reset });
  } catch (error: any) {
    console.error('check-low-balances error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}