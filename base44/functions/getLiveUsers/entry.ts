// §Manual Go Live - aggregates the set of currently-live collectors from live
// VoiceSpace records (manual stream declarations). Each record carries a
// stream_url + platform + auto_end_at; the client renders the universal red
// "live" ring and opens the stream URL on click. Expired records (auto_end_at
// in the past) are lazily marked 'ended' so the ring disappears.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function detectPlatform(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('twitch.tv')) return 'twitch';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('kick.com')) return 'kick';
  if (u.includes('facebook.com') || u.includes('fb.gg')) return 'facebook_gaming';
  if (u.includes('rumble.com')) return 'rumble';
  return 'custom';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const live = [];
    const now = Date.now();
    const expiredIds = [];

    const spaces = await svc.entities.VoiceSpace.filter({ status: 'live' }, '-started_at', 200).catch(() => []);
    for (const s of spaces) {
      if (!s.did) continue;
      const autoEnd = s.auto_end_at ? new Date(s.auto_end_at).getTime() : 0;
      if (autoEnd && autoEnd < now) { expiredIds.push(s.id); continue; }
      live.push({
        did: s.did,
        platform: s.platform || detectPlatform(s.stream_url) || 'custom',
        url: s.stream_url || '',
        title: s.title || 'Live now',
        sourceType: 'stream',
        startedAt: s.started_at || s.created_date,
        viewerCount: s.viewer_count_estimate || 0,
        name: s.host_name,
        avatar: s.host_avatar,
      });
    }

    // Lazy auto-end: flip expired live records to 'ended' so they stop appearing.
    if (expiredIds.length) {
      await svc.entities.VoiceSpace.updateMany(
        { id: { $in: expiredIds } },
        { $set: { status: 'ended', ended_at: new Date().toISOString() } },
      ).catch(() => {});
    }

    return Response.json({ live });
  } catch (error) {
    console.error('getLiveUsers error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});