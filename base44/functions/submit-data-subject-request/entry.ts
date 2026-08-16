// submit-data-subject-request — creates a DataSubjectRequest (GDPR/CCPA/UK DPA)
// and notifies admins via email. Auth required (the user submits their own
// request). Idempotent: if a pending request of the same type already exists
// within a 24h cooldown, returns the existing one instead of creating a
// duplicate.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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

    // Notify admins in the background
    try {
      const admins = await svc.entities.User.filter({ role: 'admin' }).catch(() => []);
      for (const admin of admins) {
        if (admin.email) {
          await base44.integrations.Core.SendEmail({
            to: admin.email,
            subject: `New data subject request: ${requestType}`,
            body: [
              `A collector submitted a data subject request.`,
              ``,
              `Type: ${requestType}`,
              `From: ${user.email || user.id}`,
              `Details: ${details || '(none provided)'}`,
              ``,
              `Review it in the Admin dashboard under Data Subject Requests.`,
            ].join('\n'),
          }).catch((e: any) => {
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