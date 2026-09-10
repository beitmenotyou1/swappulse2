import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { publishLocalPost } from '../../shared/atprotoPostPublisher.ts';

const BATCH_SIZE = 25;

function isDue(post: any): boolean {
  const attempts = Math.max(0, Number(post?.federation_attempts || 0));
  const last = Date.parse(String(post?.federation_last_attempt_at || ''));
  if (!Number.isFinite(last)) return true;
  const credentialFailure = [
    'AT_CREDENTIALS_MISSING',
    'AT_AUTHENTICATION_FAILED',
    'AT_IDENTITY_MISMATCH',
  ].includes(String(post?.federation_error_code || ''));
  const delayMs = credentialFailure
    ? 24 * 60 * 60 * 1000
    : Math.min(24 * 60 * 60 * 1000, Math.max(5 * 60 * 1000, (2 ** Math.min(attempts, 8)) * 5 * 60 * 1000));
  return Date.now() - last >= delayMs;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const [pending, failed] = await Promise.all([
      svc.entities.Post.filter(
        { visibility_scope: 'public', federation_status: 'pending' },
        'created_date',
        BATCH_SIZE,
      ).catch(() => []),
      svc.entities.Post.filter(
        { visibility_scope: 'public', federation_status: 'failed' },
        'created_date',
        BATCH_SIZE,
      ).catch(() => []),
    ]);

    const candidates = Array.from(
      new Map([...pending, ...failed].map((post: any) => [post.id, post])).values(),
    )
      .filter(isDue)
      .slice(0, BATCH_SIZE);

    const userIds = Array.from(new Set(candidates.map((post: any) => post.created_by_id).filter(Boolean)));
    const users = userIds.length
      ? await svc.entities.User.filter({ id: { $in: userIds } }, '-created_date', userIds.length).catch(() => [])
      : [];
    const usersById = new Map(users.map((user: any) => [user.id, user]));

    const results: any[] = [];
    for (const post of candidates) {
      const owner = usersById.get(post.created_by_id);
      if (!owner) {
        results.push({ post_id: post.id, ok: false, code: 'AT_POST_OWNER_MISSING' });
        continue;
      }
      try {
        const result = await publishLocalPost(svc, owner, post, 'retry');
        results.push({ post_id: post.id, ok: true, uri: result.uri });
      } catch (error) {
        results.push({
          post_id: post.id,
          ok: false,
          code: String(error?.code || 'AT_PUBLICATION_FAILED'),
        });
      }
    }

    return Response.json({
      ok: true,
      considered: pending.length + failed.length,
      attempted: candidates.length,
      published: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    });
  } catch (error) {
    console.error('retry-pending-posts:', error?.message || error);
    return Response.json({ error: 'Retry worker failed' }, { status: 500 });
  }
});
