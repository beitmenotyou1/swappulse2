// import-notification-snapshot — one-time import of a user's recent Bluesky
// notifications (likes, replies, reposts, follows, mentions, quotes) into the
// local Notification entity so the user has an immediate notification snapshot
// on SwapPulse after linking. Calls app.bsky.notification.listNotifications
// once (returns only recent items, not full history — best-effort). Deduped by
// source_uri so re-running doesn't duplicate.
//
// Called by migrate-to-swappulse on link. Idempotent via source_uri dedup.
//
// Output: { ok, imported, skipped }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveBridgeSession } from '../../shared/bridgeSession.ts';

const APPVIEW = 'https://public.api.bsky.app';

// Map Bluesky notification reason → SwapPulse action_type.
const REASON_TO_ACTION: Record<string, string> = {
  like: 'like',
  repost: 'repost',
  follow: 'follow',
  reply: 'comment',
  mention: 'mention',
  quote: 'quote',
};

// Resolve actor metadata for a notification from the AppView profile cache.
async function getActorProfile(did: string): Promise<any> {
  if (!did) return null;
  try {
    const url = new URL(`${APPVIEW}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set('actor', did);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.did || !user.did.startsWith('did:plc:')) {
      return Response.json({ error: 'No AT Protocol DID — link Bluesky first' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const { pdsUrl, session: sess } = await resolveBridgeSession(req);

    // Fetch recent notifications from the PDS (authenticated as the user).
    const url = new URL(`${pdsUrl}/xrpc/app.bsky.notification.listNotifications`);
    url.searchParams.set('limit', '100');

    let res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${sess.accessJwt}` },
    });
    // Retry once on 401 (expired session).
    if (res.status === 401) {
      const { clearPdsSession } = await import('../../shared/pdsSession.ts');
      clearPdsSession();
      const fresh = await resolveBridgeSession(req);
      res = await fetch(
        `${fresh.pdsUrl}/xrpc/app.bsky.notification.listNotifications?limit=100`,
        { headers: { 'Authorization': `Bearer ${fresh.session.accessJwt}` } },
      );
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('import-notification-snapshot: listNotifications failed', res.status, t.slice(0, 200));
      return Response.json({ error: `listNotifications failed (${res.status})` }, { status: 502 });
    }
    const data = await res.json();
    const notifications = data.notifications || [];

    let imported = 0, skipped = 0;

    for (const notif of notifications) {
      try {
        const sourceUri = notif.uri || '';
        if (!sourceUri) { skipped++; continue; }

        const actionType = REASON_TO_ACTION[notif.reason] || 'reaction';
        const actor = notif.author || {};

        // Dedup by source_uri — skip if already imported.
        const existing = await svc.entities.Notification
          .filter({ source_uri: sourceUri, did: user.did }, '-created_date', 1)
          .catch(() => []);
        if (existing && existing.length > 0) { skipped++; continue; }

        // Build the notification record.
        const record: any = {
          did: user.did,
          action_type: actionType,
          source_uri: sourceUri,
          actor_did: actor.did || '',
          actor_name: actor.displayName || '',
          actor_handle: actor.handle || '',
          actor_avatar: actor.avatar || '',
          is_read: !!notif.isRead,
          group_key: `${actionType}:${sourceUri}`,
          group_count: 1,
        };

        // Attach target metadata for interaction notifications.
        if (notif.reasonSubject || notif.record) {
          const subject = notif.reasonSubject || '';
          if (subject) {
            record.target_path = `/post/at/${encodeURIComponent(subject)}`;
          }
        }

        await svc.entities.Notification.create(record).catch(() => null);
        imported++;
      } catch (e) {
        skipped++;
        console.error('import-notification-snapshot: record error', e?.message || e);
      }
    }

    // Mark the import as done.
    await base44.auth.updateMe({
      notifications_imported_at: new Date().toISOString(),
    }).catch(() => {});

    console.log(`[import-notification-snapshot] user ${user.id}: +${imported} imported, ${skipped} skipped`);
    return Response.json({ ok: true, imported, skipped });
  } catch (error) {
    console.error('import-notification-snapshot error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}