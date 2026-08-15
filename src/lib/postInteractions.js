// Shared post-interaction helpers (like / repost / reply) that encapsulate the
// federated bridging pattern: stamp locally → create entity → bridge to the
// PDS via atproto-bridge → update entity with at_uri/cid/bridged on success.
// Also increments the parent post's counters and fires notify-interaction so
// the post author is notified. Reused by PostCard, CommentComposer,
// PostReplyThread, and the respond-to-notification UI so the logic lives once.

import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

function actorFromUser(me) {
  return {
    actorDid: me?.did,
    actorName: me?.display_name || me?.full_name,
    actorHandle: me?.bsky_handle || me?.username || (me?.email ? me.email.split('@')[0] : ''),
    actorAvatar: me?.avatar,
  };
}

function notify(actionType, recipientDid, post, actor, origin = 'local', commentText = '') {
  if (!recipientDid) return Promise.resolve();
  return base44.functions.invoke('notify-interaction', {
    recipientDid,
    actionType,
    actorDid: actor.actorDid,
    actorName: actor.actorName,
    actorHandle: actor.actorHandle,
    actorAvatar: actor.actorAvatar,
    post: { id: post.id, at_uri: post.at_uri, cid: post.cid, content: post.content },
    postUri: post.at_uri,
    origin,
    commentText,
  }).catch(() => {});
}

// Create a like on a post: local Like + PDS bridge + counter + author notify.
export async function createLike(post) {
  const { did, signingKey } = await ensureUserDid();
  const me = await base44.auth.me();
  const stamped = await stampRecord(
    { post_id: post.id, post_uri: post.at_uri || '', post_cid: post.cid || '' },
    'app.bsky.feed.like', did, signingKey,
  );
  const created = await base44.entities.Like.create(stamped);
  await base44.entities.Post.update(post.id, { likes: (post.likes || 0) + 1 }).catch(() => {});
  if (post.bridged && post.at_uri && post.cid) {
    base44.functions.invoke('atproto-bridge', {
      collection: 'app.bsky.feed.like',
      record: { subject: { uri: post.at_uri, cid: post.cid }, createdAt: new Date().toISOString() },
    }).then((res) => {
      if (res?.uri) base44.entities.Like.update(created.id, { at_uri: res.uri, cid: res.cid, bridged: true }).catch(() => {});
    }).catch(() => {});
  }
  notify('like', post.did, post, actorFromUser(me));
  return created;
}

// Remove a like: delete local + PDS record + decrement counter.
export async function deleteLike(like, post) {
  await base44.entities.Like.delete(like.id);
  await base44.entities.Post.update(post.id, { likes: Math.max(0, (post.likes || 0) - 1) }).catch(() => {});
  if (like?.at_uri?.startsWith('at://did:')) {
    base44.functions.invoke('atproto-bridge', { action: 'delete', uri: like.at_uri }).catch(() => {});
  }
}

// Create a repost: local Repost + PDS bridge + counter + author notify.
export async function createRepost(post) {
  const { did, signingKey } = await ensureUserDid();
  const me = await base44.auth.me();
  const stamped = await stampRecord(
    {
      post_id: post.id,
      post_uri: post.at_uri || '',
      post_cid: post.cid || '',
      reposter_name: me?.display_name || me?.full_name || '',
      reposter_handle: me?.bsky_handle || me?.username || (me?.email ? me.email.split('@')[0] : ''),
    },
    NSID.REPOST, did, signingKey,
  );
  const created = await base44.entities.Repost.create(stamped);
  await base44.entities.Post.update(post.id, { reposts: (post.reposts || 0) + 1 }).catch(() => {});
  if (post.bridged && post.at_uri && post.cid) {
    base44.functions.invoke('atproto-bridge', {
      collection: 'app.bsky.feed.repost',
      record: { subject: { uri: post.at_uri, cid: post.cid }, createdAt: new Date().toISOString() },
    }).then((res) => {
      if (res?.uri) base44.entities.Repost.update(created.id, { at_uri: res.uri, cid: res.cid }).catch(() => {});
    }).catch(() => {});
  }
  notify('repost', post.did, post, actorFromUser(me));
  return created;
}

// Remove a repost: delete local + PDS record + decrement counter.
export async function deleteRepost(repost, post) {
  await base44.entities.Repost.delete(repost.id);
  await base44.entities.Post.update(post.id, { reposts: Math.max(0, (post.reposts || 0) - 1) }).catch(() => {});
  if (repost?.at_uri?.startsWith('at://did:')) {
    base44.functions.invoke('atproto-bridge', { action: 'delete', uri: repost.at_uri }).catch(() => {});
  }
}

// Create a federated reply post: stamps parent/root refs, bridges to the PDS
// as app.bsky.feed.post with a reply field (only when the parent is bridged),
// increments the parent's replies counter, and notifies the parent's author.
// `extra` fields (e.g. card_id) merge into the stamped record.
export async function createReply(parentPost, text, user, extra = {}, localReplyTo = null) {
  const { did, signingKey } = await ensureUserDid();
  const parentUri = parentPost.at_uri || null;
  const parentCid = parentPost.cid || null;
  const rootUri = parentPost.root_uri || parentPost.at_uri || null;
  const rootCid = parentPost.root_cid || parentPost.cid || null;
  const stamped = await stampRecord({
    content: text.trim(),
    post_type: 'text',
    author_name: user?.display_name || user?.full_name || 'Collector',
    author_handle: user?.bsky_handle || user?.username || (user?.email ? user.email.split('@')[0] : ''),
    author_avatar: user?.avatar || '',
    likes: 0, reposts: 0, replies: 0,
    reply_to: localReplyTo || parentPost.id || null,
    parent_uri: parentUri,
    parent_cid: parentCid,
    root_uri: rootUri,
    root_cid: rootCid,
    ...extra,
  }, NSID.POST, did, signingKey);
  const created = await base44.entities.Post.create(stamped);
  if (parentPost.id) {
    await base44.entities.Post.update(parentPost.id, { replies: (parentPost.replies || 0) + 1 }).catch(() => {});
  }
  if (created?.id) {
    base44.functions.invoke('moderatePost', { post_id: created.id }).catch(() => {});
  }
  if (parentPost.bridged && parentUri && parentCid && rootUri && rootCid) {
    base44.functions.invoke('atproto-bridge', {
      collection: 'app.bsky.feed.post',
      record: {
        text: text.trim().slice(0, 3000),
        createdAt: new Date().toISOString(),
        langs: ['en'],
        reply: { root: { uri: rootUri, cid: rootCid }, parent: { uri: parentUri, cid: parentCid } },
      },
    }).then((res) => {
      if (res?.uri) base44.entities.Post.update(created.id, { at_uri: res.uri, cid: res.cid, bridged: true }).catch(() => {});
    }).catch(() => {});
  }
  notify('comment', parentPost.did, parentPost, actorFromUser(user), 'local', text.trim().slice(0, 200));
  return created;
}