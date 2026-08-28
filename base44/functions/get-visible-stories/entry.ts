import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns only stories the authenticated viewer is authorised to see, plus
// their own view markers. Friends-only visibility is enforced server-side.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.did) return Response.json({ stories: [], seen_story_ids: [] });
    const svc = base44.asServiceRole;

    const cutoff = new Date().toISOString();
    const [active, mine, asFriend] = await Promise.all([
      svc.entities.Story.filter({ expires_at: { $gte: cutoff } }, '-created_date', 200).catch(() => []),
      svc.entities.Friendship.filter({ did: user.did, status: 'accepted' }, '-updated_date', 500).catch(() => []),
      svc.entities.Friendship.filter({ friend_did: user.did, status: 'accepted' }, '-updated_date', 500).catch(() => []),
    ]);

    const friendDids = new Set<string>();
    for (const f of mine || []) if (f.friend_did) friendDids.add(f.friend_did);
    for (const f of asFriend || []) if (f.did) friendDids.add(f.did);

    const stories = (active || []).filter((s: any) =>
      s.did === user.did ||
      s.audience === 'public' ||
      (s.audience === 'friends' && friendDids.has(s.did))
    );

    const storyIds = stories.map((s: any) => s.id).filter(Boolean);
    const views = storyIds.length
      ? await svc.entities.StoryView.filter({ viewer_did: user.did, story_id: { $in: storyIds } }, '-viewed_at', 500).catch(() => [])
      : [];

    return Response.json({
      stories,
      seen_story_ids: [...new Set((views || []).map((v: any) => v.story_id).filter(Boolean))],
    });
  } catch (error: any) {
    console.error('get-visible-stories error:', error?.message || error);
    return Response.json({ error: 'Could not load stories' }, { status: 500 });
  }
}
