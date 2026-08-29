export const AGE_POLICY_VERSION = 'AGE_POLICY_V1';

export type AgeBand = '13_15' | '16_17' | '18_PLUS';
export type AgeMethod = 'SELF_DECLARED' | 'THIRD_PARTY_VERIFIED';

export function deriveAgeEligibility(ageBand: AgeBand, method: AgeMethod = 'SELF_DECLARED') {
  const adult = ageBand === '18_PLUS';
  const olderTeen = ageBand === '16_17';
  const stronglyVerifiedAdult = adult && method === 'THIRD_PARTY_VERIFIED';

  return {
    collection_eligible: true,
    private_photo_verification_eligible: olderTeen || adult,
    public_collection_eligible: adult,
    testnet_identity_eligible: adult,
    testnet_wallet_eligible: adult,
    value_features_eligible: stronglyVerifiedAdult,
    proof_of_use_eligible: stronglyVerifiedAdult,
  };
}

export function isAgeBand(value: unknown): value is AgeBand {
  return value === '13_15' || value === '16_17' || value === '18_PLUS';
}
