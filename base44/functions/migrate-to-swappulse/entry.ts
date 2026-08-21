// migrate-to-swappulse — syncs a collector's Bluesky presence INTO SwapPulse on
// link, then updates the handle and posts+pins an announcement on Bluesky.
//
// Reliability-first flow (announcement gated on critical step success):
//   1. Snapshot the full original Bluesky profile (for un-move restoration).
//   2. Pull the Bluesky profile INTO SwapPulse (displayName, description, avatar,
//      banner). Tracks step status. FAILURE → step marked failed, announcement
//      skipped.
//   3. Trigger backfill-author-posts (first batch). Tracks step status. FAILURE →
//      step marked failed, announcement skipped.
//   4. Import the one-time notification snapshot. Tracks step status. FAILURE →
//      step marked failed, announcement skipped.
//   5. Update the handle to username.swappulse.org (or custom domain). Best-
//      effort — failure doesn't block the announcement (retry-pending-handles
//      will retry via the PDS Sync workflow).
//   6. ONLY if steps 2+3+4 all succeeded → post and pin the 'I've moved'
//      announcement on Bluesky. If any critical step failed, the announcement
//      is skipped and the user sees a clear error + per-step retry in the
//      BlueskyLinkCard dashboard.
//   7. Store migration state + per-step status on the User record.
//
// Called automatically by BlueskyLinkCard after a successful link. Idempotent:
// if already migrated, returns success without re-posting.
//
// Input: { customDomain? } — optional custom domain for the handle.
// Output: { ok, migrated, steps, pinnedUri, profileUrl, handleUpdated, handle }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveBridgeSession } from '../../shared/bridgeSession.ts';
import { clearPdsSession, pdsRequest } from '../../shared/pdsSession.ts';
import { resolveAppUrl } from '../../shared/appUrl.ts';
import { pullProfileFromPds } from '../../shared/profileSync.ts';

type StepStatus = 'pending' | 'running' | 'success' | 'failed';
interface StepState { status: StepStatus; error: string; completed_at: string }

