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

const VALID_TYPES = new Set(['like', 'repost', 'comment']);

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { recipientDid, actionType, post, postUri, origin } = body;
    let { actorDid, actorName, actorHandle, actorAvatar } = body;

    if (!recipientDid || !actionType || !post?.id) {
      return Response.json({ error: 'recipientDid, actionType, and post.id are required' }, { status: 400 });
    }
    if (!VALID_TYPES.has(actionType)) {
      return Response.json({ error: `actionType must be one of like, repost, comment` }, { status: 400 });
    }

    // Resolve actor from the caller's session when not provided (local case).
    if (!actorDid) {
      try {
        const me = await base44.auth.me();
        if (me) {
          actorDid = me.did;
          actorName = actorName || me.display_name || me.full_name;
          actorHandle = actorHandle || me.bsky_handle || me.username || (me.email ? me.email.split('@')[0] : '');
          actorAvatar = actorAvatar || me.avatar;
        }
      } catch {
        // No session (e.g. workflow call) — actor must come from the body.
      }
    }

    // Don't notify people about their own interactions.
    if (actorDid && recipientDid && actorDid === recipientDid) {
      return Response.json({ ok: true, skipped: 'self' });
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
    const verb = actionType === 'like' ? 'liked' : actionType === 'repost' ? 'reposted' : 'commented on';
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