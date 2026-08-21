// migrate-to-swappulse — syncs a collector's Bluesky presence INTO SwapPulse on
// link, then updates the handle and posts+pins an announcement on Bluesky.
//
// Resequenced flow (pull-then-announce, NOT overwrite-bio):
//   1. Pull the Bluesky profile (displayName, description, avatar, banner) from
//      the AppView and merge it into the local User record as the synced source
//      of truth — the Bluesky bio stays intact and two-way sync keeps it in
//      step (no pointer overwrite).
//   2. Trigger backfill-author-posts (first batch) so the user's full Bluesky
//      post history renders on SwapPulse. Resumable — the UI re-invokes until
//      hasMore is false.
//   3. Trigger import-notification-snapshot so the user has an immediate
//      notification snapshot on SwapPulse.
//   4. Update the handle to username.swappulse.org (or a custom domain) on the
//      Protocol side.
//   5. Post and pin the 'I've moved to SwapPulse' announcement on the Bluesky
//      feed so followers see the transition.
//   6. Snapshot the full original Bluesky profile for un-move restoration.
//
// Called automatically by BlueskyLinkCard after a successful link. Idempotent:
// if already migrated, returns success without re-posting.
//
// Input: { customDomain? } — optional custom domain for the handle (e.g.
//   'mybrand.com'). If omitted, defaults to username.swappulse.org.
//
// Output: { ok, migrated, pinnedUri, profileUrl, handleUpdated, handle,
//   profilePulled, backfillStarted, notificationsImported }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveBridgeSession } from '../../shared/bridgeSession.ts';
import { clearPdsSession, pdsRequest } from '../../shared/pdsSession.ts';
import { resolveAppUrl } from '../../shared/appUrl.ts';
import { pullProfileFromAppView } from '../../shared/profileSync.ts';

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

    const body = await req.json().catch(() => ({}));
    const customDomain = body.customDomain
      ? String(body.customDomain).trim().toLowerCase().replace(/^@/, '')
      : '';

    const { pdsUrl, session: sess } = await resolveBridgeSession(req);

    // 1. Snapshot the full current Bluesky profile record (for un-move
    //    restoration of displayName, avatar, banner — not just the bio).
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
    const originalProfileJson: string = JSON.stringify(existingProfile);

    // 2. Pull the Bluesky profile INTO SwapPulse (displayName, description,
    //    avatar, banner) as the synced source of truth. The Bluesky bio stays
    //    intact — no pointer overwrite. Two-way sync (firehose-ingest
    //    syncInboundProfiles + sync-profile-records) keeps both in step.
    let profilePulled = false;
    try {
      const { ok, updates } = await pullProfileFromAppView(sess.did);
      if (ok && Object.keys(updates).length > 0) {
        updates.profile_synced_at = new Date().toISOString();
        await base44.auth.updateMe(updates);
        profilePulled = true;
      }
    } catch (e) {
      console.error('migrate: profile pull failed (continuing)', e?.message);
    }

    // 3. Trigger the all-time post backfill (first batch). Resumable — the
    //    UI re-invokes backfill-author-posts until hasMore is false.
    let backfillStarted = false;
    try {
      const bfRes = await base44.functions.invoke('backfill-author-posts', {}).catch((e: any) => {
        console.error('migrate: backfill first batch failed (continuing)', e?.message || e);
        return null;
      });
      backfillStarted = !!(bfRes?.ok);
    } catch (e) {
      console.error('migrate: backfill trigger failed (continuing)', e?.message);
    }

    // 4. Import the one-time Bluesky notification snapshot.
    let notificationsImported = false;
    try {
      const niRes = await base44.functions.invoke('import-notification-snapshot', {}).catch((e: any) => {
        console.error('migrate: notification import failed (continuing)', e?.message || e);
        return null;
      });
      notificationsImported = !!(niRes?.ok);
    } catch (e) {
      console.error('migrate: notification import trigger failed (continuing)', e?.message);
    }

    // 5. Update the handle to username.swappulse.org (or custom domain).
    //    Best-effort — the PDS must verify the handle via DNS TXT or
    //    well-known file. If verification fails, the migration still
    //    succeeds; the user can manually update their handle later.
    let handleUpdated = false;
    let newHandle = '';
    const username = user.username || user.email?.split('@')[0] || 'collector';
    const targetHandle = customDomain || `${username}.swappulse.org`;
    try {
      const handleRes = await pdsRequest(
        pdsUrl, sess.accessJwt, 'com.atproto.identity.updateHandle',
        { handle: targetHandle },
      );
      if (handleRes?.error) {
        console.error('migrate: handle update failed (best-effort, will retry via PDS Sync workflow)', handleRes.status, handleRes.body);
      } else {
        handleUpdated = true;
        newHandle = targetHandle;
      }
    } catch (e) {
      console.error('migrate: handle update failed (best-effort)', e?.message);
    }

    // 6. Post the announcement to the user's Bluesky feed.
    const appUrl = resolveAppUrl(req);
    const profileHandle = newHandle || user.username || user.bsky_handle;
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

    // 7. Pin the announcement post (best-effort — preference API may vary).
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

    // 8. Store migration state on the user. The Bluesky bio is NOT overwritten
    //    — it stays as the two-way synced source of truth.
    await base44.auth.updateMe({
      migrated_from_bluesky: true,
      original_bluesky_bio: originalBio,
      original_bluesky_profile: originalProfileJson,
      pinned_announcement_uri: pinnedUri,
      original_bluesky_handle: user.bsky_handle,
      migrated_at: new Date().toISOString(),
      migration_reverted: false,
      // On successful handle update, clear the pending flag. On failure, set
      // handle_update_pending + pending_handle so the PDS Sync workflow retries
      // once DNS propagates.
      ...(handleUpdated
        ? { bsky_handle: newHandle, handle_update_pending: false, pending_handle: '' }
        : { handle_update_pending: true, pending_handle: targetHandle }),
    });

    console.log(`[migrate-to-swappulse] user ${user.id} migrated from @${user.bsky_handle}${handleUpdated ? ` → @${newHandle}` : ''} (profilePulled=${profilePulled}, backfillStarted=${backfillStarted}, notificationsImported=${notificationsImported})`);
    return Response.json({
      ok: true,
      migrated: true,
      pinnedUri,
      profileUrl,
      handleUpdated,
      handle: newHandle || user.bsky_handle,
      profilePulled,
      backfillStarted,
      notificationsImported,
    });
  } catch (error) {
    console.error('migrate-to-swappulse error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}