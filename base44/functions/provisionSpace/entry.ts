// §Alpha 1.4 Voice Spaces - provisions a (simulated) LiveKit room for a voice
// space and flips its status to live, then dispatches `goes_live` push
// notifications to bell-enabled followers via the existing notification
// dispatcher. The real-time audio transport (LiveKit SFU) is external infra;
// the AT Protocol layer owns identity, scheduling, and recording references.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const LIVEKIT_SERVER_URL = 'wss://livekit.swappulse.org';

function randomRoomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = 'sp-';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const spaceId = String(body.space_id || '');
    if (!spaceId) return Response.json({ error: 'space_id required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const space = await svc.entities.VoiceSpace.get(spaceId);
    if (!space) return Response.json({ error: 'Space not found' }, { status: 404 });
    if (space.did && user.did && space.did !== user.did) {
      return Response.json({ error: 'Only the host can start this space' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const roomName = space.livekit_room_name || randomRoomName();
    await svc.entities.VoiceSpace.update(spaceId, {
      status: 'live',
      started_at: space.started_at || now,
      livekit_room_name: roomName,
      livekit_server_url: LIVEKIT_SERVER_URL,
    });

    // Notify bell-enabled followers who opted into `goes_live`.
    let notified = 0;
    try {
      const res = await base44.functions.invoke('dispatchBellNotifications', {
        author_did: space.did || user.did,
        author_name: space.host_name || user.full_name || 'A collector',
        category: 'goes_live',
        preview: `is now live: ${space.title}`,
        url: `/spaces/${spaceId}`,
      });
      notified = res?.data?.dispatched || 0;
    } catch (e) {
      console.error('goes_live dispatch failed', e?.message || e);
    }

    return Response.json({ room_name: roomName, server_url: LIVEKIT_SERVER_URL, notified });
  } catch (error) {
    console.error('provisionSpace error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});