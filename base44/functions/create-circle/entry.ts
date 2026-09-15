import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { projectCircle } from '../../shared/circleAccess.ts';

// Creates local authority only. PDS publication is a separate, consent-gated
// concern and can never create or alter accepted local membership.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id || !user?.did) return Response.json({ error: 'Sign in with a provisioned identity' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const region = typeof body.region === 'string' ? body.region.trim() : '';
    const visibility = body.visibility || 'public';
    const theme = body.theme || 'general';
    if (!name || name.length > 60 || description.length > 200 || region.length > 100 ||
        !['public', 'members_visible', 'private'].includes(visibility) ||
        !['general', 'vintage', 'competitive', 'shiny', 'investment', 'local_region', 'artist'].includes(theme)) {
      return Response.json({ error: 'Invalid Circle details' }, { status: 400 });
    }
    // Check the latest account state, failing closed on datastore failure.
    const statuses = await svc.entities.AccountStatus.filter({ user_id: user.id }, '-updated_date', 1);
    const status = statuses[0];
    const suspensionExpired = status?.status === 'suspended' && status.suspended_until &&
      new Date(status.suspended_until).getTime() <= Date.now();
    if (status && status.status !== 'active' && !suspensionExpired) {
      return Response.json({ error: 'Circle creation is unavailable for this account' }, { status: 403 });
    }
    // This bounded creation guard is not a substitute for an atomic rate limiter.
    const recent = await svc.entities.CircleAuthority.filter({
      owner_user_id: user.id, created_date: { $gte: new Date(Date.now() - 86400000).toISOString() },
    }, '-created_date', 5);
    if (recent.length >= 5) return Response.json({ error: 'Circle creation limit reached. Try again later.' }, { status: 429 });

    const circle = await svc.entities.Circle.create({
      created_by_id: user.id, name, description, theme, visibility,
      region: theme === 'local_region' ? region : '',
      did: user.did, author_name: user.display_name || user.full_name || '',
      author_handle: user.username || user.bsky_handle || '',
      member_dids: [], member_profiles: [], member_count: 1,
      bridged: false, record_type: 'org.swappulse.circle',
    });
    const authority = await svc.entities.CircleAuthority.create({
      created_by_id: user.id, circle_id: circle.id, owner_user_id: user.id,
      owner_did: user.did, visibility,
    });
    return Response.json({ ok: true, circle: projectCircle(circle, authority, [user], true), publication: 'local_only' });
  } catch (error: any) {
    console.error('create-circle:', error?.message);
    return Response.json({ error: 'Could not create Circle' }, { status: 500 });
  }
}
