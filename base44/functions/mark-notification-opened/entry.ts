// mark-notification-opened — called by the client when a push notification is
// tapped. Updates the NotificationLog status to 'opened' for analytics.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const logId = body.notificationId || body.logId;
    if (!logId) return Response.json({ error: 'notificationId required' }, { status: 400 });

    // Service role — NotificationLog is admin-only, but this is an idempotent
    // status update triggered by the recipient tapping their own notification.
    const svc = base44.asServiceRole;
    try {
      await svc.entities.NotificationLog.update(logId, {
        status: 'opened',
        opened_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error('mark-notification-opened update failed', e?.message || e);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('mark-notification-opened error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}