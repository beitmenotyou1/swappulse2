// apply-community-label — lets a collector who owns an approved CommunityLabeler
// apply (or remove) a community label on a post, profile, or trade listing.
// Validates that the caller owns an approved labeler whose label_values include
// the requested label_value before creating the CommunityLabel record (via the
// service role, since CommunityLabel RLS restricts mutations to admins).
//
// After applying, the labeler's label_count is incremented and the record is
// fire-and-forget bridged to the PDS via bridge-record.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { deleteBridgedRecord, publishRecord } from '../../shared/bridgePublish.ts';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action = 'apply', labeler_id, subject_uri, subject_type, label_value, note, label_id } = body;

    const svc = base44.asServiceRole;

    // ─── Remove ──────────────────────────────────────────────────────────
    if (action === 'remove') {
      if (!label_id) return Response.json({ error: 'label_id required' }, { status: 400 });
      const rows = await svc.entities.CommunityLabel.filter({ id: label_id }, '-created_date', 1).catch(() => []);
      const label = rows?.[0];
      if (!label) return Response.json({ error: 'Label not found' }, { status: 404 });
      // Only the labeler author (or admin) may remove their own labels.
      const owns = caller.role === 'admin' || (label.did && caller.did && label.did === caller.did);
      if (!owns) return Response.json({ error: 'You can only remove your own labels' }, { status: 403 });
      if (label.at_uri) {
        const removed = await deleteBridgedRecord(base44, 'CommunityLabel', label_id);
        if (!removed.ok) {
          return Response.json({ error: 'Could not remove the federated label. Try again shortly.' }, { status: 502 });
        }
      }
      await svc.entities.CommunityLabel.delete(label_id);
      // Decrement the labeler's label_count
      if (label.labeler_id) {
        const lrRows = await svc.entities.CommunityLabeler.filter({ id: label.labeler_id }, '-created_date', 1).catch(() => []);
        const lr = lrRows?.[0];
        if (lr && lr.label_count > 0) {
          await svc.entities.CommunityLabeler.update(lr.id, { label_count: lr.label_count - 1 }).catch(() => {});
        }
      }
      return Response.json({ ok: true, removed: label_id });
    }

    // ─── Apply ────────────────────────────────────────────────────────────
    if (!labeler_id || !subject_uri || !subject_type || !label_value) {
      return Response.json({ error: 'labeler_id, subject_uri, subject_type, label_value are required' }, { status: 400 });
    }

    // Find the caller's approved CommunityLabeler.
    const labelerRows = await svc.entities.CommunityLabeler.filter({ id: labeler_id }, '-created_date', 1).catch(() => []);
    const labeler = labelerRows?.[0];
    if (!labeler) return Response.json({ error: 'Labeler not found' }, { status: 404 });
    const ownsLabeler = (labeler.created_by_id && labeler.created_by_id === caller.id) || (labeler.did && caller.did && labeler.did === caller.did) || caller.role === 'admin';
    if (!ownsLabeler) return Response.json({ error: 'You do not own this labeler' }, { status: 403 });
    if (labeler.approval_status !== 'approved') return Response.json({ error: 'Labeler is not approved' }, { status: 403 });

    // Validate the label_value is in the labeler's label_values.
    const allowed = Array.isArray(labeler.label_values) ? labeler.label_values : [];
    if (!allowed.includes(label_value)) {
      return Response.json({ error: `Label value '${label_value}' is not in this labeler's allowed values` }, { status: 400 });
    }

    // Dedup: don't create a duplicate label from the same labeler on the same subject.
    const existing = await svc.entities.CommunityLabel.filter(
      { labeler_id, subject_uri, label_value },
      '-created_date',
      1,
    ).catch(() => []);
    if (existing?.length) {
      return Response.json({ ok: true, label: existing[0], duplicate: true });
    }

    // Create the label via service role (RLS blocks client creation).
    const created = await svc.entities.CommunityLabel.create({
      labeler_id,
      labeler_did: labeler.did || caller.did || '',
      labeler_name: labeler.name || '',
      labeler_category: labeler.category || 'other',
      subject_uri,
      subject_type,
      label_value,
      note: note || '',
      did: labeler.did || caller.did || '',
      record_type: 'org.swappulse.communityLabel',
      bridged: false,
    });

    // Increment the labeler's label_count.
    await svc.entities.CommunityLabeler.update(labeler_id, { label_count: (labeler.label_count || 0) + 1 }).catch(() => {});

    // Publish through the canonical bridge helper. A federation outage must not
    // lose the local moderation action, so leave bridged=false and surface the
    // pending state for a later retry.
    const published = await publishRecord(base44, 'CommunityLabel', created.id);

    return Response.json({
      ok: true,
      label: created,
      federation_pending: !published.ok,
    });
  } catch (e: any) {
    console.error('apply-community-label error:', e?.message || e);
    return Response.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}