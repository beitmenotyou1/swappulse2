import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getCircleAccess, getCircleMembers, projectCircle } from '../../shared/circleAccess.ts';

// The actor is always the authenticated account. No curator, imported record,
// Starter Pack or client may add another person's accepted membership.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id || !user?.did) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const circleId = String(body.circle_id || body.circleId || '').trim();
    const action = body.action;
    if (!circleId || circleId.length > 128 || !['join', 'leave'].includes(action)) {
      return Response.json({ error: 'circle_id and action (join|leave) are required' }, { status: 400 });
    }
    const access = await getCircleAccess(svc, circleId, user);
    const authority = access.authority;
    if (!authority || (authority.visibility !== 'public' && !access.isMember)) {
      return Response.json({ error: 'Circle not found' }, { status: 404 });
    }
    const circle = await svc.entities.Circle.get(authority.circle_id).catch(() => null);
    if (!circle) return Response.json({ error: 'Circle not found' }, { status: 404 });
    if (action === 'leave' && access.isCurator) {
      return Response.json({ error: 'The curator cannot leave their own circle' }, { status: 409 });
    }
    if (action === 'join') {
      const statuses = await svc.entities.AccountStatus.filter({ user_id: user.id }, '-updated_date', 1);
      const status = statuses[0];
      const expired = status?.status === 'suspended' && status.suspended_until &&
        new Date(status.suspended_until).getTime() <= Date.now();
      if (status && status.status !== 'active' && !expired) {
        return Response.json({ error: 'Circle joining is unavailable for this account' }, { status: 403 });
      }
    }
    const shouldWrite = action === 'join' ? !access.isMember : access.isMember;
    if (shouldWrite) {
      await svc.entities.CircleMembershipEvent.create({
        created_by_id: user.id, circle_id: authority.circle_id,
        user_id: user.id, did: user.did, state: action === 'join' ? 'active' : 'left',
      });
    }
    const current = await getCircleAccess(svc, circleId, user);
    if (current.isMember !== (action === 'join')) {
      return Response.json({ error: 'Membership changed concurrently. Refresh and try again.' }, { status: 409 });
    }
    const members = await getCircleMembers(svc, authority);
    // Display cache only. Permission checks never read this count or arrays.
    await svc.entities.Circle.update(circle.id, { member_count: members.length }).catch(() => {});
    return Response.json({
      ok: true, joined: action === 'join' && shouldWrite, isMember: current.isMember,
      circle: projectCircle(circle, authority, members, current.isMember || authority.visibility === 'public'),
    });
  } catch (error: any) {
    console.error('circle-membership:', error?.message);
    return Response.json({ error: 'Could not update circle membership' }, { status: 500 });
  }
}

