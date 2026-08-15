// SwapPulse AT Protocol-style data layer (SIMULATED)
//
// Mirrors the shape of the AT Protocol so records are ready to migrate to a
// real PDS at swappulse.org. NOT a federated implementation:
//   - DIDs are generated locally (not registered with a PLC directory)
//   - Signatures are HMAC-SHA256 with a per-user secret (not key-pair crypto)
//   - CIDs are SHA-256 digests (not IPLD multihash)
// Lexicon NSIDs follow the SwapPulse convention: org.swappulse.<recordName>.
// Each record carries: did, at_uri, cid, record_type, sig - the same fields a
// real AT Protocol record exposes. Swap to a real PDS + @atproto/api SDK and
// these become authoritative instead of simulated.

import { base44 } from '@/api/base44Client';

// Lexicon NSIDs per the SwapPulse lexicon spec (org.swappulse.*).
// Standard AT Protocol records are reused as-is so feed content interops
// with the wider network (a SwapPulse post is a standard bsky feed post).
export const NSID = {
  // Standard AT Protocol record we reuse for feed posts
  POST: 'app.bsky.feed.post',
  // Standard AT Protocol record we reuse for reposts
  REPOST: 'app.bsky.feed.repost',
  // Custom SwapPulse record lexicons
  COLLECTION_ENTRY: 'org.swappulse.collectionEntry',
  TRADE_LISTING: 'org.swappulse.tradeListing',
  TRADE_NEGOTIATION: 'org.swappulse.tradeNegotiation',
  TRADE_DISPUTE: 'org.swappulse.tradeDispute',
  PACK_OPENING: 'org.swappulse.packOpening',
  REPUTATION: 'org.swappulse.reputation',
  MODERATION_LABEL: 'org.swappulse.moderationLabel',
  // Alpha 1.1 record lexicons
  ACHIEVEMENT: 'org.swappulse.achievement',
  TRADING_FEEDBACK: 'org.swappulse.tradingFeedback',
  GRADING_SUBMISSION: 'org.swappulse.gradingSubmission',
  DOCUMENT: 'org.swappulse.document',
  TRADE_CHAIN: 'org.swappulse.tradeChain',
  SAVED_SEARCH: 'org.swappulse.savedSearch',
  NOMINATION: 'org.swappulse.nomination',
  CARD_REVIEW: 'org.swappulse.cardReview',
  CHALLENGE: 'org.swappulse.challenge',
  CHALLENGE_ENTRY: 'org.swappulse.challengeEntry',
  SCANNER_CORRECTION: 'org.swappulse.scannerCorrection',
  // Alpha 1.2 record lexicons
  BINDER: 'org.swappulse.binder',
  VOUCH: 'org.swappulse.vouch',
  REACTION: 'org.swappulse.reaction',
  SENTIMENT_POLL: 'org.swappulse.sentimentPoll',
  SENTIMENT_VOTE: 'org.swappulse.sentimentVote',
  CIRCLE: 'org.swappulse.circle',
  CIRCLE_EXIT: 'org.swappulse.circleExit',
  WISHLIST: 'org.swappulse.wishlist',
  JOURNAL: 'org.swappulse.journal',
  MEETUP: 'org.swappulse.meetup',
  MEETUP_RSVP: 'org.swappulse.meetupRsvp',
  // Alpha 1.3 record lexicons
  FOLLOW: 'app.bsky.graph.follow',
  FOLLOW_PREFERENCE: 'org.swappulse.followPreference',
  FRIENDSHIP: 'org.swappulse.friendship',
  STORY: 'org.swappulse.story',
  STORY_VIEW: 'org.swappulse.storyView',
  // Alpha 1.4 record lexicons - voice spaces & podcasts
  VOICE_SPACE: 'org.swappulse.voiceSpace',
  SPACE_PARTICIPANT: 'org.swappulse.spaceParticipant',
  PODCAST_EPISODE: 'org.swappulse.podcastEpisode',
  PODCAST_PLAY: 'org.swappulse.podcastPlay',
  EXTERNAL_ACTIVITY: 'org.swappulse.externalActivity',
  CROSS_POST_CONFIG: 'org.swappulse.crossPostConfig',
  // Alpha 1.5 record lexicons — AT Protocol-native social features
  CARD_MENTION: 'org.swappulse.cardMention',
  PACK_PARTY: 'org.swappulse.packParty',
  PULL_NOMINATION: 'org.swappulse.pullNomination',
  // Direct messaging
  CONVERSATION: 'org.swappulse.conversation',
  DIRECT_MESSAGE: 'org.swappulse.directMessage',
  // Custom feed generators (independent XRPC services users subscribe to)
  FEED: {
    FRESH_PULLS: 'org.swappulse.freshPulls',
    TRADE_FLOOR: 'org.swappulse.tradeFloor',
    MARKET_WATCH: 'org.swappulse.marketWatch',
    SHINY_HUNTERS: 'org.swappulse.shinyHunters',
    BUDGET_BUILDS: 'org.swappulse.budgetBuilds',
    SMART_BUNDLES: 'org.swappulse.smartBundles',
    CARD_OF_DAY: 'org.swappulse.cardOfDay',
    SPOILERS: 'org.swappulse.spoilers',
    LEADERBOARD: 'org.swappulse.leaderboard',
    SPACES: 'org.swappulse.spaces',
  },
  // Custom labeler (simulated Ozone)
  LABELER_DID: 'did:web:labeler.swappulse.org',
  LABELS: {
    PERSONA: ['shiny-hunter', 'set-completer', 'competitive-player', 'investment-collector', 'vintage-specialist', 'artist-collector', 'sealed-collector'],
    PRIVACY: ['collection-public', 'collection-showcase', 'value-hidden', 'collection-private'],
    CONTENT: ['grading-reference', 'spoiler', 'verified-pull'],
  },
  // Custom XRPC endpoints
  XRPC: {
    CATALOG_SEARCH: 'org.swappulse.catalog.search',
    PRICE_HISTORIC: 'org.swappulse.price.historic',
    TRADE_MATCH: 'org.swappulse.trade.match',
    REP_UPDATE: 'org.swappulse.rep.update',
  },
};

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
// base32-sortable alphabet per the TID spec (atproto.com/specs/tid)
const BASE32_SORTABLE = '234567abcdefghijklmnopqrstuvwxyz';
const PLC_PREFIX = 'did:plc:';

