// §2.5 getTradeInterest - the trade-interest matcher. Returns trade_interest
// reactions on the current user's own posts so card owners can see who wants
// their cards. Mirrors reactions/trade-interest.matcher.ts.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const myPosts = user.did
      ? await svc.entities.Post.filter({ did: user.did }, '-created_date', 200)
      : [];
    const myPostMap = new Map(myPosts.map((p) => [p.id, p]));
    const myPostIds = new Set(myPosts.map((p) => p.id));

    const mine = myPostIds.size > 0
      ? await svc.entities.Reaction.filter(
          { reaction_type: 'trade_interest', post_id: { $in: [...myPostIds] } },
          '-created_date',
          500,
        )
      : [];

    return Response.json({
      count: mine.length,
      interests: mine.map((r) => ({
        id: r.id,
        post_id: r.post_id,
        card_name: myPostMap.get(r.post_id)?.card_name || '',
        reactor_name: r.reactor_name,
        reactor_handle: r.reactor_handle,
        created_at: r.created_date,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});