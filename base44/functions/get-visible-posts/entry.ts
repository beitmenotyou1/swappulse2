import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canViewPostServer, filterVisiblePostsServer } from '../../shared/postVisibility.ts';
import { sortPostsDescending } from '../../shared/postSort.ts';
import { enrichAuthorAvatars } from '../../shared/avatarEnrichment.ts';

const MAX_LIMIT = 100;
const MAX_SCAN = 500;

function safeString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const viewer = await base44.auth.me().catch(() => null);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));

    const id = safeString(body.id || body.post_id || body.postId);
    const atUri = safeString(body.at_uri || body.atUri);
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), MAX_LIMIT);
    const skip = Math.max(Number(body.skip) || 0, 0);

    if (id || atUri) {
      const post = id
        ? await svc.entities.Post.get(id).catch(() => null)
        : (await svc.entities.Post.filter({ at_uri: atUri }, '-created_date', 1).catch(() => []))?.[0] || null;
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });
      if (!(await canViewPostServer(svc, post, viewer))) {
        return Response.json({ error: 'Post not available' }, { status: 403 });
      }
      const items = [{ ...post }];
      await enrichAuthorAvatars(svc, items);
      return Response.json({ post: items[0] });
    }

    const query: Record<string, any> = {};
    const allowedStringFilters = ['did', 'post_type', 'card_id', 'root_uri', 'reply_to', 'parent_uri', 'quote_of_id'];
    for (const key of allowedStringFilters) {
      const value = safeString(body[key]);
      if (value) query[key] = value;
    }

    // Read a wider window because some rows may be filtered out by visibility.
    // Arbitrary MongoDB query input is deliberately not accepted.
    const scanLimit = Math.min(Math.max((skip + limit) * 4, limit), MAX_SCAN);
    const rows = Object.keys(query).length
      ? await svc.entities.Post.filter(query, '-created_date', scanLimit).catch(() => [])
      : await svc.entities.Post.list('-created_date', scanLimit).catch(() => []);

    const visible = await filterVisiblePostsServer(svc, sortPostsDescending(rows || []), viewer);
    const page = visible.slice(skip, skip + limit);
    await enrichAuthorAvatars(svc, page);

    return Response.json({
      items: page,
      has_more: visible.length > skip + limit || rows.length >= scanLimit,
    });
  } catch (error: any) {
    console.error('get-visible-posts error:', error?.message || error);
    return Response.json({ error: 'Could not load posts' }, { status: 500 });
  }
}
