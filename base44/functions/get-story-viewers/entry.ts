import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Story viewer identities are visible only to the story owner (and admins).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const storyId = String(body.story_id || '').trim();
    if (!storyId) return Response.json({ error: 'story_id required' }, { status: 400 });

    const story = await svc.entities.Story.get(storyId).catch(() => null);
    if (!story) return Response.json({ error: 'Story not found' }, { status: 404 });
    const isOwner = story.created_by_id === user.id || (!!user.did && story.did === user.did);
    if (!isOwner && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await svc.entities.StoryView.filter({ story_id: storyId }, '-viewed_at', 200).catch(() => []);
    return Response.json({ viewers: (rows || []).map((v: any) => ({
      viewer_did: v.viewer_did || '',
      viewer_name: v.viewer_name || '',
      viewer_handle: v.viewer_handle || '',
      viewer_avatar: v.viewer_avatar || '',
      viewed_at: v.viewed_at || '',
    })) });
  } catch (error: any) {
    console.error('get-story-viewers error:', error?.message || error);
    return Response.json({ error: 'Could not load story viewers' }, { status: 500 });
  }
}
