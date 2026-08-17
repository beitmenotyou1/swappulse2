// submit-data-subject-request — creates a DataSubjectRequest (GDPR/CCPA/UK DPA)
// and notifies admins via email. Auth required (the user submits their own
// request). Idempotent: if a pending request of the same type already exists
// within a 24h cooldown, returns the existing one instead of creating a
// duplicate.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildAdminAlertEmail, COLORS, esc } from '../../shared/emailContent.ts';
import { sendBrandedEmail } from '../../shared/smtpSender.ts';

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const VALID_TYPES = new Set([
  'access', 'rectification', 'erasure', 'objection',
  'restriction', 'consent_withdrawal', 'portability',
]);

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const requestType = body.request_type;
    const details = body.details || '';

    if (!VALID_TYPES.has(requestType)) {
      return Response.json({ error: 'Invalid request type' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Idempotency: check for an existing pending request of the same type
    const existing = await base44.entities.DataSubjectRequest
      .filter({ request_type: requestType, status: 'pending' }, '-created_date', 5)
      .catch(() => []);

    for (const ex of existing || []) {
      if (ex.created_by_id === user.id) {
        const age = Date.now() - new Date(ex.created_date).getTime();
        if (age < COOLDOWN_MS) {
          return Response.json({
            ok: true,
            request: ex,
            message: 'You already have a pending request of this type. We will respond within 30 days.',
          });
        }
      }
    }

    // Create via user-scoped client so created_by_id is set correctly
    const record = await base44.entities.DataSubjectRequest.create({
      user_id: user.id,
      did: user.did || '',
      request_type: requestType,
      details,
      status: 'pending',
    });

    // Notify admins in the background — urgent branded email
    try {
      const admins = await svc.entities.User.filter({ role: 'admin' }).catch(() => []);
      const emailObj = buildAdminAlertEmail({
        subject: `New data subject request: ${requestType}`,
        preheader: `A collector submitted a ${requestType} request, review in the Admin dashboard.`,
        heading: 'New data subject request',
        bodyHtml: `
          <p style="margin:0 0 14px;font-size:15px;color:${COLORS.muted};line-height:1.7;">
            A collector submitted a data subject request under GDPR / CCPA / UK DPA. Respond within 30 days.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.cardHover};border-radius:10px;border:1px solid ${COLORS.border};margin-bottom:14px;">
            <tr><td style="padding:14px 18px;">
              <div style="font-size:13px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Type</div>
              <div style="font-size:16px;font-weight:700;color:${COLORS.text};">${esc(requestType)}</div>
            </td></tr>
            <tr><td style="padding:0 18px 14px;">
              <div style="font-size:13px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">From</div>
              <div style="font-size:15px;color:${COLORS.text};">${esc(user.email || user.id)}</div>
            </td></tr>
            <tr><td style="padding:0 18px 14px;">
              <div style="font-size:13px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Details</div>
              <div style="font-size:14px;color:${COLORS.text};line-height:1.6;">${esc(details || '(none provided)')}</div>
            </td></tr>
          </table>`,
        ctaLink: 'https://swappulse.org/admin',
        ctaLabel: 'Open Admin Dashboard',
        footerReason: "You're receiving this admin alert because a collector exercised a data protection right. Review it under Data Subject Requests.",
      });
      for (const admin of admins) {
        if (admin.email) {
          await sendBrandedEmail({ to: admin.email, ...emailObj }).catch((e: any) => {
            console.error('submit-data-subject-request: admin email failed', admin.email, e?.message || e);
          });
        }
      }
    } catch (e: any) {
      console.error('submit-data-subject-request: admin notification failed', e?.message || e);
    }

    return Response.json({ ok: true, request: record });
  } catch (error: any) {
    console.error('submit-data-subject-request error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}