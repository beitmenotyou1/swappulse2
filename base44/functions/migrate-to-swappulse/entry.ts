// migrate-to-swappulse — auto-migrates a collector's Bluesky presence to
// SwapPulse on link. Posts and pins a default 'I've moved' announcement to
// their Bluesky feed, replaces their Bluesky bio with a SwapPulse pointer,
// and stores migration state for the 'Moved from Bluesky' badge and un-move.
//
// Called automatically by BlueskyLinkCard after a successful link. Idempotent:
// if already migrated, returns success without re-posting.
//
// Output: { ok, migrated, pinnedUri, profileUrl }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveBridgeSession } from '../../shared/bridgeSession.ts';
import { clearPdsSession, pdsRequest } from '../../shared/pdsSession.ts';
import { resolveAppUrl } from '../../shared/appUrl.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.bsky_handle) return Response.json({ error: 'Bluesky account not linked' }, { status: 400 });

    // Idempotent — already migrated
    if (user.migrated_from_bluesky) {
      return Response.json({ ok: true, alreadyMigrated: true });
    }

    const { pdsUrl, session: sess } = await resolveBridgeSession(req);

    // 1. Snapshot the current Bluesky bio from the raw PDS profile record.
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
      console.error('migrate: getRecord profile failed (continuing)', e?.message);
    }
    const originalBio: string = existingProfile.description || '';

    // 2. Post the announcement to the user's Bluesky feed.
    const appUrl = resolveAppUrl(req);
    const profileHandle = user.username || user.bsky_handle;
    const profileUrl = `${appUrl}/u/${profileHandle}`;
    const announcementText = `I've moved to SwapPulse! 🎉 Follow me at ${profileUrl} for all my Pokémon TCG collecting, trades, and community.`;

    const postRecord = {
      $type: 'app.bsky.feed.post',
      text: announcementText,
      createdAt: new Date().toISOString(),
      langs: ['en'],
    };

    let postResult: any = await pdsRequest(
      pdsUrl, sess.accessJwt, 'com.atproto.repo.createRecord',
      { repo: sess.did, collection: 'app.bsky.feed.post', record: postRecord },
    );
    if (postResult?.error && postResult.status === 401) {
      clearPdsSession();
      const fresh = await resolveBridgeSession(req);
      postResult = await pdsRequest(
        fresh.pdsUrl, fresh.session.accessJwt, 'com.atproto.repo.createRecord',
        { repo: fresh.session.did, collection: 'app.bsky.feed.post', record: postRecord },
      );
    }
    if (postResult?.error) {
      console.error('migrate: createRecord post failed', postResult.status, postResult.body);
      return Response.json({ error: `Failed to post announcement (${postResult.status})` }, { status: 502 });
    }
    const pinnedUri: string = postResult.uri;

    // 3. Pin the announcement post (best-effort — preference API may vary).
    try {
      const prefsRes = await fetch(`${pdsUrl}/xrpc/app.bsky.actor.getPreferences`, {
        headers: { 'Authorization': `Bearer ${sess.accessJwt}` },
      });
      let preferences: any[] = [];
      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        preferences = prefsData.preferences || [];
      }
      // Remove existing pinnedPost entries, then add the new one.
      preferences = preferences.filter((p: any) => p.$type !== 'app.bsky.actor.defs#pinnedPost');
      preferences.push({ $type: 'app.bsky.actor.defs#pinnedPost', post: pinnedUri });
      await pdsRequest(pdsUrl, sess.accessJwt, 'app.bsky.actor.putPreferences', { preferences });
    } catch (e) {
      console.error('migrate: pin post failed (best-effort)', e?.message);
    }

    // 4. Replace the Bluesky bio with a SwapPulse pointer (merge into the
    //    existing profile record so displayName/avatar/banner are preserved).
    const migrationBio = `📍 Moved to SwapPulse — follow me at ${profileUrl}`;
    try {
      const mergedProfile = {
        ...existingProfile,
        $type: 'app.bsky.actor.profile',
        description: migrationBio,
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
        console.error('migrate: putRecord profile failed (continuing)', bioResult.status);
      }
    } catch (e) {
      console.error('migrate: bio update failed (continuing)', e?.message);
    }

    // 5. Store migration state on the user.
    await base44.auth.updateMe({
      migrated_from_bluesky: true,
      original_bluesky_bio: originalBio,
      pinned_announcement_uri: pinnedUri,
      original_bluesky_handle: user.bsky_handle,
      migrated_at: new Date().toISOString(),
    });

    console.log(`[migrate-to-swappulse] user ${user.id} migrated from @${user.bsky_handle}`);
    return Response.json({
      ok: true,
      migrated: true,
      pinnedUri,
      profileUrl,
    });
  } catch (error) {
    console.error('migrate-to-swappulse error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}