// import-atproto-graph — creates local Follow entities from a list of AT Protocol
// follows that were imported from the user's PDS during signup.
//
// Called after the user completes registration + profile setup. The follows list
// comes from the atproto-auth verify response (fetched via the public AppView).
//
// Input:  { follows: [{ did, handle, displayName, avatar }] }
// Output: { imported, skipped, total }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const follows: Array<{ did: string; handle?: string; displayName?: string; avatar?: string }> =
      Array.isArray(body.follows) ? body.follows : [];
    if (!follows.length) {
      return Response.json({ imported: 0, skipped: 0, total: 0 });
    }

    const myDid = user.did || '';

    // Get existing follows to avoid duplicates (Follow read is public)
    const existing = await base44.entities.Follow.filter({ did: myDid }, '-created_date', 500).catch(() => []);
    const existingDids = new Set(existing.map((f: any) => f.subject_did));

    let imported = 0;
    let skipped = 0;

    for (const f of follows) {
      if (!f.did || existingDids.has(f.did)) {
        skipped++;
        continue;
      }
      try {
        await base44.entities.Follow.create({
          subject_did: f.did,
          subject_name: f.displayName || f.handle || '',
          subject_handle: f.handle || '',
          subject_avatar: f.avatar || '',
          did: myDid,
          record_type: 'app.bsky.graph.follow',
        });
        existingDids.add(f.did);
        imported++;
      } catch (e) {
        console.error('import-atproto-graph: failed to create follow for', f.did, e?.message || e);
      }
    }

    // Follower reconnection: check if any of the newly imported follows point
    // at a SwapPulse member who has migrated from Bluesky. If so, dispatch a
    // notification so the migrated collector knows their Bluesky follower has
    // joined SwapPulse and is now following them here too.
    try {
      const importedDids = follows
        .filter((f) => f.did && existingDids.has(f.did))
        .map((f) => f.did);
      if (importedDids.length) {
        // Look up migrated SwapPulse members among the followed DIDs.
        const svc = base44.asServiceRole;
        const migratedMembers = await svc.entities.User
          .filter({ migrated_from_bluesky: true }, '-created_date', 100)
          .catch(() => []);
        const migratedDids = new Set(migratedMembers.map((u: any) => u.did).filter(Boolean));
        const reconnected = importedDids.filter((d) => migratedDids.has(d));
        if (reconnected.length) {
          const actorName = user.display_name || user.full_name || user.username || user.bsky_handle || 'A collector';
          for (const migratedDid of reconnected) {
            try {
              await dispatchNotification(svc, {
                recipientDid: migratedDid,
                type: 'migration_reconnect',
                title: 'Your Bluesky follower joined SwapPulse',
                body: `${actorName} followed you on Bluesky and has now joined SwapPulse — they're following you here too.`,
                params: { actorDid: myDid, actorName },
                actorDid: myDid,
              });
            } catch (e) {
              console.error('import-atproto-graph: reconnect notify failed for', migratedDid, e?.message);
            }
          }
        }
      }
    } catch (e) {
      console.error('import-atproto-graph: reconnection check failed (non-fatal)', e?.message);
    }

    return Response.json({ imported, skipped, total: follows.length });
  } catch (error) {
    console.error('import-atproto-graph error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});