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
    // Require authentication — only logged-in users (or internal calls) can dispatch
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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