// unmove-from-bluesky — reverses a Bluesky-to-SwapPulse migration. Restores
// the original Bluesky bio from the stored snapshot, unpins and deletes the
// migration announcement post, and clears the migration state so the 'Moved
// from Bluesky' badge disappears. Bluesky linking remains active (posts still
// federate) — only the migration announcement is reversed.
//
// Called by BlueskyLinkCard when the user clicks 'Move back to Bluesky'.
// Idempotent: if not migrated, returns success without doing anything.
//
// Output: { ok, unmoved }

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

    // 1. Restore the original Bluesky bio. Fetch the current profile record so
    //    we preserve displayName/avatar/banner and only swap the description.
    let existingProfile: any = {};
    try {
      const profileRes = await fetch(
        `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(sess.did)}&collection=app.bsky.actor.profile&rkey=self`,
        { headers: { 'Authorization': `Bearer ${sess.accessJwt}` } },
      );
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        existingProfile = profileData.value || {};
      }
    } catch (e) {
      console.error('unmove: getRecord profile failed (continuing)', e?.message);
    }

    const bioToRestore: string = user.original_bluesky_bio || '';
    try {
      const mergedProfile = {
        ...existingProfile,
        $type: 'app.bsky.actor.profile',
        description: bioToRestore,
      };
      let bioResult: any = await pdsRequest(
        pdsUrl, sess.accessJwt, 'com.atproto.repo.putRecord',
        { repo: sess.did, collection: 'app.bsky.actor.profile', rkey: 'self', record: mergedProfile },
      );
      if (bioResult?.error && bioResult.status === 401) {
        clearPdsSession();
        const fresh = await resolveBridgeSession(req);
        bioResult = await pdsRequest(
          fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.putRecord',
          { repo: fresh.session.did, collection: 'app.bsky.actor.profile', rkey: 'self', record: mergedProfile },
        );
      }
      if (bioResult?.error) {
        console.error('unmove: putRecord profile failed (continuing)', bioResult.status);
      }
    } catch (e) {
      console.error('unmove: bio restore failed (continuing)', e?.message);
    }

    // 2. Unpin and delete the announcement post.
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

    // 3. Clear migration state.
    await base44.auth.updateMe({
      migrated_from_bluesky: false,
      original_bluesky_bio: '',
      pinned_announcement_uri: '',
      original_bluesky_handle: '',
      migrated_at: '',
    });

    console.log(`[unmove-from-bluesky] user ${user.id} un-moved`);
    return Response.json({ ok: true, unmoved: true });
  } catch (error) {
    console.error('unmove-from-bluesky error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}