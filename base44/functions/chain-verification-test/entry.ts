import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { AGE_POLICY_VERSION, deriveAgeEligibility } from '../../shared/agePolicy.ts';
import {
  buildPrivateEligibilityAttestation,
  privateEligibilityState,
} from '../../shared/privateEligibilityAttestation.ts';
import {
  getVerifiedConfig,
  normalizeHex,
  relayIdentityVerification,
} from '../../shared/chainRelay.ts';

const TEST_EVENT_PREFIX = 'SWAPPULSE_TEST_VERIFIER:';
const TEST_NETWORK = 'SWAPPULSE_TESTNET';

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function safeCode(error: unknown): string {
  return String((error as any)?.message || 'TEST_VERIFIER_FAILED')
    .replace(/[^A-Za-z0-9_:-]/g, '_')
    .slice(0, 160);
}

function newEventId(kind: string): string {
  return `${TEST_EVENT_PREFIX}${kind}:${crypto.randomUUID()}`;
}

function randomSubjectRef(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function allocateSubjectRef(svc: any): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = randomSubjectRef();
    const existing = await svc.entities.AgeVerificationSession
      .filter({ subject_ref: candidate }, '-created_date', 1)
      .catch(() => []);
    if (!existing?.length) return candidate;
  }
  throw new Error('TEST_VERIFIER_SUBJECT_ALLOCATION_FAILED');
}

async function loadIdentity(svc: any, recordId: string) {
  const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
  const identity = rows?.[0];
  if (!identity) throw new Error('IDENTITY_NOT_FOUND');
  if (String(identity.network || '') !== TEST_NETWORK) throw new Error('IDENTITY_NETWORK_MISMATCH');
  if (!['REGISTERED', 'RECOVERED', 'MERGED'].includes(String(identity.status || ''))) {
    throw new Error('IDENTITY_NOT_CHAIN_AUTHORITATIVE');
  }
  return identity;
}

async function loadAge(svc: any, userId: string) {
  const rows = await svc.entities.AgeStatus.filter({ user_id: userId }, '-updated_date', 5).catch(() => []);
  const age = rows?.[0];
  if (!age) throw new Error('AGE_STATUS_MISSING');
  if (String(age.age_band || '') !== '18_PLUS') throw new Error('TEST_VERIFIER_REQUIRES_18_PLUS_DECLARATION');
  return age;
}

