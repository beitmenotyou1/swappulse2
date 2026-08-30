import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { AGE_POLICY_VERSION, deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function safeStatus(row: any) {
  if (!row) return null;
  const ageBand = String(row.age_band || '') as AgeBand;
  const ageMethod = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  const verifierStatus = ['PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED'].includes(String(row.verifier_status || ''))
    ? String(row.verifier_status)
    : 'NONE';
  const verifierExpiry = String(row.verifier_expires_at || '').trim();
  const verifierExpiryMs = verifierExpiry ? new Date(verifierExpiry).getTime() : 0;
  const verifierCurrent = ageMethod === 'THIRD_PARTY_VERIFIED'
    && verifierStatus === 'VERIFIED'
    && (!verifierExpiry || (Number.isFinite(verifierExpiryMs) && verifierExpiryMs > Date.now()));
  const eligibility = isAgeBand(ageBand)
    ? deriveAgeEligibility(ageBand, verifierCurrent ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED')
    : deriveAgeEligibility('13_15', 'SELF_DECLARED');

  return {
    age_band: ageBand,
    age_method: ageMethod,
    verification_level: verifierCurrent ? 'ADULT_VERIFIED' : 'SELF_DECLARED',
    verifier_status: verifierStatus,
    verifier_expires_at: verifierExpiry,
    verifier_revoked_at: row.verifier_revoked_at || '',
    policy_version: AGE_POLICY_VERSION,
    ...eligibility,
    wallet_eligible_at: row.wallet_eligible_at || '',
    declared_at: row.declared_at || row.created_date || '',
    verified_at: verifierCurrent ? (row.verified_at || '') : '',
    last_checked_at: row.last_checked_at || '',
    revision: Number(row.revision || 1),
  };
}

function policySummary() {
  return {
    stores_date_of_birth: false,
    bands: {
      '13_15': {
        collection: true,
        private_photo_verification: false,
        public_collection: false,
        testnet_identity: false,
        testnet_wallet: false,
      },
      '16_17': {
        collection: true,
        private_photo_verification: true,
        public_collection: false,
        testnet_identity: false,
        testnet_wallet: false,
      },
      '18_PLUS': {
        collection: true,
        private_photo_verification: true,
        public_collection: true,
        testnet_identity: true,
        testnet_wallet: true,
      },
    },
    note: 'Self-declared 18+ permits non-value-bearing SwapPulse Testnet identity/wallet features only. Value-bearing and Proof-of-Use features require a current private third-party adult assertion plus an ACTIVE reconciled on-chain attestation.',
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return jsonError('Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'get');
    const svc = base44.asServiceRole;
    const rows = await svc.entities.AgeStatus
      .filter({ user_id: me.id }, '-updated_date', 5)
      .catch(() => []);
    const current = rows?.[0] || null;

    if (action === 'get') {
      return Response.json({
        ok: true,
        status: safeStatus(current),
        declaration_required: !current,
        policy: policySummary(),
      });
    }

    if (action === 'declare') {
      if (body.confirm_age_band !== true) {
        return jsonError('Confirm the selected age band before saving', 400, 'AGE_CONFIRMATION_REQUIRED');
      }
      if (!isAgeBand(body.age_band)) {
        return jsonError('age_band must be 13_15, 16_17 or 18_PLUS', 400, 'INVALID_AGE_BAND');
      }
      if (current?.age_method === 'THIRD_PARTY_VERIFIED' && ['VERIFIED', 'PENDING'].includes(String(current?.verifier_status || ''))) {
        return jsonError('A current or pending verified adult status cannot be replaced by self-declaration', 409, 'VERIFIED_STATUS_PROTECTED');
      }

      const ageBand = body.age_band as AgeBand;
      const now = new Date().toISOString();
      const eligibility = deriveAgeEligibility(ageBand, 'SELF_DECLARED');
      const firstWalletEligibleAt = eligibility.testnet_wallet_eligible
        ? (current?.wallet_eligible_at || now)
        : (current?.wallet_eligible_at || '');
      const payload = {
        user_id: me.id,
        age_band: ageBand,
        age_method: 'SELF_DECLARED',
        verification_level: 'SELF_DECLARED',
        verifier_status: 'NONE',
        verifier_event_id: '',
        verifier_expires_at: '',
        verifier_revoked_at: '',
        policy_version: AGE_POLICY_VERSION,
        ...eligibility,
        wallet_eligible_at: firstWalletEligibleAt,
        declared_at: now,
        verified_at: '',
        last_checked_at: now,
        previous_age_band: current?.age_band && current.age_band !== ageBand ? current.age_band : (current?.previous_age_band || ''),
        revision: Number(current?.revision || 0) + 1,
      };

      let saved;
      if (current?.id) {
        await svc.entities.AgeStatus.update(current.id, payload);
        const refreshed = await svc.entities.AgeStatus.filter({ id: current.id }, '-updated_date', 1).catch(() => []);
        saved = refreshed?.[0] || { ...current, ...payload };
      } else {
        saved = await svc.entities.AgeStatus.create(payload);
      }

      return Response.json({
        ok: true,
        status: safeStatus(saved),
        policy: policySummary(),
      });
    }

    return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
  } catch (e: any) {
    console.error('age-status failed', e?.message || e);
    return Response.json({ error: 'Unable to manage age eligibility' }, { status: 500 });
  }
}
