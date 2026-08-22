// import-notification-snapshot — resumable full-history notifications backfill
// for migrated users. Pages through app.bsky.notification.listNotifications
// (which supports cursor pagination) so the user's ENTIRE notification history
// is transferred, not just the latest snapshot.
//
// Two modes (mirrors backfill-author-posts):
//   1. Single-user (authenticated caller, no args): processes one page of the
//      calling user's notifications. Called by migrate-to-swappulse on link
//      (first batch) and re-callable by the user.
//   2. Continue (admin/workflow, { continue: true }): iterates migrated users
//      with notifications_backfill_complete=false, processing one page per user.
//      Called by the PDS Sync workflow every 5 minutes.
//
// Stores notifications_backfill_cursor / notifications_backfill_complete on the
// User record. Idempotent via source_uri dedup.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveBridgeSession } from '../../shared/bridgeSession.ts';
import { getUserIdentity } from '../../shared/userIdentity.ts';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';

const APPVIEW = 'https://public.api.bsky.app';
const PAGE_LIMIT = 100;
const MAX_CONTINUE_USERS = 10;

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

// Process one page of notifications for a single user. Shared by both modes.
async function processNotificationPage(
  svc: any,
  pdsUrl: string,
  accessJwt: string,
  userDid: string,
  cursor: string | null,
  updateFn: (updates: any) => Promise<void>,
): Promise<{ imported: number; skipped: number; hasMore: boolean; nextCursor: string | null }> {
  const url = new URL(`${pdsUrl}/xrpc/app.bsky.notification.listNotifications`);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessJwt}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('import-notification-snapshot: listNotifications failed', res.status, t.slice(0, 200));
    return { imported: 0, skipped: 0, hasMore: false, nextCursor: null };
  }
  const data = await res.json();
  const notifications = data.notifications || [];
  const nextCursor = data.cursor || null;
  const hasMore = !!nextCursor && notifications.length >= PAGE_LIMIT;

  let imported = 0, skipped = 0;

  for (const notif of notifications) {
    try {
      const sourceUri = notif.uri || '';
      if (!sourceUri) { skipped++; continue; }

      const actionType = REASON_TO_ACTION[notif.reason] || 'reaction';
      const actor = notif.author || {};

      // Dedup by source_uri — skip if already imported.
      const existing = await svc.entities.Notification
        .filter({ source_uri: sourceUri, did: userDid }, '-created_date', 1)
        .catch(() => []);
      if (existing && existing.length > 0) { skipped++; continue; }

      const record: any = {
        did: userDid,
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

  await updateFn({
    notifications_backfill_cursor: nextCursor || '',
    notifications_backfill_complete: !hasMore,
    notifications_imported_at: new Date().toISOString(),
  });

  console.log(`[import-notification-snapshot] user ${userDid}: +${imported} imported, ${skipped} skipped, hasMore=${hasMore}`);
  return { imported, skipped, hasMore, nextCursor };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const continueMode = !!(body as any).continue;

    if (continueMode) {
      const caller = await base44.auth.me().catch(() => null);
      if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (caller.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }

      const svc = base44.asServiceRole;
      const incompleteUsers = await svc.entities.User
        .filter({ migrated_from_bluesky: true, notifications_backfill_complete: false }, '-created_date', MAX_CONTINUE_USERS)
        .catch(() => []);

      let totalImported = 0, totalSkipped = 0;
      let usersProcessed = 0;

      for (const u of incompleteUsers || []) {
        try {
          if (!u.did || !u.did.startsWith('did:plc:')) continue;
          const identity = await getUserIdentity(svc, u);
          if (!identity) continue;

          let session: any;
          try {
            session = (await getPdsSessionForUser(identity.pdsUrl, identity.did, identity.appPassword)).session;
          } catch (e) {
            console.error(`import-notification-snapshot: session failed for ${u.did}`, e?.message || e);
            continue;
          }

          const cursor = u.notifications_backfill_cursor || null;
          const result = await processNotificationPage(
            svc, identity.pdsUrl, session.accessJwt, identity.did, cursor,
            async (updates) => { await svc.entities.User.update(u.id, updates).catch(() => {}); },
          );
          totalImported += result.imported;
          totalSkipped += result.skipped;
          usersProcessed++;
        } catch (e) {
          console.error(`import-notification-snapshot: continue error for user ${u.id}`, e?.message || e);
        }
      }

      return Response.json({
        ok: true,
        users_processed: usersProcessed,
        total_imported: totalImported,
        total_skipped: totalSkipped,
      });
    }

    // Single-user mode (authenticated caller).
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.did || !user.did.startsWith('did:plc:')) {
      return Response.json({ error: 'No AT Protocol DID — link Bluesky first' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const { pdsUrl, session: sess } = await resolveBridgeSession(req);
    const cursor = user.notifications_backfill_cursor || null;

    const result = await processNotificationPage(
      svc, pdsUrl, sess.accessJwt, user.did, cursor,
      async (updates) => { await svc.entities.User.update(user.id, updates).catch(() => {}); },
    );

    return Response.json({
      ok: true,
      imported: result.imported,
      skipped: result.skipped,
      hasMore: result.hasMore,
      cursor: result.nextCursor || '',
    });
  } catch (error) {
    console.error('import-notification-snapshot error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}