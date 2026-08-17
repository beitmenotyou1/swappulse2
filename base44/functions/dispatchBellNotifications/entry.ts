// §Alpha 1.3 Notification Dispatcher - finds bell-enabled followers of an
// author and delivers a Web Push notification for the new record. Mirrors the
// spec's Notification Dispatcher module: query follow_preferences where
// subject_did = author AND bell_enabled = true, check notifyOn, enqueue push.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import webPush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    // Security: bind the author identity to the caller. A regular user may
    // only dispatch push notifications to their OWN followers — the body's
    // author_did is ignored to prevent impersonation (a stranger passing an
    // arbitrary author_did to trigger another author's followers). Admin
    // callers (internal/workflow calls such as provisionSpace) may specify a
    // body author_did for cases where the author is not the caller.
    const requestedAuthorDid = String(body.author_did || '');
    const authorDid = user.role === 'admin' && requestedAuthorDid
      ? requestedAuthorDid
      : (user.did || '');
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
    // Batch-fetch only the users whose DIDs appear in the bell-enabled prefs
    // (avoids a full-table User.list scan).
    const followerDids = [...new Set(prefs.map((p) => p.did).filter(Boolean))];
    const users = followerDids.length > 0
      ? await svc.entities.User.filter({ did: { $in: followerDids } }, '-created_date', 500).catch(() => [])
      : [];
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
        // Malformed VAPID key - degrade to no-push instead of failing the call.
        console.error('VAPID setup failed', e?.message || e);
        pushConfigured = false;
      }
    }

    // Filter eligible prefs, then parallelize all push sends (independent network calls).
    const eligible = prefs.filter((pref) => {
      const notifyOn = pref.notify_on || [];
      if (!notifyOn.includes(category)) return false;
      const subStr = subByDid.get(pref.did);
      return !!subStr && pushConfigured;
    });
    let dispatched = 0;
    let skipped = prefs.length - eligible.length;
    if (eligible.length > 0) {
      const results = await Promise.allSettled(eligible.map((pref) =>
        webPush.sendNotification(
          JSON.parse(subByDid.get(pref.did)),
          JSON.stringify({ title: `${authorName} · SwapPulse`, body: preview || 'New post', url }),
        ),
      ));
      for (const r of results) {
        // 410/404 = expired subscription - silently drop, no retry.
        if (r.status === 'fulfilled') dispatched++;
        else skipped++;
      }
    }
    return Response.json({ dispatched, skipped, total_prefs: prefs.length });
  } catch (error) {
    console.error('dispatchBellNotifications error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});