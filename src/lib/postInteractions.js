// Shared post-interaction helpers (like / repost / reply / quote-repost) that
// encapsulate the federated bridging pattern: stamp locally → create entity →
// bridge to the PDS via atproto-bridge → update entity with at_uri/cid/bridged
// on success. Also increments the parent post's counters and fires
// notify-interaction so the post author is notified. Reused by PostCard,
// CommentComposer, PostReplyThread, CommentActions, and the respond-to-
// notification UI so the logic lives once.
//
// All helpers accept either a local Post object (has .id) or an external
// strongRef { at_uri, cid, did, root_uri?, root_cid?, content? } via
// normalizeRef. External refs are treated as already-bridged (they live on
// bsky.app) so interactions target the real record directly.

import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { ensureBotAllowed } from '@/lib/botGuardClient';

function actorFromUser(me) {
  return {
    actorDid: me?.did,
    actorName: me?.display_name || me?.full_name,
    actorHandle: me?.bsky_handle || me?.username || (me?.email ? me.email.split('@')[0] : ''),
    actorAvatar: me?.avatar,
  };
}

function notify(actionType, recipientDid, post, actor, origin = 'local', extra = {}) {
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
    commentText: extra.commentText || '',
    commentId: extra.commentId || '',
    commentUri: extra.commentUri || '',
    commentCid: extra.commentCid || '',
    quoteText: extra.quoteText || '',
    reactionType: extra.reactionType || '',
  }).catch(() => {});
}

// Fetch the true root of a reply thread from the AppView. Used when the
// parent is an external strongRef that doesn't carry root_uri — without this,
// deep nested replies bridge with the immediate parent as "root" and don't
// thread correctly on bsky.app. Returns { rootUri, rootCid } or null.
async function resolveThreadRoot(parentUri) {
  try {
    const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread');
    url.searchParams.set('uri', parentUri);
    url.searchParams.set('depth', '0');
    url.searchParams.set('parentHeight', '80');
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    let thread = data.thread;
    while (thread?.parent && thread.parent.$type === 'app.bsky.feed.defs#threadViewPost') {
      thread = thread.parent;
    }
    if (thread?.post?.uri) {
      return { rootUri: thread.post.uri, rootCid: thread.post.cid || '' };
    }
  } catch { /* ignore — fall back to parent as root */ }
  return null;
}

// Normalize a comment/post reference for the interaction helpers. Accepts
// either a local Post object (has .id) or an external strongRef
// { at_uri, cid, did, root_uri?, root_cid?, content? }. External refs are
// treated as already-bridged (they live on bsky.app) so likes/reposts/replies
// target the real record directly.
export function normalizeRef(ref) {
  if (!ref) return null;
  const isLocal = !!ref.id;
  return {
    id: ref.id || null,
    at_uri: ref.at_uri || '',
    cid: ref.cid || '',
    did: ref.did || '',
    bridged: isLocal ? !!ref.bridged : true,
    root_uri: ref.root_uri || ref.at_uri || '',
    root_cid: ref.root_cid || ref.cid || '',
    likes: ref.likes || 0,
    reposts: ref.reposts || 0,
    replies: ref.replies || 0,
    content: ref.content || '',
    reply_policy: ref.reply_policy || 'everybody',
    isLocal,
  };
}

// Create a like on a post/comment: local Like + PDS bridge + counter + author notify.
export async function createLike(post) {
  const ref = normalizeRef(post);
  await ensureBotAllowed('like', ref.content || '');
  const { did, signingKey } = await ensureUserDid();
  const me = await base44.auth.me();
  const stamped = await stampRecord(
    { post_id: ref.id || '', post_uri: ref.at_uri, post_cid: ref.cid || '' },
    'app.bsky.feed.like', did, signingKey,
  );
  const created = await base44.entities.Like.create(stamped);
  if (ref.isLocal) {
    await base44.entities.Post.update(ref.id, { likes: (ref.likes || 0) + 1 }).catch(() => {});
  }
  if (ref.bridged && ref.at_uri && ref.cid) {
    base44.functions.invoke('atproto-bridge', {
      collection: 'app.bsky.feed.like',
      record: { subject: { uri: ref.at_uri, cid: ref.cid }, createdAt: new Date().toISOString() },
    }).then((res) => {
      if (res?.uri) base44.entities.Like.update(created.id, { at_uri: res.uri, cid: res.cid, bridged: true }).catch(() => {});
    }).catch(() => {});
  }
  if (ref.isLocal) notify('like', ref.did, ref, actorFromUser(me));
  return created;
}

