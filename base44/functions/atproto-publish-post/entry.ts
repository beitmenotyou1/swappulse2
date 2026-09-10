import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  AtprotoPublishError,
  publishLocalPost,
} from '../../shared/atprotoPostPublisher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const postId = String(body?.post_id || '').trim();
    if (!postId) {
      return Response.json({ error: 'post_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const posts = await svc.entities.Post
      .filter({ id: postId }, '-created_date', 1)
      .catch(() => []);
    const post = posts?.[0];
    if (!post) {
      return Response.json({ error: 'Post not found' }, { status: 404 });
    }
    const ownsPost = post.created_by_id === caller.id;
    if (!ownsPost && caller.role !== 'admin') {
      return Response.json({ error: 'You can only publish your own post' }, { status: 403 });
    }

    const owners = await svc.entities.User
      .filter({ id: post.created_by_id }, '-created_date', 1)
      .catch(() => []);
    const owner = owners?.[0];
    if (!owner) {
      return Response.json({ error: 'Post owner not found' }, { status: 409 });
    }

    const result = await publishLocalPost(svc, owner, post, 'manual');
    return Response.json(result);
  } catch (error) {
    const code = error instanceof AtprotoPublishError
      ? error.code
      : 'AT_PUBLICATION_FAILED';
    const message = error instanceof AtprotoPublishError
      ? error.message
      : 'BlueSky publication failed. SwapPulse will retry automatically.';
    console.error('atproto-publish-post:', code);
    return Response.json({
      error: message,
      code,
      post_saved: true,
      retry_scheduled: true,
    }, { status: 502 });
  }
});
