// send-test-push — sends a test web push notification to the caller so they
// can confirm their push subscription is working. Bypasses quiet hours
// (priority: 'high') but still respects the master pause preference.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const did = user.did || '';
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    const result = await dispatchNotification(base44.asServiceRole, {
      recipientDid: did,
      type: 'test_push',
      title: 'SwapPulse · Test Notification',
      body: 'Push notifications are working! You will receive alerts here.',
      params: {},
      priority: 'high',
    });

    return Response.json(result);
  } catch (error) {
    console.error('send-test-push error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}