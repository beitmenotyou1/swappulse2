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
    if (!uris.length || uris.length > 100 || uris.some((id) => typeof id !== 'string' || !id || id.length > 128)
        || new Set(uris).size !== uris.length) {
      return Response.json({ error: 'Select 1 to 100 distinct qualifying cards' }, { status: 400 });
    }

    const challenge = await svc.entities.Challenge.get(challengeId).catch(() => null);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    const authorDid = (user as any).did || user.id;
    // A collection-card validator cannot truthfully award grading, trade,
    // event or other metrics. Keep unsupported metrics closed until their
    // own authoritative evaluators exist.
    if (challenge.goal?.metric !== 'cards_logged') {
      return Response.json({ error: 'This challenge metric is not yet available for verified submissions' }, { status: 409 });
    }
    if (challenge.scope === 'circle' || challenge.mode === 'guild') {
      if (!user.did || !challenge.circle_ref) {
        return Response.json({ error: 'Circle membership required' }, { status: 403 });
      }
      const circles = await svc.entities.Circle.filter({ at_uri: challenge.circle_ref }, '-created_date', 2);
      if (circles.length !== 1 || !(circles[0].member_dids || []).includes(user.did)) {
        return Response.json({ error: 'Circle membership required' }, { status: 403 });
      }
    }
    // Bind every contributed card to this exact account before scoring.
    const records: any[] = await svc.entities.CollectionEntry.filter(
      { id: { $in: uris }, created_by_id: user.id }, '-created_date', 100
    );
    if (records.length !== uris.length) {
      return Response.json({ error: 'One or more cards are not in your collection' }, { status: 403 });
    }
    const result = await validateEntry({ challenge, contributionRecords: records, authorDid });

    const entry = await svc.entities.ChallengeEntry.create({
      created_by_id: user.id,
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