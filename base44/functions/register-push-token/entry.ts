// register-push-token — called by the client when the user subscribes to or
// unsubscribes from web push. Creates/updates a PushToken record (multi-device
// support) and mirrors to the legacy User.push_subscription for backward compat.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.did) return Response.json({ error: 'A linked identity is required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'register';

    if (action === 'unregister') {
      // Deactivate the token matching this endpoint (or all user tokens)
      const svc = base44.asServiceRole;
      try {
        await svc.entities.PushToken.updateMany(
          { did: user.did, created_by_id: user.id, ...(body.endpoint ? { endpoint: String(body.endpoint) } : {}) },
          { $set: { is_active: false } },
        );
      } catch (e) {
        console.error('unregister-push-token error', e?.message || e);
      }
      // Also clear legacy through the service role. User.push_subscription is
      // backend-managed because it contains a sensitive push endpoint + keys.
      try { await svc.entities.User.update(user.id, { push_subscription: '' }); } catch {}
      return Response.json({ ok: true, action: 'unregistered' });
    }

    // Register
    const subscription = body.subscription;
    if (!subscription) return Response.json({ error: 'subscription required' }, { status: 400 });

    const subStr = typeof subscription === 'string' ? subscription : JSON.stringify(subscription);
    let endpoint = '';
    try {
      if (subStr.length > 8192) throw new Error('too large');
      const parsed = JSON.parse(subStr);
      const url = new URL(parsed.endpoint);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash
          || !parsed.keys?.p256dh || !parsed.keys?.auth) throw new Error('invalid subscription');
      endpoint = url.toString();
    } catch {
      return Response.json({ error: 'Invalid push subscription' }, { status: 400 });
    }
    const platform = ['web', 'ios', 'android'].includes(body.platform) ? body.platform : 'web';
    const svc = base44.asServiceRole;

    // Check if a token with this endpoint already exists
    let existing: any = null;
    if (endpoint) {
      try {
        const tokens = await svc.entities.PushToken.filter({ did: user.did, created_by_id: user.id, endpoint }, '-created_date', 1);
        existing = tokens[0];
      } catch {}
    }

    if (existing) {
      // Update existing token
      await svc.entities.PushToken.update(existing.id, {
        subscription: subStr,
        is_active: true,
        last_used_at: new Date().toISOString(),
        platform,
      });
    } else {
      // Create new token
      await svc.entities.PushToken.create({
        created_by_id: user.id,
        did: user.did,
        subscription: subStr,
        endpoint,
        platform,
        is_active: true,
        last_used_at: new Date().toISOString(),
      });
    }

    // Mirror to legacy User.push_subscription for backward compat through the
    // service role; the browser cannot write this sensitive field directly.
    try { await svc.entities.User.update(user.id, { push_subscription: subStr }); } catch {}

    return Response.json({ ok: true, action: 'registered', endpoint });
  } catch (error) {
    console.error('register-push-token error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}