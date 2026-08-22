// get-explore-feed — returns recent local posts for the Explore "Everybody"
// feed, enriched with current author avatars and display names from the User
// table so profile pictures always render even for posts created before
// avatar denormalisation or when the user updated their avatar afterwards.
//
// Input:  { limit?: number }
// Output: { items: Post[], source: 'explore' }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { enrichAuthorAvatars } from '../../shared/avatarEnrichment.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);

    const svc = base44.asServiceRole;

    // 1. Fetch recent local posts (everybody feed)
    const posts = await base44.entities.Post.list('-created_date', limit).catch(() => []);
    const items = (posts || []).map((p: any) => ({ ...p, external: false }));

    // 2. Enrich with current avatars from the User table
    await enrichAuthorAvatars(svc, items);

    return Response.json({ items, source: 'explore' });
  } catch (error: any) {
    console.error('get-explore-feed error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}