export default async function(req: Request): Promise<Response> {
  let sessionId = '';
  let svc: any = null;
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    if (me.role !== 'admin') return jsonError('Admin access required', 403, 'ADMIN_REQUIRED');

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    if (!['attest', 'revoke'].includes(action)) return jsonError('Unknown test verifier action', 400, 'UNKNOWN_ACTION');

    const recordId = String(body.record_id || '').trim();
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');

    svc = base44.asServiceRole;
    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    if (String(config.identity_verification_mode || '').trim().toUpperCase() !== 'V2') {
      return jsonError('The synthetic verifier is available only in V2 mode', 409, 'V2_MODE_REQUIRED');
    }

    const identity = await loadIdentity(svc, recordId);
    const userId = String(identity.user_id || '');
    if (!userId) return jsonError('Chain identity has no Base44 owner mapping', 409, 'IDENTITY_USER_MAPPING_MISSING');
    const age = await loadAge(svc, userId);
    const identityId = normalizeHex(
      String(identity.status || '') === 'MERGED' ? identity.canonical_identity_id : identity.chain_identity_id,
      'canonical identity id',
    );
    const now = new Date();
    const nowIso = now.toISOString();

    if (action === 'attest') {
      const existingEventId = String(age.verifier_event_id || '');
      if (String(age.verifier_status || '') === 'VERIFIED' && existingEventId && !existingEventId.startsWith(TEST_EVENT_PREFIX)) {
        return jsonError('A non-test verifier assertion is already current. The synthetic verifier will not replace it.', 409, 'PRODUCTION_VERIFIER_ASSERTION_PROTECTED');
      }

      const requestedExpiry = Number(body.expires_in_seconds ?? 3600);
      if (!Number.isInteger(requestedExpiry) || requestedExpiry < 120 || requestedExpiry > 86400) {
        return jsonError('expires_in_seconds must be between 120 and 86400', 400, 'TEST_VERIFIER_EXPIRY_INVALID');
      }
      const expiresAt = new Date(now.getTime() + requestedExpiry * 1000).toISOString();
      const eventId = newEventId('VERIFIED');
      const subjectRef = await allocateSubjectRef(svc);
      const revision = Math.max(1, Number(age.revision || 0) + 1);
      const eligibility = deriveAgeEligibility('18_PLUS', 'THIRD_PARTY_VERIFIED');

      await svc.entities.AgeStatus.update(age.id, {
        age_band: '18_PLUS',
        age_method: 'THIRD_PARTY_VERIFIED',
        verification_level: 'ADULT_VERIFIED',
        verifier_status: 'VERIFIED',
        verifier_event_id: eventId,
        verifier_expires_at: expiresAt,
        verifier_revoked_at: '',
        policy_version: AGE_POLICY_VERSION,
        ...eligibility,
        wallet_eligible_at: age.wallet_eligible_at || nowIso,
        verified_at: nowIso,
        last_checked_at: nowIso,
        revision,
      });

      const session = await svc.entities.AgeVerificationSession.create({
        user_id: userId,
        subject_ref: subjectRef,
        status: 'VERIFIED',
        verifier_event_id: eventId,
        created_at: nowIso,
        verified_at: nowIso,
        expires_at: expiresAt,
        revoked_at: '',
        last_event_at: nowIso,
        chain_sync_status: 'PENDING',
        chain_tx_hash: '',
        last_error: '',
      });
      sessionId = String(session?.id || '');

      const state = await privateEligibilityState(svc, userId);
      const verification = await buildPrivateEligibilityAttestation(identityId, state);
      if (!verification) throw new Error('TEST_VERIFICATION_COMMITMENT_NOT_AVAILABLE');

      const result = await relayIdentityVerification('attest', { identity_id: identityId, verification });
      const txHash = result?.transaction_hash ? normalizeHex(result.transaction_hash, 'verification transaction hash') : '';

      await svc.entities.ChainIdentity.update(identity.id, {
        verification_tx_hash: txHash || identity.verification_tx_hash || '',
        failure_code: '',
      });
      if (sessionId) {
        await svc.entities.AgeVerificationSession.update(sessionId, {
          chain_sync_status: 'SYNCED',
          chain_tx_hash: txHash,
          last_error: '',
        });
      }

      return Response.json({
        ok: true,
        test_only: true,
        action: 'attest',
        record_id: identity.id,
        identity_id: identityId,
        verifier_event_id: eventId,
        expires_at: expiresAt,
        transaction_hash: txHash,
        verification_type: verification.verification_type,
        verification_level: verification.verification_level,
        reconciliation_required: true,
        note: 'Synthetic SwapPulse Testnet verifier assertion. This is not a production third-party identity-verification result.',
      });
    }

    const currentEventId = String(age.verifier_event_id || '');
    if (!currentEventId.startsWith(TEST_EVENT_PREFIX)) {
      return jsonError('The current verifier assertion was not created by the synthetic test verifier', 409, 'TEST_VERIFIER_NOT_CURRENT');
    }

    const revokeEventId = newEventId('REVOKED');
    const revision = Math.max(1, Number(age.revision || 0) + 1);

    // Fail closed in Base44 before attempting the privileged chain write.
    await svc.entities.AgeStatus.update(age.id, {
      verification_level: 'SELF_DECLARED',
      verifier_status: 'REVOKED',
      verifier_event_id: revokeEventId,
      verifier_revoked_at: nowIso,
      value_features_eligible: false,
      proof_of_use_eligible: false,
      last_checked_at: nowIso,
      revision,
    });

    const sessions = await svc.entities.AgeVerificationSession.filter({ user_id: userId }, '-created_date', 10).catch(() => []);
    const currentSession = (sessions || []).find((row: any) => String(row.verifier_event_id || '') === currentEventId) || sessions?.[0] || null;
    if (currentSession?.id) {
      sessionId = String(currentSession.id);
      await svc.entities.AgeVerificationSession.update(currentSession.id, {
        status: 'REVOKED',
        verifier_event_id: revokeEventId,
        revoked_at: nowIso,
        last_event_at: nowIso,
        chain_sync_status: 'PENDING',
        chain_tx_hash: '',
        last_error: '',
      });
    }

    const result = await relayIdentityVerification('revoke', { identity_id: identityId });
    const txHash = result?.transaction_hash ? normalizeHex(result.transaction_hash, 'verification revoke transaction hash') : '';
    await svc.entities.ChainIdentity.update(identity.id, {
      verification_revoke_tx_hash: txHash || identity.verification_revoke_tx_hash || '',
      failure_code: '',
    });
    if (sessionId) {
      await svc.entities.AgeVerificationSession.update(sessionId, {
        chain_sync_status: 'SYNCED',
        chain_tx_hash: txHash,
        last_error: '',
      });
    }

    return Response.json({
      ok: true,
      test_only: true,
      action: 'revoke',
      record_id: identity.id,
      identity_id: identityId,
      verifier_event_id: revokeEventId,
      transaction_hash: txHash,
      reconciliation_required: true,
      note: 'Synthetic test assertion revoked. Base44 value-bearing gates were disabled before the chain write.',
    });
  } catch (error: any) {
    const code = safeCode(error);
    if (sessionId && svc) {
      try {
        await svc.entities.AgeVerificationSession.update(sessionId, {
          chain_sync_status: 'FAILED',
          last_error: code,
        });
      } catch {
        // Best-effort diagnostic update only. The primary error is returned below.
      }
    }
    console.error('chain-verification-test failed', code);
    const client = code.includes('REQUIRED') || code.includes('INVALID') || code.includes('MISMATCH') || code.includes('PROTECTED') || code.includes('NOT_CURRENT') || code.includes('NOT_FOUND');
    return jsonError(client ? code.replaceAll('_', ' ') : 'Synthetic V2 verification test failed', client ? 409 : 502, code);
  }
}
