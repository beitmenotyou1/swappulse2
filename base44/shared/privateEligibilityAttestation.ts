import { hash } from 'npm:starknet@10.0.2';
import { secrets } from 'base44:runtime';
import { AGE_POLICY_VERSION, deriveAgeEligibility, isAgeBand, type AgeBand } from './agePolicy.ts';

const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const COMMITMENT_DOMAIN = 'SWAPPULSE_PRIVATE_ELIGIBILITY_COMMITMENT_V1';

// Deliberately generic. Publishing a schema called "18_PLUS" would turn the
// schema identifier itself into age information. The private Base44 record
// determines why the policy passed; the chain sees only an opaque commitment
// to the approved private-eligibility claim set.
export const PRIVATE_ELIGIBILITY_SCHEMA = 'SWAPPULSE_PRIVATE_IDENTITY_ASSURANCE_V1';

export type PrivateEligibilityState = {
  eligible: boolean;
  age_band: AgeBand | '';
  method: 'SELF_DECLARED' | 'THIRD_PARTY_VERIFIED' | '';
  policy_version: string;
  revision: number;
  chain_attestable: boolean;
  row: any | null;
};

export type PrivateEligibilityAttestation = {
  verification_root: string;
  schema_hash: string;
  expires_at: number;
};

function feltFromDigest(bytes: Uint8Array): string {
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  let value = BigInt(`0x${hex}`) % STARK_FIELD_PRIME;
  if (value === 0n) value = 1n;
  return `0x${value.toString(16)}`;
}

export async function privateEligibilityState(svc: any, userId: string): Promise<PrivateEligibilityState> {
  const rows = await svc.entities.AgeStatus.filter({ user_id: userId }, '-updated_date', 5).catch(() => []);
  const row = rows?.[0] || null;
  if (!row || !isAgeBand(row.age_band)) {
    return {
      eligible: false,
      age_band: '',
      method: '',
      policy_version: AGE_POLICY_VERSION,
      revision: 0,
      chain_attestable: false,
      row: null,
    };
  }

  const ageBand = row.age_band as AgeBand;
  const method = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  const eligibility = deriveAgeEligibility(ageBand, method);
  return {
    eligible: eligibility.testnet_identity_eligible,
    age_band: ageBand,
    method,
    policy_version: String(row.policy_version || AGE_POLICY_VERSION),
    revision: Math.max(1, Number(row.revision || 1)),
    // Cairo's IdentityVerification means a verifier-backed claim. A user's
    // self-declaration may unlock the non-value-bearing testnet, but must never
    // be silently upgraded into an on-chain "verified" state.
    chain_attestable: eligibility.testnet_identity_eligible && method === 'THIRD_PARTY_VERIFIED',
    row,
  };
}

export async function buildPrivateEligibilityAttestation(
  identityId: string,
  state: PrivateEligibilityState,
): Promise<PrivateEligibilityAttestation | null> {
  if (!state.chain_attestable || !state.row) return null;

  const token = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '');
  if (token.length < 32) throw new Error('TX_RELAY_TOKEN_NOT_CONFIGURED');

  const verifiedAt = String(state.row.verified_at || '').trim();
  const claim = JSON.stringify({
    domain: COMMITMENT_DOMAIN,
    identity_id: identityId,
    policy_version: state.policy_version,
    age_band: state.age_band,
    method: state.method,
    revision: state.revision,
    verified_at: verifiedAt,
    testnet_identity_eligible: true,
  });

  // The relay token is never placed in the claim or returned. HMAC gives the
  // low-entropy private fields a secret blinding key, so the public commitment
  // cannot be dictionary-attacked like a plain hash of an age band could be.
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(claim)));
  const verificationRoot = feltFromDigest(digest);
  const schemaHash = `0x${BigInt(hash.getSelectorFromName(PRIVATE_ELIGIBILITY_SCHEMA)).toString(16)}`;

  return {
    verification_root: verificationRoot,
    schema_hash: schemaHash,
    // No arbitrary expiry is invented here. Once the real third-party verifier
    // is connected it should supply an evidence-specific expiry/revocation policy.
    expires_at: 0,
  };
}