// Remove a like: delete local + PDS record + decrement counter.
export async function deleteLike(like, post) {
  const ref = normalizeRef(post);
  await base44.entities.Like.delete(like.id);
  if (ref?.isLocal) {
    await base44.entities.Post.update(ref.id, { likes: Math.max(0, (ref.likes || 0) - 1) }).catch(() => {});
  }
  if (like?.at_uri?.startsWith('at://did:')) {
    base44.functions.invoke('atproto-bridge', { action: 'delete', uri: like.at_uri }).catch(() => {});
  }
}

// Create a repost: local Repost + PDS bridge + counter + author notify.
export async function createRepost(post) {
  const ref = normalizeRef(post);
  await ensureBotAllowed('repost', ref.content || '');
  const { did, signingKey } = await ensureUserDid();
  const me = await base44.auth.me();
  const stamped = await stampRecord(
    {
      post_id: ref.id || '',
      post_uri: ref.at_uri,
      post_cid: ref.cid || '',
      reposter_name: me?.display_name || me?.full_name || '',
      reposter_handle: me?.bsky_handle || me?.username || (me?.email ? me.email.split('@')[0] : ''),
    },
    NSID.REPOST, did, signingKey,
  );
  const created = await base44.entities.Repost.create(stamped);
  if (ref.isLocal) {
    await base44.entities.Post.update(ref.id, { reposts: (ref.reposts || 0) + 1 }).catch(() => {});
  }
  if (ref.bridged && ref.at_uri && ref.cid) {
    base44.functions.invoke('atproto-bridge', {
      collection: 'app.bsky.feed.repost',
      record: { subject: { uri: ref.at_uri, cid: ref.cid }, createdAt: new Date().toISOString() },
    }).then((res) => {
      if (res?.uri) base44.entities.Repost.update(created.id, { at_uri: res.uri, cid: res.cid }).catch(() => {});
    }).catch(() => {});
  }
  if (ref.isLocal) notify('repost', ref.did, ref, actorFromUser(me));
  return created;
}

// Remove a repost: delete local + PDS record + decrement counter.
export async function deleteRepost(repost, post) {
  const ref = normalizeRef(post);
  await base44.entities.Repost.delete(repost.id);
  if (ref?.isLocal) {
    await base44.entities.Post.update(ref.id, { reposts: Math.max(0, (ref.reposts || 0) - 1) }).catch(() => {});
  }
  if (repost?.at_uri?.startsWith('at://did:')) {
    base44.functions.invoke('atproto-bridge', { action: 'delete', uri: repost.at_uri }).catch(() => {});
  }
}

