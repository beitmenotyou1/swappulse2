// §2.7 getCircle - resolves a circle for the viewer: membership status,
// whether the viewer may see the member list, and (for members only) the
// circle-scoped trade listings. Private circles are hidden from non-members.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const circleId = body.circleId;
    if (!circleId) return Response.json({ error: 'circleId required' }, { status: 400 });

    const circle = await svc.entities.Circle.get(circleId).catch(() => null);
    if (!circle) return Response.json({ error: 'Circle not found' }, { status: 404 });

    const viewerDid = user?.did || '';
    const isCurator = !!user && (circle.did === viewerDid || circle.created_by_id === user.id);
    const isMember = !!viewerDid && (circle.member_dids || []).includes(viewerDid);
    const canSeeMembers = isCurator || isMember || circle.visibility === 'public';

    // Parallelize the two independent fetches (exit check + scoped trades).
    const [exits, scopedTrades] = await Promise.all([
      viewerDid
        ? svc.entities.CircleExit.filter({ circle_id: circleId, did: viewerDid }).catch(() => [])
        : Promise.resolve([]),
      (isMember || isCurator)
        ? svc.entities.TradeListing.filter(
            { status: 'open', visibility: 'circle_scoped', circle_ref: circle.at_uri },
            '-created_date',
            50,
          ).catch(() => [])
        : Promise.resolve([]),
    ]);
    const hasExited = exits.length > 0;

    const denied = circle.visibility !== 'public' && !isMember && !isCurator;
    const safeCircle = denied
      ? { id: circle.id, name: circle.name, visibility: circle.visibility, theme: circle.theme, member_count: circle.member_count }
      : circle;

    return Response.json({
      circle: safeCircle,
      isCurator,
      isMember,
      hasExited,
      canSeeMembers,
      denied,
      scopedTrades,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});