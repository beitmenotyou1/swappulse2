// confirm-subscription — public function to confirm a status subscription
// (double-opt-in) or unsubscribe via token.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const token = String(body.token || '');
    const action = String(body.action || 'confirm');

    if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const all = await svc.entities.StatusSubscriber.list('-created_date', 500);

    if (action === 'unsubscribe') {
      const sub = all.find((s) => s.unsubscribe_token === token);
      if (!sub) return Response.json({ error: 'Invalid token' }, { status: 404 });
      await svc.entities.StatusSubscriber.delete(sub.id);
      return Response.json({ ok: true, unsubscribed: true });
    }

    // confirm
    const sub = all.find((s) => s.confirm_token === token);
    if (!sub) return Response.json({ error: 'Invalid or expired token' }, { status: 404 });
    if (sub.confirmed_at) return Response.json({ ok: true, alreadyConfirmed: true });

    await svc.entities.StatusSubscriber.update(sub.id, {
      confirmed_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, confirmed: true });
  } catch (error) {
    console.error('confirm-subscription error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}