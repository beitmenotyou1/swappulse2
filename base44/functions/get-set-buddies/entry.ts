// get-set-buddies — finds other collectors working on the same Pokémon TCG set
// (set-completion co-op). Uses service role to aggregate CollectionEntry
// records across all users for the given set, computes each collector's
// completion, and identifies swap opportunities (cards they have that the
// requesting user needs, and vice versa) so collectors can coordinate
// to complete the set together.
//
// Input:  { set_id, my_card_ids?: string[] }
// Output: { buddies: [...], total_collectors }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const setId = String(body.set_id || '');
    const myCardIds: string[] = Array.isArray(body.my_card_ids) ? body.my_card_ids : [];

    if (!setId) {
      return Response.json({ error: 'set_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Fetch all collection entries for this set across all users
    const entries = await svc.entities.CollectionEntry.filter(
      { set_id: setId }, '-created_date', 500
    ).catch(() => []);

    // Group by user (created_by_id)
    const byUser = new Map();
    for (const e of entries) {
      const uid = e.created_by_id;
      if (!byUser.has(uid)) {
        byUser.set(uid, { user_id: uid, owned_card_ids: new Set(), did: e.did || '' });
      }
      if (e.card_id) byUser.get(uid).owned_card_ids.add(e.card_id);
    }

    // Fetch user profiles for display
    const userIds = Array.from(byUser.keys());
    let userMap = new Map();
    if (userIds.length > 0) {
      const users = await svc.entities.User.list('-created_date', 500).catch(() => []);
      userMap = new Map(users.map((u) => [u.id, u]));
    }

    const mySet = new Set(myCardIds);
    const buddies: any[] = [];

    for (const [uid, info] of byUser) {
      const user = userMap.get(uid);
      if (!user) continue;
      const name = user.full_name || user.email?.split('@')[0] || 'Collector';
      const handle = user.email?.split('@')[0] || '';
      const owned = Array.from(info.owned_card_ids);
      const theyHaveINeed = owned.filter((id) => !mySet.has(id));
      const iHaveTheyNeed = myCardIds.filter((id) => !info.owned_card_ids.has(id));

      buddies.push({
        user_id: uid,
        name,
        handle,
        avatar: '',
        did: info.did,
        owned_count: owned.length,
        they_have_i_need: theyHaveINeed.slice(0, 10),
        i_have_they_need: iHaveTheyNeed.slice(0, 10),
        swap_potential: theyHaveINeed.length + iHaveTheyNeed.length,
      });
    }

    buddies.sort((a, b) => b.swap_potential - a.swap_potential || b.owned_count - a.owned_count);

    return Response.json({
      buddies: buddies.slice(0, 12),
      total_collectors: byUser.size,
    });
  } catch (error) {
    console.error('get-set-buddies error:', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}