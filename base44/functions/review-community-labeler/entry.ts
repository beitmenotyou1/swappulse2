// Review community labelers with an append-only server-owned decision.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const reviewer = await base44.auth.me().catch(() => null);
    if (!reviewer) return Response.json({ error: 'Unauthorised' }, { status: 401 });
    if (reviewer.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const labelerId = String(body.labeler_id || '').trim();
    const decision = String(body.decision || '').trim();
    if (!labelerId || !['approved', 'rejected', 'revoked'].includes(decision)) {
      return Response.json({ error: 'Valid labeler_id and decision required' }, { status: 400 });
    }
    const svc = base44.asServiceRole;
    const rows = await svc.entities.CommunityLabeler.filter({ id: labelerId }, '-created_date', 1);
    const labeler = rows?.[0];
    if (!labeler) return Response.json({ error: 'Labeler not found' }, { status: 404 });
    // Invalid or orphaned legacy labelers must remain revocable.
    if (decision === 'approved') {
      const ownerRows = labeler.created_by_id
        ? await svc.entities.User.filter({ id: labeler.created_by_id }, '-created_date', 1)
        : [];
      const owner = ownerRows?.[0];
      if (!owner?.did || owner.did !== labeler.did) {
        return Response.json({ error: 'Labeler DID does not belong to its author' }, { status: 409 });
      }
    }
    const values = labeler.label_values;
    if (decision === 'approved' && (!Array.isArray(values) || !values.length || values.length > 20 ||
      values.some((v: unknown) => typeof v !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(v)))) {
      return Response.json({ error: 'Valid label values required for approval' }, { status: 400 });
    }
    const reviewedAt = new Date().toISOString();
    await svc.entities.CommunityLabelerReview.create({
      labeler_id: labeler.id, decision, author_id: String(labeler.created_by_id || ''),
      did: String(labeler.did || ''), category: labeler.category || 'other',
      label_values: Array.isArray(values) ? values : [],
      reviewed_by: reviewer.id, reviewed_at: reviewedAt,
      created_by_id: reviewer.id,
    });
    await svc.entities.CommunityLabeler.update(labeler.id, {
      approval_status: decision, reviewed_by: reviewer.id, reviewed_at: reviewedAt,
    });
    return Response.json({ ok: true, labeler_id: labeler.id, decision });
  } catch (error) {
    console.error('review-community-labeler error', error?.message || error);
    return Response.json({ error: 'Could not review labeler' }, { status: 500 });
  }
}
