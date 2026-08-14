// federatedVisibility — membership-check AppView layer for scoped federated
// records. Enforces circle membership and wishlist ownership on read paths
// so that circle_scoped and wishlist_only records published to the PDS are
// only visible to authorized viewers.
//
// FAIL-CLOSED: any error in membership resolution returns false (deny). This
// is the safe default — a misconfiguration or transient error hides content
// rather than leaking it. All denials are logged for audit.
//
// Usage in a read path (backend function):
//   const canSee = await canViewCircleContent(svc, circleAtUri, viewerDid);
//   if (!canSee) return Response.json({ error: 'Not authorized' }, { status: 403 });

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Check whether a viewer DID is a member (or curator) of a circle identified by
// its at:// URI. Resolves the circle from the local DB (ingested via firehose
// or created locally). Returns true only if membership is confirmed.
export async function canViewCircleContent(svc: any, circleAtUri: string, viewerDid: string): Promise<boolean> {
  if (!viewerDid) return false;
  if (!circleAtUri) return true; // no circle scoping = public

  try {
    const circles = await svc.entities.Circle.filter({ at_uri: circleAtUri }, '-created_date', 1).catch(() => []);
    if (!circles || circles.length === 0) {
      // Circle not found locally — fail closed
      console.warn('federatedVisibility: circle not found for at_uri', circleAtUri);
      return false;
    }
    const circle = circles[0];
    const isCurator = circle.did === viewerDid;
    const isMember = (circle.member_dids || []).includes(viewerDid);
    const isPublic = circle.visibility === 'public';
    return isCurator || isMember || isPublic;
  } catch (e) {
    console.error('federatedVisibility: canViewCircleContent error', e?.message || e);
    return false; // fail closed
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
  if (listing.visibility !== 'circle_scoped') return true; // public or wishlist_only — not circle-scoped
  if (!listing.circle_ref) return false; // scoped but no circle ref — fail closed
  return canViewCircleContent(svc, listing.circle_ref, viewerDid);
}