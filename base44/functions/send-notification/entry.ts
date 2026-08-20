// send-notification — main notification dispatcher. Called by the client
// (realtime.js) after creating an in-app Notification record, or by other
// backend functions/workflows. Checks preferences, quiet hours, rate limits;
// constructs the deep link; sends web push; logs delivery. Uses service role
// for entity operations (PushToken, SettingsConfig, NotificationLog).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification, SendNotificationInput } from '../../shared/notificationDispatcher.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // Security: push dispatch sends caller-supplied content to any recipient's
    // registered devices. Restrict to internal service calls — the workflow/
    // function runtime injects an internal service JWT that base44.auth.me()
    // resolves to an admin caller; a public internet caller has no such
    // token and is rejected. User-facing notifications are dispatched by
    // dedicated backend functions (notify-interaction, notify-system-event,
    // notifyTradeUpdate, matchWishlistListings, ingest-notifications) that
    // call the shared dispatcher directly via the service role, not through
    // this public endpoint.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (!body.recipientDid || !body.type || !body.title) {
      return Response.json({ error: 'recipientDid, type, and title are required' }, { status: 400 });
    }

    const input: SendNotificationInput = {
      recipientDid: body.recipientDid,
      type: body.type,
      title: body.title,
      body: body.body || '',
      params: body.params || {},
      subjectUri: body.subjectUri,
      imageUrl: body.imageUrl,
      priority: body.priority || 'standard',
      actorDid: body.actorDid,
    };

    const svc = base44.asServiceRole;
    const result = await dispatchNotification(svc, input);

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('send-notification error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}