import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function randomSubjectRef(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    const svc = base44.asServiceRole;

    const ageRows = await svc.entities.AgeStatus.filter({ user_id: me.id }, '-updated_date', 5).catch(() => []);
    const age = ageRows?.[0];
    if (!age || String(age.age_band || '') !== '18_PLUS') {
      return jsonError('Declare the 18+ age band before starting adult verification', 403, 'ADULT_DECLARATION_REQUIRED');
    }

    const existing = await svc.entities.AgeVerificationSession
      .filter({ user_id: me.id, status: 'PENDING' }, '-created_date', 5)
      .catch(() => []);
    if (existing?.[0]) {
      return Response.json({
        ok: true,
        existing: true,
        session_id: existing[0].id,
        subject_ref: existing[0].subject_ref,
        status: 'PENDING',
        note: 'Use subject_ref as the verifier-side subject identifier. Do not send the Base44 user id, DOB or identity evidence through SwapPulse.',
      });
    }

    let subjectRef = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomSubjectRef();
      const collision = await svc.entities.AgeVerificationSession
        .filter({ subject_ref: candidate }, '-created_date', 1)
        .catch(() => []);
      if (!collision?.length) {
        subjectRef = candidate;
        break;
      }
    }
    if (!subjectRef) throw new Error('Could not allocate verifier subject reference');

    const now = new Date().toISOString();
    const session = await svc.entities.AgeVerificationSession.create({
      user_id: me.id,
      subject_ref: subjectRef,
      status: 'PENDING',
      verifier_event_id: '',
      created_at: now,
      verified_at: '',
      expires_at: '',
      revoked_at: '',
      last_event_at: '',
    });

    if (String(age.verifier_status || 'NONE') !== 'VERIFIED') {
      await svc.entities.AgeStatus.update(age.id, {
        verifier_status: 'PENDING',
        value_features_eligible: false,
        proof_of_use_eligible: false,
        last_checked_at: now,
      });
    }

    return Response.json({
      ok: true,
      existing: false,
      session_id: session.id,
      subject_ref: subjectRef,
      status: 'PENDING',
      note: 'Pass only this opaque subject_ref to the private verifier. SwapPulse does not need the verifier evidence, document data or DOB.',
    });
  } catch (error: any) {
    console.error('age-verification-session failed', error?.message || error);
    return Response.json({ error: 'Unable to start private adult verification' }, { status: 500 });
  }
}
