// submitChallengeEntry — creates a ChallengeEntry and runs the quality filter
// engine against the user's referenced CollectionEntry records. Writes the
// entry with status approved/rejected, the validated contribution_count, and
// the SHA-256 verification_hash. Returns the created entry + validation result.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { validateEntry } from '../../shared/challengeValidation.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to submit an entry' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { challengeId, contributionUris, notes, category, overrideProfileVisibility } = body;
    if (!challengeId) return Response.json({ error: 'challengeId required' }, { status: 400 });
    const uris: string[] = Array.isArray(contributionUris) ? contributionUris : [];
    if (!uris.length) return Response.json({ error: 'Select at least one qualifying card' }, { status: 400 });

    const challenge = await svc.entities.Challenge.get(challengeId).catch(() => null);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    const authorDid = (user as any).did || user.id;
    const records: any[] = [];
    for (const id of uris.slice(0, 100)) {
      const r = await svc.entities.CollectionEntry.get(id).catch(() => null);
      if (r) records.push(r);
    }

    const result = await validateEntry({ challenge, contributionRecords: records, authorDid });

    const entry = await base44.entities.ChallengeEntry.create({
      challenge_id: challengeId,
      challenge_ref: challenge.at_uri || '',
      participant_did: authorDid,
      participant_name: user.full_name || '',
      entry_type: challenge.mode === 'collective' ? 'card_pull' : 'set_progress',
      category: category || challenge.category || null,
      contribution_count: result.contributionScore,
      contribution_uris: uris,
      verification_hash: result.verificationHash,
      moderator_labels: result.valid ? ['verified'] : [],
      notes: notes || '',
      override_profile_visibility: overrideProfileVisibility || null,
      status: result.valid ? 'approved' : 'rejected',
      rejection_reason: result.valid ? '' : (Object.values(result.rejectionReasons)[0] || 'Did not pass filters'),
      submitted_at: new Date().toISOString(),
    });

    return Response.json({ entry, validation: result });
  } catch (error) {
    console.error('[submitChallengeEntry] error', error);
    return Response.json({ error: error?.message || 'Submit failed' }, { status: 500 });
  }
}