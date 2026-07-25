// §2.5 getReactions - aggregates reaction counts per post type for a batch of
// posts, plus the current user's own reaction (type + id) for each. Mirrors the
// Social Service reactions.service.ts aggregation.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const postIds = Array.isArray(body.postIds) ? body.postIds : [];
    const result = {};
    for (const id of postIds) result[id] = { counts: {}, mine: null, mineId: null };
    if (!postIds.length) return Response.json({ reactions: result });

    const set = new Set(postIds);
    const all = await svc.entities.Reaction.list('-created_date', 1000);
    for (const r of all) {
      if (!set.has(r.post_id)) continue;
      const entry = result[r.post_id];
      entry.counts[r.reaction_type] = (entry.counts[r.reaction_type] || 0) + 1;
      if (r.did === user.did) {
        entry.mine = r.reaction_type;
        entry.mineId = r.id;
      }
    }
    return Response.json({ reactions: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});