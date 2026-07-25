// activation-lifecycle - runs daily via the "Activation Lifecycle" workflow.
// For unverified accounts: sends a warning email 7 days after sign-up (re-sent
// weekly), and permanently deletes the account 90 days after sign-up. Verified
// accounts are ignored. The platform's user-disabled flag is not app-settable,
// so "suspension" is enforced as a warning + the persistent in-app banner.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { randomToken, HOURS_48, DAY, WARN_AFTER_DAYS, DELETE_AFTER_DAYS, REWARN_INTERVAL_DAYS } from '../../shared/activation.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const origin = req.headers.get('origin') || req.headers.get('Origin') || '';
    const now = Date.now();

    const users = await svc.entities.User.list('-created_date', 500);
    let warned = 0;
    let deleted = 0;
    let errors = 0;

    for (const u of users) {
      // Skip verified accounts; treat unknown verification as verified (safe).
      if (u.is_verified) continue;

      const created = u.created_date ? new Date(u.created_date).getTime() : now;
      const ageDays = Math.floor((now - created) / DAY);

      // 90-day permanent deletion
      if (ageDays >= DELETE_AFTER_DAYS) {
        try {
          await svc.entities.Activation.deleteMany({ user_id: u.id });
        } catch (e) {
          console.error('activation-lifecycle: delete activation failed', u.id, e?.message || e);
          errors++;
        }
        try {
          await svc.entities.User.delete(u.id);
          deleted++;
        } catch (e) {
          console.error('activation-lifecycle: delete user failed', u.id, e?.message || e);
          errors++;
        }
        continue;
      }

      // 7-day warning (throttled to once per week)
      if (ageDays >= WARN_AFTER_DAYS) {
        let record;
        try {
          const recs = await svc.entities.Activation.filter({ user_id: u.id });
          record = recs[0];
        } catch (e) {
          console.error('activation-lifecycle: lookup activation failed', u.id, e?.message || e);
        }
        const lastReminded = record?.last_reminded_at ? new Date(record.last_reminded_at).getTime() : 0;
        if (now - lastReminded < REWARN_INTERVAL_DAYS * DAY) continue;

        const token = randomToken();
        const link = `${origin}/activate?token=${token}`;
        try {
          await svc.integrations.Core.SendEmail({
            to: u.email,
            subject: 'Activate your SwapPulse account - action required',
            body: `Hi ${u.full_name || 'there'},\n\nYour SwapPulse account is still not activated. Accounts that remain unactivated are permanently deleted 90 days after sign-up.\n\nActivate now: ${link}\n\nThen enter the 6-digit code from your verification email on the activation page.\n\nIf you did not create this account, ignore this email.\n\nSwapPulse`,
          });
          if (record) {
            await svc.entities.Activation.update(record.id, {
              last_reminded_at: new Date(now).toISOString(),
              status: 'warned',
              link_token: token,
              expires_at: new Date(now + HOURS_48).toISOString(),
            });
          } else {
            await svc.entities.Activation.create({
              user_id: u.id,
              email: u.email,
              link_token: token,
              expires_at: new Date(now + HOURS_48).toISOString(),
              status: 'warned',
              last_reminded_at: new Date(now).toISOString(),
            });
          }
          warned++;
        } catch (e) {
          console.error('activation-lifecycle: warn email failed', u.id, e?.message || e);
          errors++;
        }
      }
    }

    return Response.json({ ok: true, warned, deleted, errors });
  } catch (error) {
    console.error('activation-lifecycle error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});