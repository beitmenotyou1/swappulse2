import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { canViewCircleContent } from '../../shared/federatedVisibility.ts';

async function canViewListing(svc: any, listing: any, viewer: any, wishlistIds: Set<string>): Promise<boolean> {
  if (!listing) return false;
  const isOwner = !!viewer && (
    listing.created_by_id === viewer.id || (!!viewer.did && listing.did === viewer.did)
  );
  if (isOwner || viewer?.role === 'admin') return true;
  if (listing.visibility === 'public' || !listing.visibility) return true;
  if (!viewer?.did) return false;
  if (listing.visibility === 'circle_scoped') {
    return !!listing.circle_ref && canViewCircleContent(svc, listing.circle_ref, viewer.did);
  }
  if (listing.visibility === 'wishlist_only') {
    return (listing.offer_card_ids || []).some((id: string) => wishlistIds.has(id));
  }
  return false;
}

// Server-enforced trade visibility. Guests receive public listings only.
// `wishlist_only` means the listing offers at least one card on the viewer's
// private wishlist. `circle_scoped` requires confirmed local circle membership.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const viewer = await base44.auth.me().catch(() => null);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const listingId = String(body.listing_id || body.listingId || '').trim();
    const status = body.status ? String(body.status) : '';
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);

    const wishlist = viewer?.did
      ? await svc.entities.Wishlist.filter({ did: viewer.did }, '-created_date', 500).catch(() => [])
      : [];
    const wishlistIds = new Set<string>((wishlist || []).map((w: any) => w.card_id).filter(Boolean));

    if (listingId) {
      const listing = await svc.entities.TradeListing.get(listingId).catch(() => null);
      if (!listing) return Response.json({ error: 'Trade listing not found' }, { status: 404 });
      if (!(await canViewListing(svc, listing, viewer, wishlistIds))) {
        return Response.json({ error: 'Trade listing not available' }, { status: 403 });
      }
      return Response.json({ listing });
    }

    const query: any = status ? { status } : {};
    const rows = await svc.entities.TradeListing.filter(query, '-created_date', Math.min(limit * 4, 400)).catch(() => []);
    const now = Date.now();
    const visible: any[] = [];
    for (const row of rows || []) {
      if (row.expires_at && new Date(row.expires_at).getTime() < now) continue;
      if (await canViewListing(svc, row, viewer, wishlistIds)) visible.push(row);
      if (visible.length >= limit) break;
    }
    return Response.json({ listings: visible });
  } catch (error: any) {
    console.error('get-visible-trades error:', error?.message || error);
    return Response.json({ error: 'Could not load trade listings' }, { status: 500 });
  }
}
