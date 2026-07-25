// §Alpha 1.3 Notification Dispatcher — finds bell-enabled followers of an
// author and delivers a Web Push notification for the new record. Mirrors the
// spec's Notification Dispatcher module: query follow_preferences where
// subject_did = author AND bell_enabled = true, check notifyOn, enqueue push.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import webPush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const authorDid = String(body.author_did || user.did || '');
    const authorName = String(body.author_name || 'A collector');
    const category = String(body.category || '');
    const preview = String(body.preview || '').slice(0, 140);
    const url = String(body.url || '/');
    if (!authorDid || !category) {
      return Response.json({ error: 'author_did and category required' }, { status: 400 });
    }

    const prefs = await svc.entities.FollowPreference.filter(
      { subject_did: authorDid, bell_enabled: true },
      '-created_date',
      500,
    );

    // Map follower DID -> serialized PushSubscription via User records.
    const users = await svc.entities.User.list('-created_date', 500);
    const subByDid = new Map();
    for (const u of users) {
      if (u.push_subscription && u.did) subByDid.set(u.did, u.push_subscription);
    }

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    let pushConfigured = !!(publicKey && privateKey);
    if (pushConfigured) {
      try {
        webPush.setVapidDetails('mailto:support@swappulse.org', publicKey, privateKey);
      } catch (e) {
        // Malformed VAPID key — degrade to no-push instead of failing the call.
        console.error('VAPID setup failed', e?.message || e);
        pushConfigured = false;
      }
    }

    let dispatched = 0;
    let skipped = 0;
    for (const pref of prefs) {
      const notifyOn = pref.notify_on || [];
      if (!notifyOn.includes(category)) { skipped++; continue; }
      const subStr = subByDid.get(pref.did);
      if (!subStr || !pushConfigured) { skipped++; continue; }
      try {
        await webPush.sendNotification(
          JSON.parse(subStr),
          JSON.stringify({ title: `${authorName} · SwapPulse`, body: preview || 'New post', url }),
        );
        dispatched++;
      } catch (e) {
        // 410/404 = expired subscription — silently drop, no retry.
        skipped++;
      }
    }
    return Response.json({ dispatched, skipped, total_prefs: prefs.length });
  } catch (error) {
    console.error('dispatchBellNotifications error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});