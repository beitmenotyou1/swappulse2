// Create a pending labeler for an authenticated account. Applicants cannot
// directly set approval, DID, counters or reviewer metadata.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 });
    if (!String(user.did || '').startsWith('did:plc:')) return Response.json({ error: 'A linked identity is required' }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || 'other');
    const values = body.label_values;
    if (name.length < 3 || name.length > 64 || description.length > 500 ||
      !['authenticity', 'safety', 'grading', 'expertise', 'quality', 'other'].includes(category) ||
      !Array.isArray(values) || values.length < 1 || values.length > 20 ||
      new Set(values).size !== values.length ||
      values.some((v: unknown) => typeof v !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(v))) {
      return Response.json({ error: 'Invalid labeler details' }, { status: 400 });
    }
    const created = await base44.asServiceRole.entities.CommunityLabeler.create({
      created_by_id: user.id, did: user.did, name, description, category,
      label_values: values, approval_status: 'pending',
      author_name: user.display_name || user.full_name || '',
      author_handle: user.bsky_handle || user.username || '',
      subscriber_count: 0, label_count: 0,
    });
    return Response.json({ ok: true, labeler: created }, { status: 201 });
  } catch (error) {
    console.error('submit-community-labeler error', error?.message || error);
    return Response.json({ error: 'Could not submit labeler' }, { status: 500 });
  }
}
