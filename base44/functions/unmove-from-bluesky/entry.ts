// unmove-from-bluesky — reverses a Bluesky-to-SwapPulse migration. Restores
// the full original Bluesky profile (displayName, description, avatar, banner)
// from the stored snapshot, reverts the handle from username.swappulse.org
// back to the original Bluesky handle, unpins and deletes the migration
// announcement post, and sets migration_reverted=true so profile editing on
// SwapPulse is disabled (the profile reverts to the original Bluesky profile
// and changes made during migration are undone). Bluesky linking remains
// active (posts still federate) — only the migration is reversed.
//
// Called by BlueskyLinkCard when the user clicks 'Move back to Bluesky'.
// Idempotent: if not migrated, returns success without doing anything.
//
// Output: { ok, unmoved, handleReverted }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveBridgeSession } from '../../shared/bridgeSession.ts';
import { clearPdsSession, pdsRequest } from '../../shared/pdsSession.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.migrated_from_bluesky) {
      return Response.json({ ok: true, notMigrated: true });
    }

    const { pdsUrl, session: sess } = await resolveBridgeSession(req);

    // 1. Restore the full original Bluesky profile from the stored snapshot.
    //    The snapshot includes displayName, description, avatar blob, and
    //    banner blob — putting it back undoes any changes made during the
    //    migration period.
    let originalProfile: any = null;
    try {
      if (user.original_bluesky_profile) {
        originalProfile = JSON.parse(user.original_bluesky_profile);
      }
    } catch (e) {
      console.error('unmove: parse original profile failed', e?.message);
    }

    // Fetch the current profile record to merge with (in case the snapshot
    // is missing fields that exist on the current record).
    let currentProfile: any = {};
    try {
      const profileRes = await fetch(
        `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(sess.did)}&collection=app.bsky.actor.profile&rkey=self`,
        { headers: { 'Authorization': `Bearer ${sess.accessJwt}` } },
      );
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        currentProfile = profileData.value || {};
      }
    } catch (e) {
      console.error('unmove: getRecord profile failed (continuing)', e?.message);
    }

    // The restored profile is the original snapshot (if available) merged
    // with the current record's $type/createdAt, so the putRecord succeeds.
    const restoredProfile: any = {
      ...(originalProfile || currentProfile),
      $type: 'app.bsky.actor.profile',
      createdAt: (originalProfile || currentProfile).createdAt || currentProfile.createdAt || new Date().toISOString(),
    };

    try {
      let bioResult: any = await pdsRequest(
        pdsUrl, sess.accessJwt, 'com.atproto.repo.putRecord',
        { repo: sess.did, collection: 'app.bsky.actor.profile', rkey: 'self', record: restoredProfile },
      );
      if (bioResult?.error && bioResult.status === 401) {
        clearPdsSession();
        const fresh = await resolveBridgeSession(req);
        bioResult = await pdsRequest(
          fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.putRecord',
          { repo: fresh.session.did, collection: 'app.bsky.actor.profile', rkey: 'self', record: restoredProfile },
        );
      }
      if (bioResult?.error) {
        console.error('unmove: putRecord profile failed (continuing)', bioResult.status);
      }
    } catch (e) {
      console.error('unmove: profile restore failed (continuing)', e?.message);
    }

    // 2. Revert the handle from username.swappulse.org back to the original
    //    Bluesky handle. Best-effort — the PDS must verify the original
    //    handle still resolves to the user's DID.
    let handleReverted = false;
    const originalHandle = user.original_bluesky_handle;
    if (originalHandle && originalHandle !== user.bsky_handle) {
      try {
        const handleRes = await pdsRequest(
          pdsUrl, sess.accessJwt, 'com.atproto.identity.updateHandle',
          { handle: originalHandle },
        );
        if (handleRes?.error) {
          console.error('unmove: handle revert failed (best-effort)', handleRes.status, handleRes.body);
        } else {
          handleReverted = true;
        }
      } catch (e) {
        console.error('unmove: handle revert failed (best-effort)', e?.message);
      }
    }

    // 3. Unpin and delete the announcement post.
    const pinnedUri: string = user.pinned_announcement_uri || '';
    if (pinnedUri) {
      // Unpin (best-effort)
      try {
        const prefsRes = await fetch(`${pdsUrl}/xrpc/app.bsky.actor.getPreferences`, {
          headers: { 'Authorization': `Bearer ${sess.accessJwt}` },
        });
        let preferences: any[] = [];
        if (prefsRes.ok) {
          const prefsData = await prefsRes.json();
          preferences = prefsData.preferences || [];
        }
        preferences = preferences.filter((p: any) => p.$type !== 'app.bsky.actor.defs#pinnedPost');
        await pdsRequest(pdsUrl, sess.accessJwt, 'app.bsky.actor.putPreferences', { preferences });
      } catch (e) {
        console.error('unmove: unpin failed (best-effort)', e?.message);
      }

      // Delete the announcement post
      try {
        const segs = pinnedUri.replace(/^at:\/\//, '').split('/');
        const rkey = segs[2];
        if (rkey) {
          await pdsRequest(
            pdsUrl, sess.accessJwt, 'com.atproto.repo.deleteRecord',
            { repo: sess.did, collection: 'app.bsky.feed.post', rkey },
          );
        }
      } catch (e) {
        console.error('unmove: delete post failed (best-effort)', e?.message);
      }
    }

    // 4. Clear migration state and set the reverted flag so profile editing
    //    is disabled on SwapPulse. The profile reverts to the original
    //    Bluesky profile and changes made during migration are undone.
    await base44.auth.updateMe({
      migrated_from_bluesky: false,
      original_bluesky_bio: '',
      original_bluesky_profile: '',
      pinned_announcement_uri: '',
      migrated_at: '',
      migration_reverted: true,
      post_backfill_cursor: '',
      post_backfill_complete: false,
      notifications_imported_at: '',
      ...(handleReverted ? { bsky_handle: originalHandle } : {}),
    });

    console.log(`[unmove-from-bluesky] user ${user.id} un-moved${handleReverted ? ` → @${originalHandle}` : ''}`);
    return Response.json({ ok: true, unmoved: true, handleReverted });
  } catch (error) {
    console.error('unmove-from-bluesky error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}