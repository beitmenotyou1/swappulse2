// activation-lifecycle - runs daily via the "Activation Lifecycle" workflow.
// For unverified accounts: sends a warning email 7 days after sign-up (re-sent
// weekly), and permanently deletes the account 90 days after sign-up. Verified
// accounts are ignored. The platform's user-disabled flag is not app-settable,
// so "suspension" is enforced as a warning + the persistent in-app banner.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { randomToken, HOURS_48, DAY, WARN_AFTER_DAYS, DELETE_AFTER_DAYS, REWARN_INTERVAL_DAYS } from '../../shared/activation.ts';
import { buildActivationWarningEmail } from '../../shared/emailContent.ts';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

function isPlatformInternalCall(req: Request): boolean {
  const authz = req.headers.get('base44-service-authorization') || '';
  if (!authz.startsWith('Bearer ')) return false;
  const token = authz.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const isInternal = payload?.internal_service_token === true || payload?.internal_service_token === 'true';
    return isInternal && payload?.caller === 'backend_functions';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (!isPlatformInternalCall(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const appUrl = req.headers.get('X-Base44-App-Url') || 'https://swappulse.org';
    const now = Date.now();

    const users = await svc.entities.User.list('-created_date', 500);
    let warned = 0;
    let deleted = 0;
    let errors = 0;

    // Categorize users in a single pass.
    const deleteCandidates: any[] = [];
    const warnCandidates: any[] = [];
    for (const u of users) {
      if (u.is_verified) continue;
      const created = u.created_date ? new Date(u.created_date).getTime() : now;
      const ageDays = Math.floor((now - created) / DAY);
      if (ageDays >= DELETE_AFTER_DAYS) deleteCandidates.push(u);
      else if (ageDays >= WARN_AFTER_DAYS) warnCandidates.push(u);
    }

    // Batch-fetch Activation records for all warn candidates (replaces per-user Activation.filter N+1).
    const warnIds = warnCandidates.map((u) => u.id);
    const activationRecords = warnIds.length > 0
      ? await svc.entities.Activation.filter({ user_id: { $in: warnIds } }).catch(() => [])
      : [];
    const activationByUserId = new Map();
    for (const a of activationRecords) {
      if (!activationByUserId.has(a.user_id)) activationByUserId.set(a.user_id, a);
    }

    // Process 90-day deletions.
    for (const u of deleteCandidates) {
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
    }

    // Process 7-day warnings — collect activation updates/creates for batch operations.
    const activationUpdates: any[] = [];
    const activationCreates: any[] = [];
    for (const u of warnCandidates) {
      const record = activationByUserId.get(u.id);
      const lastReminded = record?.last_reminded_at ? new Date(record.last_reminded_at).getTime() : 0;
      if (now - lastReminded < REWARN_INTERVAL_DAYS * DAY) continue;

      const token = randomToken();
      const link = `${appUrl}/activate?token=${token}`;
      try {
        const email = buildActivationWarningEmail(u.full_name, link);
        await sendBrandedEmail({ to: u.email, ...email });
        const ts = new Date(now).toISOString();
        if (record) {
          activationUpdates.push({
            id: record.id,
            last_reminded_at: ts,
            status: 'warned',
            link_token: token,
            expires_at: new Date(now + HOURS_48).toISOString(),
          });
        } else {
          activationCreates.push({
            user_id: u.id,
            email: u.email,
            link_token: token,
            expires_at: new Date(now + HOURS_48).toISOString(),
            status: 'warned',
            last_reminded_at: ts,
          });
        }
        warned++;
      } catch (e) {
        console.error('activation-lifecycle: warn email failed', u.id, e?.message || e);
        errors++;
      }
    }

    // Batch-update and batch-create activation records (replaces per-user update/create N+1).
    if (activationUpdates.length > 0) {
      await svc.entities.Activation.bulkUpdate(activationUpdates).catch((e) =>
        console.error('activation-lifecycle: bulk update failed', e?.message || e),
      );
    }
    if (activationCreates.length > 0) {
      await svc.entities.Activation.bulkCreate(activationCreates).catch((e) =>
        console.error('activation-lifecycle: bulk create failed', e?.message || e),
      );
    }

    return Response.json({ ok: true, warned, deleted, errors });
  } catch (error) {
    console.error('activation-lifecycle error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});