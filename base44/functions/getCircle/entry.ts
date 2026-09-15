import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCircleAccess, getCircleMembers, projectCircle } from '../../shared/circleAccess.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const circleId = typeof body.circleId === 'string' ? body.circleId.trim() : '';
    if (!circleId || circleId.length > 128) return Response.json({ error: 'circleId required' }, { status: 400 });
    const access = await getCircleAccess(svc, circleId, user);
    const circle = await svc.entities.Circle.get(circleId).catch(() => null);
    const authority = access.authority;
    // Return the same response for missing and inaccessible private Circles.
    if (!circle || (authority ? authority.visibility !== 'public' && !access.isMember : circle.visibility !== 'public')) {
      return Response.json({ error: 'Circle not found' }, { status: 404 });
    }
    const members = authority ? await getCircleMembers(svc, authority) : [];
    const canSeeMembers = !!authority && (access.isMember || authority.visibility === 'public');
    const refs = authority ? [authority.circle_id, authority.canonical_ref].filter(Boolean) : [];
    const rows = access.isMember ? await svc.entities.TradeListing.filter({
      status: 'open', visibility: 'circle_scoped', circle_ref: { $in: refs },
    }, '-created_date', 50) : [];
    const scopedTrades = rows.filter((row: any) =>
      members.some((member: any) => member.id === row.created_by_id && member.did === row.did) &&
      (!row.expires_at || new Date(row.expires_at).getTime() > Date.now())
    );
    return Response.json({
      circle: projectCircle(circle, authority, members, canSeeMembers),
      isCurator: access.isCurator, isMember: access.isMember, hasExited: access.hasExited,
      canSeeMembers, denied: false, membershipAvailable: !!authority, scopedTrades,
    });
  } catch (error: any) {
    console.error('getCircle:', error?.message);
    return Response.json({ error: 'Could not load Circle' }, { status: 503 });
  }
});
