import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { AGE_POLICY_VERSION, deriveAgeEligibility } from '../../shared/agePolicy.ts';
import {
  buildPrivateEligibilityAttestation,
  privateEligibilityState,
} from '../../shared/privateEligibilityAttestation.ts';
import { getVerifiedConfig, relayIdentityVerification, normalizeHex } from '../../shared/chainRelay.ts';
import { timingSafeEqual } from '../../shared/cryptoCompare.ts';

const MAX_BODY_BYTES = 16 * 1024;
const ALLOWED_FIELDS = new Set([
  'event_id',
  'subject_ref',
  'status',
  'age_band',
  'verified_at',
  'expires_at',
  'occurred_at',
]);

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function parseDate(value: unknown, field: string, required = false): string {
  const raw = String(value || '').trim();
  if (!raw) {
    if (required) throw new Error(`${field.toUpperCase()}_REQUIRED`);
    return '';
  }
  const ms = new Date(raw).getTime();
  if (!Number.isFinite(ms)) throw new Error(`${field.toUpperCase()}_INVALID`);
  return new Date(ms).toISOString();
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return Array.from(digest).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeCode(error: unknown): string {
  return String((error as any)?.message || 'AGE_VERIFIER_SYNC_FAILED')
    .replace(/[^A-Za-z0-9_:-]/g, '_')
    .slice(0, 160);
}

async function currentIdentity(svc: any, userId: string) {
  const rows = await svc.entities.ChainIdentity.filter({ user_id: userId }, '-created_date', 20).catch(() => []);
  return (rows || []).find((row: any) => ['REGISTERED', 'RECOVERED', 'MERGED'].includes(String(row.status || ''))) || null;
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return jsonError('Webhook body too large', 413, 'WEBHOOK_BODY_TOO_LARGE');
    }

    const webhookSecret = String(secrets.get('SWAPPULSE_AGE_VERIFIER_WEBHOOK_SECRET') || '');
    if (webhookSecret.length < 32) return jsonError('Verifier webhook is not configured', 503, 'VERIFIER_WEBHOOK_NOT_CONFIGURED');
    const supplied = String(req.headers.get('x-swappulse-verifier-signature') || '').trim().toLowerCase();
    const suppliedHex = supplied.startsWith('sha256=') ? supplied.slice(7) : supplied;
    const expectedHex = await hmacHex(webhookSecret, raw);
    if (!/^[0-9a-f]{64}$/.test(suppliedHex) || !(await timingSafeEqual(suppliedHex, expectedHex))) {
      return jsonError('Invalid verifier signature', 401, 'INVALID_VERIFIER_SIGNATURE');
    }

    let body: any;
    try { body = JSON.parse(raw); } catch { return jsonError('Invalid JSON', 400, 'INVALID_JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return jsonError('Webhook body must be an object', 400, 'INVALID_WEBHOOK_BODY');
    for (const key of Object.keys(body)) {
      // The webhook is intentionally metadata-only. Reject unknown fields rather
      // than accidentally accepting DOB, document data, photos or raw evidence.
      if (!ALLOWED_FIELDS.has(key)) return jsonError(`Unexpected verifier field: ${key}`, 400, 'VERIFIER_EVIDENCE_NOT_ACCEPTED');
    }

    const eventId = String(body.event_id || '').trim();
    const subjectRef = String(body.subject_ref || '').trim();
    const status = String(body.status || '').trim().toUpperCase();
    if (eventId.length < 8 || eventId.length > 200) return jsonError('event_id is required', 400, 'EVENT_ID_INVALID');
    if (!/^[0-9a-f]{48}$/i.test(subjectRef)) return jsonError('subject_ref is invalid', 400, 'SUBJECT_REF_INVALID');
    if (!['VERIFIED', 'REVOKED', 'EXPIRED'].includes(status)) return jsonError('Unsupported verifier status', 400, 'VERIFIER_STATUS_INVALID');

    const eventAt = parseDate(body.occurred_at || new Date().toISOString(), 'occurred_at', true);
    const verifiedAt = status === 'VERIFIED' ? parseDate(body.verified_at || eventAt, 'verified_at', true) : '';
    const expiresAt = parseDate(body.expires_at, 'expires_at');
    if (status === 'VERIFIED') {
      if (String(body.age_band || '') !== '18_PLUS') return jsonError('Only an 18+ verifier result can issue the adult chain assertion', 400, 'VERIFIED_ADULT_REQUIRED');
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return jsonError('Verifier assertion is already expired', 400, 'VERIFIER_EXPIRY_PAST');
    }

    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const sessionRows = await svc.entities.AgeVerificationSession
      .filter({ subject_ref: subjectRef }, '-created_date', 5)
      .catch(() => []);
    const session = sessionRows?.[0];
    if (!session) return jsonError('Verifier subject is not recognised', 404, 'VERIFIER_SUBJECT_NOT_FOUND');

    // A newer verification attempt retires every older opaque subject reference.
    // Late provider events for an old session are acknowledged but cannot mutate
    // the user's current eligibility state.
    const latestRows = await svc.entities.AgeVerificationSession
      .filter({ user_id: session.user_id }, '-created_date', 1)
      .catch(() => []);
    if (latestRows?.[0] && String(latestRows[0].id) !== String(session.id)) {
      return Response.json({ ok: true, stale_ignored: true, event_id: eventId, reason: 'SUPERSEDED_SUBJECT' });
    }

    const lastEventAt = String(session.last_event_at || '').trim();
    const sameEvent = String(session.verifier_event_id || '') === eventId;
    if (sameEvent && String(session.status || '') !== status) {
      return jsonError('event_id was already used for a different verifier status', 409, 'VERIFIER_EVENT_ID_CONFLICT');
    }
    if (!sameEvent && lastEventAt && new Date(lastEventAt).getTime() > new Date(eventAt).getTime()) {
      return Response.json({ ok: true, stale_ignored: true, event_id: eventId });
    }
    if (sameEvent && ['SYNCED', 'NOT_APPLICABLE'].includes(String(session.chain_sync_status || ''))) {
      return Response.json({ ok: true, idempotent: true, event_id: eventId, chain_sync_status: session.chain_sync_status });
    }

    const ageRows = await svc.entities.AgeStatus.filter({ user_id: session.user_id }, '-updated_date', 5).catch(() => []);
    const age = ageRows?.[0];
    if (!age) return jsonError('AgeStatus is missing for verifier subject', 409, 'AGE_STATUS_MISSING');

    if (!sameEvent) {
      const nextRevision = Math.max(1, Number(age.revision || 0) + 1);
      if (status === 'VERIFIED') {
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
          wallet_eligible_at: age.wallet_eligible_at || verifiedAt,
          verified_at: verifiedAt,
          last_checked_at: eventAt,
          revision: nextRevision,
        });
        await svc.entities.AgeVerificationSession.update(session.id, {
          status: 'VERIFIED',
          verifier_event_id: eventId,
          verified_at: verifiedAt,
          expires_at: expiresAt,
          revoked_at: '',
          last_event_at: eventAt,
          chain_sync_status: 'PENDING',
          chain_tx_hash: '',
          last_error: '',
        });
      } else {
        // Fail closed FIRST. Even if the chain relay is unavailable below, every
        // Base44 value-bearing gate immediately sees the verifier as non-current.
        await svc.entities.AgeStatus.update(age.id, {
          verification_level: 'SELF_DECLARED',
          verifier_status: status,
          verifier_event_id: eventId,
          verifier_expires_at: status === 'EXPIRED' ? (expiresAt || eventAt) : (age.verifier_expires_at || ''),
          verifier_revoked_at: status === 'REVOKED' ? eventAt : (age.verifier_revoked_at || ''),
          value_features_eligible: false,
          proof_of_use_eligible: false,
          last_checked_at: eventAt,
          revision: nextRevision,
        });
        await svc.entities.AgeVerificationSession.update(session.id, {
          status,
          verifier_event_id: eventId,
          expires_at: status === 'EXPIRED' ? (expiresAt || eventAt) : (session.expires_at || ''),
          revoked_at: status === 'REVOKED' ? eventAt : (session.revoked_at || ''),
          last_event_at: eventAt,
          chain_sync_status: 'PENDING',
          chain_tx_hash: '',
          last_error: '',
        });
      }
    }

    const identity = await currentIdentity(svc, String(session.user_id || ''));
    if (!identity) {
      await svc.entities.AgeVerificationSession.update(session.id, {
        chain_sync_status: 'NOT_APPLICABLE',
        chain_tx_hash: '',
        last_error: '',
      });
      return Response.json({ ok: true, event_id: eventId, chain_sync_status: 'NOT_APPLICABLE', note: 'Private verifier state updated; no registered chain identity exists yet.' });
    }

    const identityId = normalizeHex(
      String(identity.status || '') === 'MERGED' ? identity.canonical_identity_id : identity.chain_identity_id,
      'canonical identity id',
    );
    const config = await getVerifiedConfig(svc);
    if (!config?.tx_relay_url) {
      await svc.entities.AgeVerificationSession.update(session.id, {
        chain_sync_status: 'FAILED',
        last_error: 'CHAIN_RELAY_NOT_CONFIGURED',
      }).catch(() => null);
      return jsonError('Private verifier state was accepted but the chain relay is not configured', 503, 'CHAIN_RELAY_NOT_CONFIGURED');
    }

    try {
      let result: any;
      if (status === 'VERIFIED') {
        const state = await privateEligibilityState(svc, String(session.user_id || ''));
        const verification = await buildPrivateEligibilityAttestation(identityId, state);
        if (!verification) throw new Error('VERIFICATION_COMMITMENT_NOT_AVAILABLE');
        result = await relayIdentityVerification('attest', { identity_id: identityId, verification });
        const txHash = result?.transaction_hash ? normalizeHex(result.transaction_hash, 'verification transaction hash') : '';
        await svc.entities.ChainIdentity.update(identity.id, {
          verification_tx_hash: txHash || identity.verification_tx_hash || '',
          failure_code: '',
        });
        await svc.entities.AgeVerificationSession.update(session.id, {
          chain_sync_status: 'SYNCED',
          chain_tx_hash: txHash,
          last_error: '',
        });
        return Response.json({ ok: true, event_id: eventId, chain_sync_status: 'SYNCED', transaction_hash: txHash, reconciliation_required: true });
      }

      result = await relayIdentityVerification('revoke', { identity_id: identityId });
      const txHash = result?.transaction_hash ? normalizeHex(result.transaction_hash, 'verification revoke transaction hash') : '';
      await svc.entities.ChainIdentity.update(identity.id, {
        verification_revoke_tx_hash: txHash || identity.verification_revoke_tx_hash || '',
        failure_code: '',
      });
      await svc.entities.AgeVerificationSession.update(session.id, {
        chain_sync_status: 'SYNCED',
        chain_tx_hash: txHash,
        last_error: '',
      });
      return Response.json({ ok: true, event_id: eventId, chain_sync_status: 'SYNCED', transaction_hash: txHash, reconciliation_required: true });
    } catch (chainError: any) {
      const code = safeCode(chainError);
      await svc.entities.AgeVerificationSession.update(session.id, {
        chain_sync_status: 'FAILED',
        last_error: code,
      }).catch(() => null);
      console.error('age-verifier-webhook chain sync failed', code);
      return jsonError('Private verifier state was accepted but chain sync failed; retry this same signed event', 502, code);
    }
  } catch (error: any) {
    const code = safeCode(error);
    console.error('age-verifier-webhook failed', code);
    const client = code.includes('REQUIRED') || code.includes('INVALID') || code.includes('NOT_ACCEPTED');
    return jsonError(client ? code.replaceAll('_', ' ') : 'Unable to process verifier event', client ? 400 : 500, code);
  }
}
