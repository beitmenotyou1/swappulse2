import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Returns one journal only when the viewer is allowed to read it.
// Public journals are guest-readable. Followers/private access is resolved
// server-side so the Journal entity never needs to expose non-public rows.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const viewer = await base44.auth.me().catch(() => null);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const journalId = String(body.journal_id || body.journalId || '').trim();
    if (!journalId) return Response.json({ error: 'journal_id required' }, { status: 400 });

    const journal = await svc.entities.Journal.get(journalId).catch(() => null);
    if (!journal) return Response.json({ error: 'Journal not found' }, { status: 404 });

    const isOwner = !!viewer && (
      journal.created_by_id === viewer.id || (!!viewer.did && journal.did === viewer.did)
    );
    const isAdmin = viewer?.role === 'admin';

    if (journal.visibility === 'public' || isOwner || isAdmin) {
      return Response.json({ journal, isOwner });
    }

    if (journal.visibility === 'followers' && viewer?.did && journal.did) {
      const follows = await svc.entities.Follow
        .filter({ did: viewer.did, subject_did: journal.did }, '-created_date', 1)
        .catch(() => []);
      if (follows?.length) return Response.json({ journal, isOwner: false });
    }

    return Response.json({ error: 'Journal not available' }, { status: 403 });
  } catch (error: any) {
    console.error('get-journal error:', error?.message || error);
    return Response.json({ error: 'Could not load journal' }, { status: 500 });
  }
}
