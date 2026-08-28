// Central AT Protocol federation privacy policy.
//
// AT Protocol repositories are public. This module is the single source of
// truth for deciding whether a SwapPulse record is eligible to cross the PDS
// boundary. Application-layer labels such as "followers", "friends",
// "mentioned", "circle_scoped" or "private" are NOT confidentiality controls
// once data is written to an AT repository.

const NEVER_FEDERATE = new Set([
  'org.swappulse.collectionEntry',
  'org.swappulse.wishlist',
  'org.swappulse.conversation',
  'org.swappulse.directMessage',
  'org.swappulse.tradeChain',
  'org.swappulse.tradeDispute',
  'org.swappulse.feedSubscription',
  'org.swappulse.labelerSubscription',
  'org.swappulse.challengeEntry',
  'org.swappulse.meetupRsvp',
]);

export function isNeverFederated(collection: string): boolean {
  return NEVER_FEDERATE.has(collection);
}

function visibility(rec: any): string {
  return String(rec?.visibility ?? rec?.visibility_scope ?? rec?.visibilityScope ?? '').toLowerCase();
}

export function isPublicationEligible(collection: string, rec: any): boolean {
  if (NEVER_FEDERATE.has(collection)) return false;

  switch (collection) {
    case 'app.bsky.feed.post': {
      // Native Bluesky posts are public by definition. For locally-created
      // SwapPulse Post source records, only explicit public visibility may be
      // federated. PDS record bodies themselves do not contain this local field.
      const scope = String(rec?.visibility_scope ?? rec?.visibilityScope ?? '').toLowerCase();
      return !scope || scope === 'public';
    }
    case 'org.swappulse.binder':
    case 'org.swappulse.journal':
    case 'org.swappulse.circle':
    case 'org.swappulse.tradeListing':
    case 'org.swappulse.bookmarkBoard':
      return visibility(rec) === 'public';
    case 'org.swappulse.story':
      return String(rec?.audience || '').toLowerCase() === 'public';
    case 'org.swappulse.challenge':
      return String(rec?.scope || 'global').toLowerCase() === 'global';
    default:
      return true;
  }
}

export function shouldIngestFederatedRecord(collection: string, pdsValue: any): boolean {
  if (NEVER_FEDERATE.has(collection)) return false;

  // If another implementation writes a custom record that claims to be
  // non-public, do not import it into a local entity as though that privacy
  // label were meaningful. The repo is already public, but SwapPulse should
  // not amplify it.
  switch (collection) {
    case 'org.swappulse.binder':
    case 'org.swappulse.journal':
    case 'org.swappulse.circle':
    case 'org.swappulse.tradeListing':
    case 'org.swappulse.bookmarkBoard':
      return String(pdsValue?.visibility || 'public').toLowerCase() === 'public';
    case 'org.swappulse.story':
      return String(pdsValue?.audience || 'public').toLowerCase() === 'public';
    case 'org.swappulse.challenge':
      return String(pdsValue?.scope || 'global').toLowerCase() === 'global';
    default:
      return true;
  }
}

export const NEVER_FEDERATE_COLLECTIONS = Object.freeze([...NEVER_FEDERATE]);