// Create a federated reply post: stamps parent/root refs, bridges to the PDS
// as app.bsky.feed.post with a reply field (only when the parent is bridged),
// increments the parent's replies counter, and notifies the parent's author.
// `extra` fields (e.g. card_id) merge into the stamped record. Works for both
// local Post parents and external strongRef parents via normalizeRef.
export async function createReply(parentPost, text, user, extra = {}, localReplyTo = null) {
  const ref = normalizeRef(parentPost);
  await ensureBotAllowed('reply', text);
  const { did, signingKey } = await ensureUserDid();

  // Enforce the parent post's reply policy (postGate) for local posts.
  if (ref.isLocal && ref.reply_policy && ref.reply_policy !== 'everybody') {
    if (ref.reply_policy === 'nobody') {
      throw new Error('Replies are disabled on this post.');
    }
    if (ref.reply_policy === 'followers') {
      const follows = await base44.entities.Follow.filter({ did: ref.did, subject_did: did }, '-created_date', 1).catch(() => []);
      if (!follows?.length) {
        throw new Error('Only followers can reply to this post.');
      }
    }
    if (ref.reply_policy === 'mentioned') {
      const content = ref.content || '';
      const userHandle = user?.bsky_handle || user?.email?.split('@')[0] || '';
      if (!content.includes('@' + userHandle) && !content.includes(did)) {
        throw new Error('Only mentioned users can reply to this post.');
      }
    }
  }

  const parentUri = ref.at_uri || null;
  const parentCid = ref.cid || null;
  let rootUri = ref.root_uri || ref.at_uri || null;
  let rootCid = ref.root_cid || ref.cid || null;

  // If the parent is external and lacks root_uri, resolve the true thread root
  // from the AppView so deep nested replies bridge with the correct reply.root.
  if (!ref.isLocal && parentUri && !ref.root_uri) {
    const resolved = await resolveThreadRoot(parentUri);
    if (resolved) {
      rootUri = resolved.rootUri;
      rootCid = resolved.rootCid;
    }
  }
  const stamped = await stampRecord({
    content: text.trim(),
    post_type: 'text',
    author_name: user?.display_name || user?.full_name || 'Collector',
    author_handle: user?.bsky_handle || user?.username || (user?.email ? user.email.split('@')[0] : ''),
    author_avatar: user?.avatar || '',
    likes: 0, reposts: 0, replies: 0,
    reply_to: ref.isLocal ? (localReplyTo || ref.id || null) : null,
    parent_uri: parentUri,
    parent_cid: parentCid,
    root_uri: rootUri,
    root_cid: rootCid,
    ...extra,
  }, NSID.POST, did, signingKey);
  const created = await base44.entities.Post.create(stamped);
  if (ref.isLocal) {
    await base44.entities.Post.update(ref.id, { replies: (ref.replies || 0) + 1 }).catch(() => {});
  }
  if (created?.id) {
    base44.functions.invoke('moderatePost', { post_id: created.id }).catch(() => {});
  }
  if (ref.bridged && parentUri && parentCid && rootUri && rootCid) {
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
  if (ref.isLocal) {
    notify('comment', ref.did, ref, actorFromUser(user), 'local', {
      commentText: text.trim().slice(0, 200),
      commentId: created.id,
      commentUri: created.at_uri,
      commentCid: created.cid,
    });
  }
  return created;
}

// Delete a reply post: delete the local Post, decrement the parent's replies
// counter (guarded > 0), and delete the bridged PDS record if present.
export async function deleteReply(reply, parentPost) {
  await base44.entities.Post.delete(reply.id).catch(() => {});
  const ref = normalizeRef(parentPost);
  if (ref?.isLocal) {
    await base44.entities.Post.update(ref.id, { replies: Math.max(0, (ref.replies || 0) - 1) }).catch(() => {});
  }
  if (reply?.at_uri?.startsWith('at://did:')) {
    base44.functions.invoke('atproto-bridge', { action: 'delete', uri: reply.at_uri }).catch(() => {});
  }
}

// Create a quote-repost: a new app.bsky.feed.post with the target embedded as
// a quote (app.bsky.embed.record). The local Post stores the quote text plus
// quote_of_id / quote_ref so the QuotedPostCard embed renders before the PDS
// bridge completes. `extra` carries visibility_scope, reply_policy, hashtags,
// canonical_tags and mentioned_dids (same shape as ComposeBox). Works for both
// local and external targets via normalizeRef.
export async function createQuoteRepost(post, text, user, extra = {}) {
  const ref = normalizeRef(post);
  await ensureBotAllowed('post', text);
  const { did, signingKey } = await ensureUserDid();
  const stamped = await stampRecord({
    content: text.trim(),
    post_type: 'text',
    author_name: user?.display_name || user?.full_name || 'Collector',
    author_handle: user?.bsky_handle || user?.username || (user?.email ? user.email.split('@')[0] : ''),
    author_avatar: user?.avatar || '',
    likes: 0, reposts: 0, replies: 0,
    quote_of_id: ref.isLocal ? ref.id : (extra.quote_of_id || ''),
    quote_ref: ref.at_uri || '',
    visibility_scope: extra.visibility_scope || 'public',
    reply_policy: extra.reply_policy || 'everybody',
    hashtags: extra.hashtags || [],
    canonical_tags: extra.canonical_tags || [],
    mentioned_dids: extra.mentioned_dids || [],
  }, NSID.POST, did, signingKey);
  const created = await base44.entities.Post.create(stamped);
  if (created?.id) {
    base44.functions.invoke('moderatePost', { post_id: created.id }).catch(() => {});
  }
  if (ref.at_uri && ref.cid) {
    base44.functions.invoke('atproto-bridge', {
      collection: 'app.bsky.feed.post',
      record: {
        text: text.trim().slice(0, 3000),
        createdAt: new Date().toISOString(),
        langs: ['en'],
        embed: { $type: 'app.bsky.embed.record', record: { uri: ref.at_uri, cid: ref.cid } },
      },
    }).then((res) => {
      if (res?.uri) base44.entities.Post.update(created.id, { at_uri: res.uri, cid: res.cid, bridged: true }).catch(() => {});
    }).catch(() => {});
  }
  if (ref.isLocal) {
    notify('quote', ref.did, { id: created.id, at_uri: ref.at_uri, cid: ref.cid, content: text.trim() }, actorFromUser(user), 'local', { quoteText: text.trim().slice(0, 200) });
  }
  return created;
}