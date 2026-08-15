// ingest-notifications — mirrors each provisioned user's Bluesky notification
// inbox (app.bsky.notification.listNotifications) into on-site Notification
// records, completing the bidirectional notification loop. Catches likes,
// reposts, replies, follows, and mentions from ANY Bluesky user — including
// accounts no one on SwapPulse follows — which the repo-scanning firehose
// ingest cannot see.
//
// For each provisioned user (PdsCredential), opens a per-user PDS session and
// polls listNotifications. Each notification is mapped to a Notification record
// with metadata.origin='remote' and a stable group_key for idempotency (Wix /
// Bluesky redeliver safely). Post counters are incremented for interactions on
// local posts. The recipient's NotificationPreference (who_filter /
// on_site_only / paused) gates both record creation and push dispatch.
//
// Runs as a service-role function invoked by the Notification Ingestion
// workflow (every 5 min). A rotating window processes a bounded batch of users
// per run so all provisioned users are covered across runs without exceeding
// serverless time limits.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPdsSessionForUser } from '../../shared/pdsSession.ts';
import { shouldDeliverNotification } from '../../shared/notificationFilter.ts';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';
import { getEnforcedDids } from '../../shared/enforcement.ts';

const APPVIEW = 'https://public.api.bsky.app';

const REASON_MAP: Record<string, string> = {
  like: 'like',
  repost: 'repost',
  reply: 'comment',
  quote: 'repost',
  follow: 'follow',
  mention: 'mention',
};

