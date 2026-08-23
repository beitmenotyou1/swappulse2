// notify-new-message — triggered by the New Message Notifications workflow
// when a DirectMessage is created. Creates an in-app Notification record for
// the recipient and dispatches a web push so they know they have a new message
// in real time.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const { message_id } = body;
    if (!message_id) {
      return Response.json({ error: 'message_id is required' }, { status: 400 });
    }

    // Fetch the message
    let message;
    try {
      message = await svc.entities.DirectMessage.get(message_id);
    } catch {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    const recipientDid = message.recipient_did;
    const senderDid = message.did;
    if (!recipientDid || !senderDid) {
      return Response.json({ notified: 0, reason: 'missing_dids' });
    }

    // Don't notify on self-messages
    if (recipientDid === senderDid) {
      return Response.json({ notified: 0, reason: 'self_message' });
    }

    const preview = (message.body || '').slice(0, 100);
    const conversationId = message.conversation_id || '';
    const senderName = message.author_name || 'Someone';
    const senderHandle = message.author_handle || '';
    const senderAvatar = message.author_avatar || '';

    // Create in-app Notification record
    try {
      await svc.entities.Notification.create({
        did: recipientDid,
        action_type: 'message',
        actor_did: senderDid,
        actor_name: senderName,
        actor_handle: senderHandle,
        actor_avatar: senderAvatar,
        target_type: 'profile',
        target_path: `/messages/${conversationId}`,
        target_label: preview,
        is_read: false,
        metadata: { conversationId, messageId: message_id },
      });
    } catch (e) {
      console.error('[notify-new-message] notification create failed', e?.message || e);
    }

    // Dispatch push notification
    try {
      await dispatchNotification(svc, {
        recipientDid,
        type: 'message',
        title: `New message from ${senderName}`,
        body: preview || 'You have a new message',
        params: { conversationId },
        priority: 'standard',
        actorDid: senderDid,
      });
    } catch (e) {
      console.error('[notify-new-message] push failed', e?.message || e);
    }

    return Response.json({ notified: 1 });
  } catch (error) {
    console.error('notify-new-message error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}