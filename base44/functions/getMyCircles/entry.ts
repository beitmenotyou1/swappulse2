import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { readCircleRows, getCircleAccess } from '../../shared/circleAccess.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id || !user?.did) return Response.json({ circles: [] });
    const svc = base44.asServiceRole;
    // Query this account's authority/events, never the newest global Circles.
    const [owned, events] = await Promise.all([
      readCircleRows(svc.entities.CircleAuthority, { owner_user_id: user.id }),
      readCircleRows(svc.entities.CircleMembershipEvent, { user_id: user.id }),
    ]);
    const ids = [...new Set([...owned, ...events].map((row: any) => row.circle_id).filter(Boolean))];
    const circles: any[] = [];
    for (const id of ids) {
      const access = await getCircleAccess(svc, id, user);
      if (!access.isMember) continue;
      const circle = await svc.entities.Circle.get(id).catch(() => null);
      if (!circle) continue;
      circles.push({
        id: circle.id, name: circle.name, description: circle.description || '',
        at_uri: access.authority.canonical_ref || '', circle_ref: circle.id,
        member_count: circle.member_count, visibility: access.authority.visibility,
        theme: circle.theme, did: access.authority.owner_did, isCurator: access.isCurator,
      });
    }
    return Response.json({ circles });
  } catch (error: any) {
    console.error('getMyCircles:', error?.message);
    return Response.json({ error: 'Could not load Circle memberships' }, { status: 503 });
  }
});