function makeStep(status: StepStatus, error = '', completed_at = ''): StepState {
  return { status, error, completed_at };
}

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

    // Capture the original Bluesky handle before any handle update. Preserve
    // an already-captured value across retries — if a prior partial run
    // already set original_bluesky_handle, don't overwrite it with the now-
    // migrated handle (which would break un-move restoration).
    const originalHandle = user.original_bluesky_handle || user.bsky_handle || '';

    // Initialize per-step tracking on the User record.
    const steps: Record<string, StepState> = {
      profile_pull: makeStep('pending'),
      post_backfill: makeStep('pending'),
      notification_import: makeStep('pending'),
      graph_import: makeStep('pending'),
      handle_update: makeStep('pending'),
      announcement: makeStep('pending'),
    };

    const updateSteps = async (overrides: Record<string, StepState>) => {
      const merged = { ...steps, ...overrides };
      Object.assign(steps, overrides);
      await base44.auth.updateMe({ migration_steps: merged }).catch(() => {});
    };

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

    // 2. Pull the Bluesky profile INTO SwapPulse.
    await updateSteps({ profile_pull: makeStep('running') });
    let profilePulled = false;
    try {
      const { ok, updates } = await pullProfileFromPds(pdsUrl, sess.accessJwt, sess.did);
      if (ok && Object.keys(updates).length > 0) {
        updates.profile_synced_at = new Date().toISOString();
        await base44.auth.updateMe(updates);
        profilePulled = true;
        await updateSteps({ profile_pull: makeStep('success', '', new Date().toISOString()) });
      } else if (ok) {
        // No updates needed (profile already in sync) — still counts as success
        profilePulled = true;
        await updateSteps({ profile_pull: makeStep('success', '', new Date().toISOString()) });
      } else {
        await updateSteps({ profile_pull: makeStep('failed', 'PDS profile fetch returned no data', new Date().toISOString()) });
      }
    } catch (e: any) {
      console.error('migrate: profile pull failed', e?.message);
      await updateSteps({ profile_pull: makeStep('failed', e?.message || 'Unknown error', new Date().toISOString()) });
    }

    // 3. Trigger the all-time post backfill (first batch).
    await updateSteps({ post_backfill: makeStep('running') });
    let backfillStarted = false;
    try {
      const bfRes = await base44.functions.invoke('backfill-author-posts', {}).catch((e: any) => {
        console.error('migrate: backfill first batch failed', e?.message || e);
        return null;
      });
      const bfData = bfRes?.data ?? bfRes;
      if (bfData?.ok) {
        backfillStarted = true;
        await updateSteps({ post_backfill: makeStep('success', '', new Date().toISOString()) });
      } else {
        const errMsg = bfData?.error || 'Backfill returned non-ok response';
        await updateSteps({ post_backfill: makeStep('failed', errMsg, new Date().toISOString()) });
      }
    } catch (e: any) {
      console.error('migrate: backfill trigger failed', e?.message);
      await updateSteps({ post_backfill: makeStep('failed', e?.message || 'Unknown error', new Date().toISOString()) });
    }

    // 4. Import the one-time Bluesky notification snapshot.
    await updateSteps({ notification_import: makeStep('running') });
    let notificationsImported = false;
    try {
      const niRes = await base44.functions.invoke('import-notification-snapshot', {}).catch((e: any) => {
        console.error('migrate: notification import failed', e?.message || e);
        return null;
      });
      const niData = niRes?.data ?? niRes;
      if (niData?.ok) {
        notificationsImported = true;
        await updateSteps({ notification_import: makeStep('success', '', new Date().toISOString()) });
      } else {
        const errMsg = niData?.error || 'Notification import returned non-ok response';
        await updateSteps({ notification_import: makeStep('failed', errMsg, new Date().toISOString()) });
      }
    } catch (e: any) {
      console.error('migrate: notification import trigger failed', e?.message);
      await updateSteps({ notification_import: makeStep('failed', e?.message || 'Unknown error', new Date().toISOString()) });
    }

    // 5. Import the user's social graph (outgoing follows + incoming followers).
    await updateSteps({ graph_import: makeStep('running') });
    let graphImported = false;
    try {
      const giRes = await base44.functions.invoke('import-atproto-graph', {
        fromPds: true,
        includeFollowers: true,
      }).catch((e: any) => {
        console.error('migrate: graph import failed', e?.message || e);
        return null;
      });
      const giData = giRes?.data ?? giRes;
      if (giData && (giData.imported !== undefined || giData.followers_imported !== undefined)) {
        graphImported = true;
        await updateSteps({ graph_import: makeStep('success', '', new Date().toISOString()) });
      } else {
        const errMsg = giData?.error || 'Graph import returned no data';
        await updateSteps({ graph_import: makeStep('failed', errMsg, new Date().toISOString()) });
      }
    } catch (e: any) {
      console.error('migrate: graph import trigger failed', e?.message);
      await updateSteps({ graph_import: makeStep('failed', e?.message || 'Unknown error', new Date().toISOString()) });
    }

    // 6. Update the handle to username.swappulse.org (or custom domain).
    //    Best-effort — failure doesn't block the announcement.
    await updateSteps({ handle_update: makeStep('running') });
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
        await updateSteps({ handle_update: makeStep('failed', `PDS rejected (${handleRes.status})`, new Date().toISOString()) });
      } else {
        handleUpdated = true;
        newHandle = targetHandle;
        await updateSteps({ handle_update: makeStep('success', '', new Date().toISOString()) });
      }
    } catch (e) {
      console.error('migrate: handle update failed (best-effort)', e?.message);
      await updateSteps({ handle_update: makeStep('failed', e?.message || 'Unknown error', new Date().toISOString()) });
    }

    // 7. GATE: Only post the announcement if ALL critical steps succeeded.
    //    Critical = profile_pull, post_backfill, notification_import, graph_import.
    const criticalStepsOk = profilePulled && backfillStarted && notificationsImported && graphImported;

    let pinnedUri = '';
    let profileUrl = '';
    const appUrl = resolveAppUrl(req);
    const profileHandle = newHandle || user.username || user.bsky_handle;
    profileUrl = `${appUrl}/u/${profileHandle}`;

    if (!criticalStepsOk) {
      // Announcement skipped — at least one critical step failed. Store
      // migration state so the dashboard shows the failures, but do NOT
      // mark as migrated (the user needs to retry the failed steps).
      await updateSteps({ announcement: makeStep('failed', 'Skipped — critical step(s) failed', new Date().toISOString()) });
      await base44.auth.updateMe({
        original_bluesky_bio: originalBio,
        original_bluesky_profile: originalProfileJson,
        original_bluesky_handle: originalHandle,
        // NOT setting migrated_from_bluesky=true — the user must retry
        ...(handleUpdated
          ? { bsky_handle: newHandle, handle_update_pending: false, pending_handle: '' }
          : { handle_update_pending: true, pending_handle: targetHandle }),
      });

      const failedSteps = Object.entries(steps)
        .filter(([, s]) => s.status === 'failed')
        .map(([name, s]) => ({ step: name, error: s.error }));

      console.log(`[migrate-to-swappulse] user ${user.id} migration INCOMPLETE — announcement skipped. Failed: ${failedSteps.map(f => f.step).join(', ')}`);
      return Response.json({
        ok: false,
        migrated: false,
        incomplete: true,
        steps,
        failedSteps,
        handleUpdated,
        handle: newHandle || user.bsky_handle,
        profileUrl,
      });
    }

    // All critical steps succeeded → post the announcement.
    await updateSteps({ announcement: makeStep('running') });
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
      await updateSteps({ announcement: makeStep('failed', `Post failed (${postResult.status})`, new Date().toISOString()) });
      // Still mark as migrated since the critical content sync succeeded —
      // the announcement is the last step and can be retried via re-migrate.
      await base44.auth.updateMe({
        migrated_from_bluesky: true,
        original_bluesky_bio: originalBio,
        original_bluesky_profile: originalProfileJson,
        original_bluesky_handle: originalHandle,
        migrated_at: new Date().toISOString(),
        migration_reverted: false,
        ...(handleUpdated
          ? { bsky_handle: newHandle, handle_update_pending: false, pending_handle: '' }
          : { handle_update_pending: true, pending_handle: targetHandle }),
      });
      return Response.json({
        ok: true,
        migrated: true,
        announcementFailed: true,
        steps,
        handleUpdated,
        handle: newHandle || user.bsky_handle,
        profileUrl,
      });
    }
    pinnedUri = postResult.uri;

    // 7. Pin the announcement post (best-effort).
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
      preferences.push({ $type: 'app.bsky.actor.defs#pinnedPost', post: pinnedUri });
      await pdsRequest(pdsUrl, sess.accessJwt, 'app.bsky.actor.putPreferences', { preferences });
    } catch (e) {
      console.error('migrate: pin post failed (best-effort)', e?.message);
    }

    await updateSteps({ announcement: makeStep('success', '', new Date().toISOString()) });

    // 8. Store migration state on the user.
    await base44.auth.updateMe({
      migrated_from_bluesky: true,
      original_bluesky_bio: originalBio,
      original_bluesky_profile: originalProfileJson,
      pinned_announcement_uri: pinnedUri,
      original_bluesky_handle: originalHandle,
      migrated_at: new Date().toISOString(),
      migration_reverted: false,
      ...(handleUpdated
        ? { bsky_handle: newHandle, handle_update_pending: false, pending_handle: '' }
        : { handle_update_pending: true, pending_handle: targetHandle }),
    });

    console.log(`[migrate-to-swappulse] user ${user.id} migrated from @${user.bsky_handle}${handleUpdated ? ` → @${newHandle}` : ''} (all critical steps succeeded)`);
    return Response.json({
      ok: true,
      migrated: true,
      steps,
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