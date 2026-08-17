// notify-interaction — creates an in-app Notification for a post interaction
// (like / repost / comment) and dispatches a push notification to the post
// author. Reused by the frontend (local interactions) and by firehose-ingest
// (remote/Bluesky-originated interactions) so the notification path is
// identical regardless of origin.
//
// Input:
//   { recipientDid, actionType, post: {id, at_uri, cid, content}, postUri,
//     actorDid?, actorName?, actorHandle?, actorAvatar?, origin? }
// actor fields are resolved from the caller's session when omitted (local
// interactions). origin is 'local' (default) or 'remote' — stored in
// Notification.metadata.origin so the UI can badge Bluesky-originated ones.
//
// Dedup: skips creation when a Notification with the same group_key already
// exists, so redelivered firehose records and re-bridges don't duplicate.
// Never notifies the author about their own interaction.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';
import { shouldDeliverNotification } from '../../shared/notificationFilter.ts';

const VALID_TYPES = new Set(['like', 'repost', 'quote', 'comment', 'reaction']);

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { recipientDid, actionType, post, postUri, origin, commentText, commentId, commentUri, commentCid, quoteText, reactionType } = body;
    let { actorDid, actorName, actorHandle, actorAvatar } = body;

    if (!recipientDid || !actionType || !post?.id) {
      return Response.json({ error: 'recipientDid, actionType, and post.id are required' }, { status: 400 });
    }
    if (!VALID_TYPES.has(actionType)) {
      return Response.json({ error: `actionType must be one of like, repost, comment` }, { status: 400 });
    }

    // Security: authenticate the caller. Unauthenticated callers must never
    // be able to trigger notifications — previously the function fell back to
    // taking actorDid directly from the body when auth.me() failed, letting
    // any stranger impersonate an actor.
    let me: any;
    try { me = await base44.auth.me(); } catch { me = null; }
    if (!me) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve actor identity based on caller role:
    // - Admin callers (firehose-ingest, workflows) handle remote/Bluesky-
    //   originated interactions where the actor is NOT the caller — they may
    //   pass actorDid in the body.
    // - Regular user callers (frontend local interactions) are bound to their
    //   own identity — body-provided actor fields are ignored to prevent
    //   impersonation.
    if (me.role === 'admin' && actorDid) {
      // Remote interaction: trust the admin-verified body actor.
    } else {
      actorDid = me.did;
      actorName = me.display_name || me.full_name;
      actorHandle = me.bsky_handle || me.username || (me.email ? me.email.split('@')[0] : '');
      actorAvatar = me.avatar;
    }

    // Don't notify people about their own interactions.
    if (actorDid && recipientDid && actorDid === recipientDid) {
      return Response.json({ ok: true, skipped: 'self' });
    }

    // Enforce the recipient's notification preferences (who can reach them,
    // on-site-only, master pause) before creating any record or push.
    try {
      const filter = await shouldDeliverNotification(svc, { recipientDid, actorDid });
      if (!filter.allowed) {
        return Response.json({ ok: true, skipped: 'filtered', reason: filter.reason });
      }
    } catch (e) {
      console.error('notify-interaction: pref filter failed', e?.message || e);
      // Fail open — don't silently mute on a filter error.
    }

    const subjectUri = postUri || post.at_uri || '';
    const groupKey = `${actionType}:${subjectUri || post.id}:${actorDid || 'unknown'}`;

    // Dedup — skip if a notification with this group_key already exists.
    try {
      const existing = await svc.entities.Notification.filter({ group_key: groupKey }, '-created_date', 1);
      if (existing && existing.length > 0) {
        return Response.json({ ok: true, skipped: 'duplicate', notificationId: existing[0].id });
      }
    } catch (e) {
      console.error('notify-interaction: dedup check failed', e?.message || e);
    }

    const targetPath = `/post/${post.id}`;
    const targetLabel = post.content ? post.content.slice(0, 80) : 'your post';
    const verb = actionType === 'like' ? 'liked'
      : actionType === 'repost' ? 'reposted'
      : actionType === 'quote' ? 'quoted'
      : actionType === 'reaction' ? 'reacted to'
      : 'commented on';
    const title = `${actorName || 'Someone'} ${verb} your post`;

    let notificationId: string | null = null;
    try {
      const notification = await svc.entities.Notification.create({
        did: recipientDid,
        action_type: actionType,
        source_uri: subjectUri,
        actor_did: actorDid || '',
        actor_name: actorName || '',
        actor_handle: actorHandle || '',
        actor_avatar: actorAvatar || '',
        target_type: 'post',
        target_path: targetPath,
        target_label: targetLabel,
        group_key: groupKey,
        group_count: 1,
        is_read: false,
        metadata: {
          postId: post.id,
          postUri: subjectUri,
          postCid: post.cid || '',
          origin: origin || 'local',
          commentText: commentText || '',
          commentId: commentId || '',
          commentUri: commentUri || '',
          commentCid: commentCid || '',
          quoteText: quoteText || '',
          reactionType: reactionType || '',
        },
      });
      notificationId = notification?.id || null;
    } catch (e) {
      console.error('notify-interaction: create notification failed', e?.message || e);
    }

    // Dispatch push notification (respects preferences, quiet hours, rate limits).
    try {
      await dispatchNotification(svc, {
        recipientDid,
        type: actionType,
        title,
        body: '',
        params: { postId: post.id },
        subjectUri: subjectUri,
        priority: 'standard',
      });
    } catch (e) {
      console.error('notify-interaction: dispatch failed', e?.message || e);
    }

    return Response.json({ ok: true, notificationId });
  } catch (error) {
    console.error('notify-interaction error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}