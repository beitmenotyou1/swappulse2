// Builds a W3C Verifiable Credential (v2) attestation for an achievement and
// triggers a download. The credential embeds the proof snapshot's integrity
// hash (stored on achievement.metadata.integrityHash at grant time), per-
// category subject fields, a CredentialStatusList2021 status block, and a
// simulated JWS proof (SwapPulse simulates AT Protocol signing keys — no real
// secp256k1 issuer key is provisioned, so the signature is a deterministic
// SHA-256 binding marked as simulated).

const SWAPPULSE_ISSUER = 'did:web:swappulse.org';
const VERIFICATION_METHOD = 'did:web:swappulse.org#main-key';
const ISSUER_NAME = 'SwapPulse Achievement Authority';
const ISSUER_DESC = 'Official achievement verification service for SwapPulse TCG platform';

function shortDid(did) {
  return (did || '').split(':').pop()?.slice(-8) || 'unknown';
}

function customSubjectFields(spec, achievement) {
  const meta = achievement?.metadata || {};
  const mv = meta.metricValue;
  const fields = {};
  switch (spec.proof_type) {
    case 'coverage':
      if (achievement?.related_uri) fields.setCompleted = achievement.related_uri;
      if (typeof mv === 'number') fields.completionPercent = mv;
      break;
    case 'filtered_collection':
      if (typeof mv === 'number') fields.uniqueHighTierCards = mv;
      break;
    case 'count':
      if (typeof mv === 'number') fields.completedTrades = mv;
      break;
    case 'content_creation':
      if (typeof mv === 'number') fields.reviewsSubmitted = mv;
      break;
    case 'weighted_vouches':
      if (typeof mv === 'number') fields.distinctVouches = mv;
      break;
    case 'record_existence':
      if (typeof mv === 'number') fields.completedChains = mv;
      if (spec.id === 'chain_weaver') fields.minParties = spec.proof_requirements?.minimum_parties ?? 3;
      break;
    case 'accepted_submissions':
      if (typeof mv === 'number') fields.correctionsSubmitted = mv;
      break;
    case 'quality_publication':
      if (typeof mv === 'number') fields.binderLikes = mv;
      break;
    case 'event_hosting':
      if (typeof mv === 'number') fields.qualifyingEvents = mv;
      break;
  }
  return fields;
}

export async function buildAttestation(spec, achievement, holderDid) {
  const meta = achievement?.metadata || {};
  const proofRecords = meta.proofRecords || [];
  const integrityHash = meta.integrityHash
    ? `sha256:${meta.integrityHash}`
    : `sha256:${await sha256Hex(JSON.stringify(proofRecords.map((r) => r.uri)))}`;
  const revoked = achievement?.status === 'revoked';

  const credential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://w3id.org/security/suites/jws-2020/v1',
      {
        SwapPulseAchievement: 'https://schema.swappulse.org/achievement/v1#',
        achievementId: 'SwapPulseAchievement:achievementId',
        achievementName: 'SwapPulseAchievement:achievementName',
        tier: 'SwapPulseAchievement:tier',
        earnedAt: 'SwapPulseAchievement:earnedAt',
        proofRecords: 'SwapPulseAchievement:proofRecords',
        integrityHash: 'SwapPulseAchievement:integrityHash',
        issuerDid: 'SwapPulseAchievement:issuerDid',
      },
    ],
    type: ['VerifiableCredential', 'SwapPulseAchievement'],
    id: `https://swappulse.org/credentials/achievement/${shortDid(holderDid || achievement?.did)}/${spec.id}`,
    issuer: { id: SWAPPULSE_ISSUER, name: ISSUER_NAME, description: ISSUER_DESC },
    issuanceDate: achievement?.unlocked_at || new Date().toISOString(),
    credentialSubject: {
      id: holderDid || achievement?.did,
      achievementId: spec.id,
      achievementName: spec.name,
      tier: spec.tier,
      earnedAt: achievement?.unlocked_at || new Date().toISOString(),
      ...customSubjectFields(spec, achievement),
      proofRecords: proofRecords.map((r) => r.uri),
      integrityHash,
      verificationMethod: 'Proof capture snapshot with cryptographic integrity verification',
    },
    status: {
      id: `https://swappulse.org/status/achievements/${spec.id}`,
      type: 'CredentialStatusList2021',
      purpose: 'revocation',
      statusPurpose: 'revocation',
      revoked,
      revokedAt: achievement?.revoked_at || null,
      pendingRevocationAt: achievement?.pending_revocation_at || null,
      statusListCredential: 'https://swappulse.org/status/achievements/list',
    },
    proof: null,
  };

  credential.proof = await signCredential(credential);
  return credential;
}

async function signCredential(credential) {
  const { proof: _omit, ...payload } = credential;
  const canonical = canonicalize(payload);
  const sig = await sha256Hex(`${canonical}|swappulse-achievement-issuer`);
  const headerB64 = btoa(JSON.stringify({ alg: 'ES256K', b64: false, crit: ['b64'] }));
  return {
    type: 'JwsSignature2020',
    created: new Date().toISOString(),
    verificationMethod: VERIFICATION_METHOD,
    proofPurpose: 'assertionMethod',
    jws: `${headerB64}..${sig}`,
    note: 'Simulated signature (SwapPulse simulates AT Protocol signing keys). Replace with a real secp256k1 JWS once an issuer key pair is provisioned.',
  };
}

function canonicalize(obj) {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => { acc[k] = sortKeys(value[k]); return acc; }, {});
  }
  return value;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function downloadAttestation(credential, filename) {
  const blob = new Blob([JSON.stringify(credential, null, 2)], { type: 'application/ld+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'achievement.jsonld';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}