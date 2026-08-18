// §Alpha 1.4 Voice Spaces - ends a live space: sets status to ended, records
// the recording blob + duration + podcast link, and computes peak listener
// count from participant records. Only the host may end a space.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const spaceId = String(body.space_id || '');
    const recordingUrl = String(body.recording_url || '');
    const recordingDuration = Number(body.recording_duration_seconds || 0) || 0;
    const podcastEpisodeId = String(body.podcast_episode_id || '');
    if (!spaceId) return Response.json({ error: 'space_id required' }, { status: 400 });

    const svc = base44.asServiceRole;
    // Parallelize the space fetch + participant fetch (independent reads).
    const [space, participants] = await Promise.all([
      svc.entities.VoiceSpace.get(spaceId),
      svc.entities.SpaceParticipant.filter({ space_id: spaceId }, '-joined_at', 500),
    ]);
    if (!space) return Response.json({ error: 'Space not found' }, { status: 404 });
    const isOwner = space.created_by_id === user.id || (user.did && space.did === user.did);
    if (!isOwner) {
      return Response.json({ error: 'Only the host can end this space' }, { status: 403 });
    }
    const listenerCount = participants.filter((p) => p.role !== 'host' && !p.left_at).length;
    const peak = Math.max(space.peak_listener_count || 0, listenerCount);

    const now = new Date().toISOString();
    const update = {
      status: 'ended',
      ended_at: now,
      peak_listener_count: peak,
      listener_count: listenerCount,
      recording_blob_url: recordingUrl || undefined,
      recording_duration_seconds: recordingDuration || undefined,
      podcast_episode_id: podcastEpisodeId || undefined,
    };
    const updated = await svc.entities.VoiceSpace.update(spaceId, update);
    return Response.json({ space: updated, peak_listeners: peak });
  } catch (error) {
    console.error('endSpace error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});