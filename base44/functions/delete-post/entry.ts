// delete-post — deletes a local Post record as the service role, bypassing
// RLS so users can delete their own firehose-ingested posts (where
// created_by_id is the service role, not the user). Ownership is verified by
// matching the caller's DID against the post's did field, or the caller's
// user id against created_by_id. Also best-effort cleans up local likes/reposts
// targeting the post. The PDS record deletion is handled client-side via the
// atproto-bridge function (which uses the user's per-user PDS session).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { post_id, at_uri } = body;
    if (!post_id && !at_uri) {
      return Response.json({ error: 'post_id or at_uri is required' }, { status: 400 });
    }

    // Load the post as service role (bypasses RLS).
    let post: any = null;
    if (post_id) {
      post = await base44.asServiceRole.entities.Post.get(post_id).catch(() => null);
    }
    if (!post && at_uri) {
      const matches = await base44.asServiceRole.entities.Post
        .filter({ at_uri }, '-created_date', 1).catch(() => []);
      post = matches?.[0] || null;
    }
    if (!post) {
      // Already gone — treat as success.
      return Response.json({ ok: true, deleted: false, reason: 'not_found' });
    }

    // Verify ownership: caller's DID matches post's did, or caller's user id
    // matches created_by_id. Admins can delete any post.
    const ownsByDid = !!user.did && !!post.did && post.did === user.did;
    const ownsByCreator = !!post.created_by_id && post.created_by_id === user.id;
    const isAdmin = user.role === 'admin';
    if (!ownsByDid && !ownsByCreator && !isAdmin) {
      return Response.json({ error: 'You can only delete your own posts.' }, { status: 403 });
    }

    // Delete the local Post as service role.
    await base44.asServiceRole.entities.Post.delete(post.id).catch((e: any) => {
      console.error('delete-post: local delete failed', e?.message || e);
    });

    // Clear the pinned post reference if the deleted post was pinned.
    if (user.pinned_post_id && user.pinned_post_id === post.id) {
      await base44.asServiceRole.entities.User.update(user.id, { pinned_post_id: '' }).catch(() => {});
    }

    // Best-effort: clean up local likes/reposts targeting this post.
    const filter = post.id ? { post_id: post.id } : { post_uri: post.at_uri };
    try {
      const [likes, reposts] = await Promise.all([
        base44.asServiceRole.entities.Like.filter(filter, '-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.Repost.filter(filter, '-created_date', 500).catch(() => []),
      ]);
      for (const l of likes) base44.asServiceRole.entities.Like.delete(l.id).catch(() => {});
      for (const r of reposts) base44.asServiceRole.entities.Repost.delete(r.id).catch(() => {});
    } catch { /* best-effort */ }

    return Response.json({ ok: true, deleted: true, at_uri: post.at_uri || '' });
  } catch (error) {
    console.error('delete-post: unexpected error', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}