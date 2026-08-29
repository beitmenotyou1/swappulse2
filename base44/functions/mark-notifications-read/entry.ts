import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Marks one or more notifications read for the authenticated recipient.
// Notification records themselves are backend-controlled so a browser cannot
// rewrite actors, targets, grouping metadata, or forge notifications.
export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = String(user.data?.did || user.did || '').trim();
    if (!did) return Response.json({ error: 'No DID configured' }, { status: 409 });

    const body = await req.json().catch(() => ({}));
    const notificationId = String(body.notificationId || '').trim();
    const markAll = body.all === true;
    if (!notificationId && !markAll) {
      return Response.json({ error: 'notificationId or all=true is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    if (notificationId) {
      const notification = await svc.entities.Notification.get(notificationId).catch(() => null);
      if (!notification) return Response.json({ error: 'Notification not found' }, { status: 404 });
      if (String(notification.did || '') !== did) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (!notification.is_read) {
        await svc.entities.Notification.update(notification.id, { is_read: true, read_at: now });
      }
      return Response.json({ ok: true, updated: notification.is_read ? 0 : 1 });
    }

    const unread = await svc.entities.Notification.filter({ did, is_read: false }, '-created_date', 500).catch(() => []);
    let updated = 0;
    for (const notification of unread || []) {
      await svc.entities.Notification.update(notification.id, { is_read: true, read_at: now });
      updated += 1;
    }
    return Response.json({ ok: true, updated });
  } catch (error: any) {
    console.error('mark-notifications-read error:', error?.message || error);
    return Response.json({ error: 'Could not update notifications' }, { status: 500 });
  }
}
