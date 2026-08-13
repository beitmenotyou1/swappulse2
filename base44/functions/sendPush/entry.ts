import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import webPush from 'npm:web-push@3.6.7';

// Broadcasts a Web Push notification to every registered app user. Admin-only.
// Requires VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY env vars (add in dashboard settings).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      return Response.json({ error: 'VAPID keys not configured' }, { status: 503 });
    }
    webPush.setVapidDetails('mailto:support@swappulse.org', publicKey, privateKey);

    const body = await req.json().catch(() => ({}));
    const payload = JSON.stringify({
      title: body.title || 'SwapPulse',
      body: body.body || '',
      url: body.url || '/',
    });

    const svc = base44.asServiceRole;
    const users = await svc.entities.User.list('-created_date', 500);
    const subscribed = users.filter((u) => u.push_subscription);

    // Parallelize all push sends (independent network calls).
    const results = await Promise.allSettled(subscribed.map((u) =>
      webPush.sendNotification(JSON.parse(u.push_subscription), payload),
    ));
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    return Response.json({ sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});