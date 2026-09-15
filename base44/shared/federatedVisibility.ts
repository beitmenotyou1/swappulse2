// Local AppView visibility checks. These cannot make a public PDS record
// confidential: circle-scoped and wishlist-only content must stay off the PDS.
//
// FAIL-CLOSED: any error in membership resolution returns false (deny). This
// is the safe default — a misconfiguration or transient error hides content
// rather than leaking it. All denials are logged for audit.
//
// Usage in a read path (backend function):
//   const canSee = await canViewCircleContent(svc, circleAtUri, viewerDid);
//   if (!canSee) return Response.json({ error: 'Not authorized' }, { status: 403 });

import { getCircleAccess } from './circleAccess.ts';

// Accept immutable local IDs, or an explicitly pinned public AT reference.
// A DID-only caller must resolve to exactly one local account.
export async function canViewCircleContent(svc: any, reference: string, viewerDid: string): Promise<boolean> {
  if (!viewerDid || !reference) return false;
  try {
    const users = await svc.entities.User.filter({ did: viewerDid }, '-created_date', 2);
    if (users.length !== 1) return false;
    return (await getCircleAccess(svc, reference, users[0])).isMember;
  } catch {
    return false;
  }
}

// Check whether a viewer DID owns a wishlist record identified by its at:// URI.
// Wishlist records are private to their owner. Returns true only if the viewer
// is the owner.
export async function canViewWishlist(svc: any, wishlistAtUri: string, viewerDid: string): Promise<boolean> {
  if (!viewerDid) return false;
  if (!wishlistAtUri) return false;

  try {
    const wishlists = await svc.entities.Wishlist.filter({ at_uri: wishlistAtUri }, '-created_date', 1).catch(() => []);
    if (!wishlists || wishlists.length === 0) {
      console.warn('federatedVisibility: wishlist not found for at_uri', wishlistAtUri);
      return false;
    }
    const wishlist = wishlists[0];
    return wishlist.did === viewerDid;
  } catch (e) {
    console.error('federatedVisibility: canViewWishlist error', e?.message || e);
    return false; // fail closed
  }
}

// Check whether a viewer can see a circle-scoped trade listing. The listing
// must have visibility 'circle_scoped' and a circle_ref; the viewer must be a
// member of that circle.
export async function canViewCircleScopedListing(svc: any, listing: any, viewerDid: string): Promise<boolean> {
  if (!listing) return false;
  if (listing.visibility !== 'circle_scoped') return true; // public or wishlist_only, not circle-scoped
  if (!listing.circle_ref) return false; // scoped but no circle ref, fail closed
  if (!(await canViewCircleContent(svc, listing.circle_ref, viewerDid))) return false;
  // A client-injected listing must not appear in a Circle its author has not joined.
  try {
    const authors = await svc.entities.User.filter({ id: listing.created_by_id }, '-created_date', 2);
    if (authors.length !== 1 || authors[0].did !== listing.did) return false;
    return (await getCircleAccess(svc, listing.circle_ref, authors[0])).isMember;
  } catch {
    return false;
  }
}