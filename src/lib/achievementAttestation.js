// Builds a JSON-LD Verifiable Credential attestation for an achievement and
// triggers a download. The proof is a simulated tamper-evident SHA-256 binding
// over the canonical credential (SwapPulse simulates AT Protocol signing keys,
// matching the `sig` pattern used across the app's lexicon records).

const SWAPPULSE_ISSUER = 'did:web:swappulse.org';
const VERIFICATION_METHOD = 'did:web:swappulse.org#signing-key';

export async function buildAttestation(spec, achievement, holderDid) {
  const meta = achievement?.metadata || {};
  const credential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://swappulse.org/contexts/achievement/v1',
    ],
    type: ['VerifiableCredential', 'SwapPulseAchievement'],
    id: achievement?.at_uri || `at://swappulse/achievement/${achievement?.id || ''}`,
    issuer: SWAPPULSE_ISSUER,
    issuanceDate: achievement?.unlocked_at || new Date().toISOString(),
    credentialSubject: {
      id: holderDid || achievement?.did,
      achievement: spec.key,
      label: spec.label,
      pillar: spec.pillar,
      tier: spec.tier || null,
      metricValue: meta.metricValue ?? null,
      proofSummary: meta.proofSummary || '',
      proofUris: meta.proofUris || [],
    },
    credentialStatus: {
      type: 'StatusList2021',
      revoked: achievement?.status === 'revoked',
      revokedAt: achievement?.revoked_at || null,
    },
    proof: {
      type: 'SwapPulseHmac2026',
      created: new Date().toISOString(),
      verificationMethod: VERIFICATION_METHOD,
      proofValue: '',
    },
  };
  // Simulated signature: SHA-256 over the canonical credential with proofValue cleared.
  const canonical = JSON.stringify({
    ...credential,
    proof: { ...credential.proof, proofValue: '' },
  });
  credential.proof.proofValue = await sha256Base64(canonical);
  return credential;
}

async function sha256Base64(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function downloadAttestation(credential, filename) {
  const blob = new Blob([JSON.stringify(credential, null, 2)], {
    type: 'application/ld+json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'achievement.jsonld';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}