function bskyPostUrl(uri: string): string {
  if (!uri) return '';
  // at://did:plc:xxx/app.bsky.feed.post/rkey → 3 parts after stripping 'at://'
  const parts = uri.replace('at://', '').split('/');
  if (parts.length < 3) return '';
  return `https://bsky.app/profile/${parts[0]}/post/${parts[2]}`;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const enforcedDids = await getEnforcedDids(svc);

    const creds = await svc.entities.PdsCredential.list('-created_date', 500).catch(() => []);
    if (!creds || !creds.length) {
      return Response.json({ processed: 0, created: 0, skipped: 0, errors: 0 });
    }

    // Rotating window: process a bounded batch per run, cycling through all
    // provisioned users across successive runs.
    const slot = Math.floor(Date.now() / (5 * 60 * 1000));
    const perRun = 20;
    const start = (slot * perRun) % creds.length;
    const batch = [...creds.slice(start), ...creds.slice(0, start)].slice(0, perRun);

    let created = 0, skipped = 0, errors = 0;

    for (const cred of batch) {
      const userDid = cred.did;
      const pdsUrl = cred.pds_url;
      const appPassword = cred.app_password;
      if (!userDid || !pdsUrl || !appPassword) { skipped++; continue; }

      try {
        const { session } = await getPdsSessionForUser(pdsUrl, userDid, appPassword);
        const accessJwt = session.accessJwt;

        const notifRes = await fetch(
          `${pdsUrl}/xrpc/app.bsky.notification.listNotifications?limit=30`,
          { headers: { Authorization: `Bearer ${accessJwt}` } },
        );
        if (!notifRes.ok) {
          console.error(`ingest-notifications: listNotifications failed for ${userDid} (${notifRes.status})`);
          errors++;
          continue;
        }
        const data = await notifRes.json();
        const notifications = data.notifications || [];
        if (!notifications.length) continue;

        // Map + collect group_keys for a single batched dedup query.
        const groupKeys: string[] = [];
        const mapped: any[] = [];
        for (const n of notifications) {
          const actionType = REASON_MAP[n.reason];
          if (!actionType) continue;
          const actor = n.author || {};
          const actorDid = actor.did || '';
          if (!actorDid || actorDid === userDid || enforcedDids.has(actorDid)) continue;

          let subjectUri = '';
          if (n.reason === 'like' || n.reason === 'repost' || n.reason === 'quote') {
            subjectUri = n.reasonSubject || '';
          } else if (n.reason === 'reply') {
            subjectUri = n.record?.reply?.parent?.uri || '';
          } else if (n.reason === 'mention') {
            subjectUri = n.uri || '';
          }
          const groupKey = `${actionType}:${subjectUri || n.uri || ''}:${actorDid}`;
          groupKeys.push(groupKey);
          mapped.push({ n, actionType, actor, actorDid, subjectUri, groupKey });
        }
        if (!mapped.length) continue;

        const existing = await svc.entities.Notification.filter(
          { group_key: { $in: groupKeys } },
          '-created_date',
          groupKeys.length,
        ).catch(() => []);
        const existingKeys = new Set((existing || []).map((e: any) => e.group_key));

        for (const m of mapped) {
          if (existingKeys.has(m.groupKey)) { skipped++; continue; }

          // Enforce the recipient's notification preferences before creating.
          const filter = await shouldDeliverNotification(svc, { recipientDid: userDid, actorDid: m.actorDid })
            .catch(() => ({ allowed: true, reason: 'error' }));
          if (!filter.allowed) { skipped++; continue; }

          // Resolve the local post for interaction types (for inline actions +
          // counter increment); fall back to a Bluesky deep link for external.
          let postId = '';
          let targetPath = '';
          let targetLabel = '';
          if (m.subjectUri && ['like', 'repost', 'comment'].includes(m.actionType)) {
            const posts = await svc.entities.Post.filter({ at_uri: m.subjectUri }, '-created_date', 1).catch(() => []);
            const post = posts?.[0];
            if (post) {
              postId = post.id;
              targetPath = `/post/${post.id}`;
              targetLabel = post.content ? post.content.slice(0, 80) : 'your post';
              const field = m.actionType === 'like' ? 'likes' : m.actionType === 'repost' ? 'reposts' : 'replies';
              await svc.entities.Post.update(post.id, { [field]: (post[field] || 0) + 1 }).catch(() => {});
            } else {
              targetPath = bskyPostUrl(m.subjectUri);
              targetLabel = 'your post on Bluesky';
            }
          } else if (m.actionType === 'follow') {
            targetPath = m.actor.handle ? `/u/${m.actor.handle}` : '';
            targetLabel = 'followed you';
          } else if (m.actionType === 'mention') {
            targetPath = bskyPostUrl(m.subjectUri);
            targetLabel = 'mentioned you';
          }

          const verb = m.actionType === 'like' ? 'liked'
            : m.actionType === 'repost' ? 'reposted'
            : m.actionType === 'comment' ? 'replied to'
            : m.actionType === 'follow' ? 'followed'
            : 'mentioned';
          const suffix = m.actionType === 'follow' ? 'you' : 'your post';
          const title = `${m.actor.displayName || m.actor.handle || 'Someone'} ${verb} ${suffix}`;

          let notificationId: string | null = null;
          try {
            const notif = await svc.entities.Notification.create({
              did: userDid,
              action_type: m.actionType,
              source_uri: m.subjectUri || m.n.uri || '',
              actor_did: m.actorDid,
              actor_name: m.actor.displayName || '',
              actor_handle: m.actor.handle || '',
              actor_avatar: m.actor.avatar || '',
              target_type: m.actionType === 'follow' ? 'profile' : 'post',
              target_path: targetPath,
              target_label: targetLabel,
              group_key: m.groupKey,
              group_count: 1,
              is_read: !!m.n.isRead,
              metadata: { postId, postUri: m.subjectUri, postCid: m.n.cid || '', origin: 'remote', reason: m.n.reason },
            });
            notificationId = notif?.id || null;
            created++;
          } catch (e) {
            console.error(`ingest-notifications: create failed for ${userDid}`, e?.message || e);
            errors++;
            continue;
          }

          // Dispatch push (also enforces preferences + quiet hours + rate limits).
          if (notificationId) {
            try {
              await dispatchNotification(svc, {
                recipientDid: userDid,
                type: m.actionType,
                title,
                body: '',
                params: postId ? { postId } : {},
                subjectUri: m.subjectUri,
                priority: 'standard',
                actorDid: m.actorDid,
              });
            } catch (e) {
              console.error('ingest-notifications: dispatch failed', e?.message || e);
            }
          }
        }
      } catch (e) {
        console.error(`ingest-notifications: user ${userDid} failed`, e?.message || e);
        errors++;
      }
    }

    return Response.json({ processed: batch.length, created, skipped, errors });
  } catch (error) {
    console.error('ingest-notifications error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}