function randomBase32(len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += BASE32[bytes[i] % 32];
  return out;
}

export function generateDid() {
  return PLC_PREFIX + randomBase32(24);
}

export function generateSigningKey() {
  return 'sk_' + randomBase32(32);
}

// Per-session clock identifier (10 bits) — generated once to avoid collisions
// between concurrent TID generators, per the TID spec.
let _clockId = null;
let _lastTidMicros = 0n;

function getClockId() {
  if (_clockId === null) {
    _clockId = BigInt(crypto.getRandomValues(new Uint16Array(1))[0] & 0x3FF);
  }
  return _clockId;
}

// TID (Timestamp Identifier) record key per atproto.com/specs/tid:
//   - 64-bit integer, big-endian, base32-sortable encoded
//   - top bit always 0; next 53 bits = microseconds since UNIX epoch; low 10 bits = clock ID
//   - always 13 ASCII characters; first char ∈ [234567abcdefghij]
// Monotonic within a session (timestamp never decreases).
export function generateRkey() {
  let micros = BigInt(Date.now()) * 1000n;
  if (micros <= _lastTidMicros) micros = _lastTidMicros + 1n;
  _lastTidMicros = micros;
  const tid = (micros << 10n) | getClockId();
  let chars = '';
  for (let i = 0; i < 13; i++) {
    chars += BASE32_SORTABLE[Number((tid >> (5n * BigInt(12 - i))) & 0x1Fn)];
  }
  return chars;
}

// Validates a TID string per the spec regex.
const TID_RE = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;
export function isValidTid(tid) {
  return TID_RE.test(tid);
}

export function buildAtUri(did, nsid, rkey) {
  return `at://${did}/${nsid}/${rkey}`;
}

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  return Object.keys(obj).sort().reduce((acc, k) => {
    acc[k] = canonicalize(obj[k]);
    return acc;
  }, {});
}

export function stableStringify(obj) {
  return JSON.stringify(canonicalize(obj));
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Simulated CID - a real CID is an IPLD multihash; this is a SHA-256 digest
// formatted to read like one so records carry a content identifier.
export async function computeCid(record) {
  return 'bafy' + (await sha256Hex(stableStringify(record))).slice(0, 44);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

// Simulated signature: HMAC-SHA256 with the user's signing key. Production
// would use a key-pair signature (secp256k1) bound to the DID. The keyed
// hash demonstrates non-repudiation intent and is verifiable.
export async function signRecord(record, signingKey) {
  const key = await hmacKey(signingKey);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stableStringify(record)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifySignature(record, signature, signingKey) {
  return (await signRecord(record, signingKey)) === signature;
}

// Ensures the current user has a persistent DID + signing key on their
// account. If the user already has a DID (e.g. from linking a Bluesky
// account in Settings), returns it. Otherwise generates a simulated DID
// so the app remains functional until they link a real account.
export async function ensureUserDid() {
  const me = await base44.auth.me();
  if (me?.did && me?.signing_key) return { did: me.did, signingKey: me.signing_key };

  // Simulated DID — users link a real Bluesky account in Settings to get a
  // genuine did:plc. Until then, a local DID keeps the app functional.
  const did = me?.did || generateDid();
  const signingKey = generateSigningKey();
  await base44.auth.updateMe({ did, signing_key: signingKey });
  return { did, signingKey };
}

// Stamps a record with AT Protocol metadata before persistence.
// Adds: did, at_uri, cid, record_type, sig - ready for a real PDS.
export async function stampRecord(record, nsid, did, signingKey) {
  const base = { ...record };
  const rkey = generateRkey();
  const atUri = buildAtUri(did, nsid, rkey);
  const payload = { ...base, $type: nsid };
  const cid = await computeCid(payload);
  const sig = await signRecord({ ...payload, cid }, signingKey);
  return { ...base, did, at_uri: atUri, cid, record_type: nsid, sig };
}