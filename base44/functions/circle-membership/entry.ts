import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Join/leave a Circle without granting ordinary members update access to the
// curator-owned Circle row. Membership is local application state. The public
// AT Protocol Circle record is not rewritten by a joining member because that
// record belongs to the curator's repository.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.did) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const circleId = String(body.circle_id || body.circleId || '').trim();
    const action = String(body.action || '').trim();
    if (!circleId || !['join', 'leave'].includes(action)) {
      return Response.json({ error: 'circle_id and action (join|leave) are required' }, { status: 400 });
    }

    const circle = await svc.entities.Circle.get(circleId).catch(() => null);
    if (!circle) return Response.json({ error: 'Circle not found' }, { status: 404 });
    const isCurator = circle.did === user.did || circle.created_by_id === user.id;
    if (action === 'leave' && isCurator) {
      return Response.json({ error: 'The curator cannot leave their own circle' }, { status: 409 });
    }
    if (action === 'join' && circle.visibility === 'private' && !isCurator) {
      return Response.json({ error: 'This circle is private' }, { status: 403 });
    }

    const members = new Set<string>((circle.member_dids || []).filter(Boolean));
    const profiles = Array.isArray(circle.member_profiles) ? [...circle.member_profiles] : [];

    if (action === 'join') {
      members.add(user.did);
      if (!profiles.some((p: any) => p?.did === user.did)) {
        profiles.push({
          did: user.did,
          name: user.display_name || user.full_name || user.username || 'Collector',
          handle: user.username || user.bsky_handle || '',
          avatar: user.avatar || '',
        });
      }
      const exits = await svc.entities.CircleExit
        .filter({ circle_id: circleId, did: user.did }, '-created_date', 50).catch(() => []);
      for (const exit of exits || []) await svc.entities.CircleExit.delete(exit.id).catch(() => {});
    } else {
      members.delete(user.did);
      for (let i = profiles.length - 1; i >= 0; i--) {
        if (profiles[i]?.did === user.did) profiles.splice(i, 1);
      }
      const existing = await svc.entities.CircleExit
        .filter({ circle_id: circleId, did: user.did }, '-created_date', 1).catch(() => []);
      if (!existing?.length) {
        await svc.entities.CircleExit.create({
          circle_ref: circle.at_uri || '',
          circle_id: circleId,
          exited_at: new Date().toISOString(),
          did: user.did,
        });
      }
    }

    const updated = await svc.entities.Circle.update(circleId, {
      member_dids: [...members],
      member_profiles: profiles.slice(0, 100),
      member_count: members.size,
    });

    return Response.json({ ok: true, circle: updated, joined: action === 'join' });
  } catch (error: any) {
    console.error('circle-membership error:', error?.message || error);
    return Response.json({ error: 'Could not update circle membership' }, { status: 500 });
  }
}
