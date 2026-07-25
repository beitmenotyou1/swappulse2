// §Alpha 1.4 Live Presence — aggregates the set of currently-live users from
// two record sources: live Voice Spaces (hostDid) and live ExternalActivity
// records (isLive: true). Returns a list the client indexes by DID to render
// the universal red "live" ring. No new lexicon — this is a computed view.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const live = [];

    // 1. Voice spaces currently live — the host is live.
    const spaces = await svc.entities.VoiceSpace.filter({ status: 'live' }, '-started_at', 200).catch(() => []);
    for (const s of spaces) {
      if (!s.did) continue;
      live.push({
        did: s.did,
        platform: 'swappulse',
        url: `/spaces/${s.id}`,
        title: s.title || 'Voice Space',
        sourceType: 'voice_space',
        spaceId: s.id,
        startedAt: s.started_at || s.created_date,
        viewerCount: s.listener_count || 0,
        name: s.host_name,
        avatar: s.host_avatar,
      });
    }

    // 2. External activities currently live (Twitch / YouTube streams).
    const ext = await svc.entities.ExternalActivity.filter({ is_live: true }, '-created_date', 200).catch(() => []);
    for (const e of ext) {
      if (!e.did) continue;
      live.push({
        did: e.did,
        platform: e.platform || 'external',
        url: e.source_url || '',
        title: e.title || 'Live now',
        sourceType: 'external',
        startedAt: e.started_at || e.created_date,
        viewerCount: e.viewer_count || 0,
        name: e.author_name,
        avatar: e.author_avatar,
      });
    }

    return Response.json({ live });
  } catch (error) {
    console.error('getLiveUsers error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});