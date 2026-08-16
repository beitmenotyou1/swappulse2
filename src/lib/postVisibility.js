// Post visibility filtering helpers.
// A post's visibility_scope controls who can SEE it (independent of reply_policy
// which controls who can reply). Enforced client-side on every read path after
// the posts are fetched; the bridged app.bsky.feed.postgate record handles
// remote enforcement on the federated network.
//
// Tiers:
//   public (default) — visible to everyone
//   followers       — visible only to accounts who follow the author
//   mentioned       — visible only to accounts whose DID is in mentioned_dids

// Returns true if the viewer is permitted to see the post.
//   post         — the Post record (needs visibility_scope, did, mentioned_dids)
//   viewerDid    — the current user's DID (empty for guests)
//   followedDids — Set of DIDs the viewer follows (author must be in here for followers-only)
export function canViewPost(post, viewerDid, followedDids) {
  if (!post) return false;
  const scope = post.visibility_scope || 'public';
  // Author always sees their own posts.
  if (viewerDid && post.did && viewerDid === post.did) return true;
  if (scope === 'public') return true;
  if (scope === 'followers') {
    if (!viewerDid) return false;
    return followedDids instanceof Set ? followedDids.has(post.did) : false;
  }
  if (scope === 'mentioned') {
    if (!viewerDid) return false;
    const mentioned = Array.isArray(post.mentioned_dids) ? post.mentioned_dids : [];
    return mentioned.includes(viewerDid);
  }
  return true;
}

// Filter an array of posts to those the viewer is permitted to see.
export function filterVisiblePosts(posts, viewerDid, followedDids) {
  if (!Array.isArray(posts)) return [];
  return posts.filter((p) => canViewPost(p, viewerDid, followedDids));
}

// Human label for a visibility scope, for gated-state UI.
export function visibilityLabel(scope) {
  if (scope === 'followers') return 'followers';
  if (scope === 'mentioned') return 'mentioned accounts';
  return 'everyone';
}