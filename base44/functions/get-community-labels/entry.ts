// get-community-labels — batch query that returns community labels for a set
// of subject URIs, filtered to only the labelers the viewer has subscribed to.
// This powers the opt-in label badges on posts, profiles, and trade listings:
// a collector sees labels only from labelers they've chosen to subscribe to.
//
// Input:  { subject_uris: string[] }
// Output: { labels: Record<subject_uri, Label[]> }
//
// Guests (unauthenticated) and users with no labeler subscriptions get an empty
// map — community labels are strictly opt-in.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const subjectUris: string[] = Array.isArray(body.subject_uris) ? body.subject_uris.filter(Boolean) : [];
    if (!subjectUris.length) return Response.json({ labels: {} });

    const svc = base44.asServiceRole;

    // Resolve the viewer's subscribed labeler_ids. Guests get no labels.
    let subscribedLabelerIds: string[] = [];
    if (caller?.id) {
      const subs = await svc.entities.LabelerSubscription.filter(
        { created_by_id: caller.id },
        '-created_date',
        200,
      ).catch(() => []);
      subscribedLabelerIds = (subs || []).map((s) => s.labeler_id).filter(Boolean);
    }
    if (!subscribedLabelerIds.length) return Response.json({ labels: {} });

    // Query CommunityLabel records matching the subject URIs AND the viewer's
    // subscribed labelers. We chunk the $in queries to stay within platform
    // limits (max ~50 per $in is safe).
    const labelsByUri: Record<string, any[]> = {};
    const uriChunks = chunk(subjectUris, 50);
    for (const uriChunk of uriChunks) {
      const labels = await svc.entities.CommunityLabel.filter(
        { subject_uri: { $in: uriChunk }, labeler_id: { $in: subscribedLabelerIds } },
        '-created_date',
        200,
      ).catch(() => []);
      for (const label of labels || []) {
        const key = label.subject_uri;
        if (!key) continue;
        if (!labelsByUri[key]) labelsByUri[key] = [];
        labelsByUri[key].push({
          id: label.id,
          labeler_id: label.labeler_id,
          labeler_name: label.labeler_name,
          labeler_category: label.labeler_category,
          label_value: label.label_value,
          note: label.note,
          subject_type: label.subject_type,
          created_date: label.created_date,
        });
      }
    }

    return Response.json({ labels: labelsByUri });
  } catch (e: any) {
    console.error('get-community-labels error:', e?.message || e);
    return Response.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}