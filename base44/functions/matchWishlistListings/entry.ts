// matchWishlistListings — scans active MarketListing entries against Wishlist
// records. When called by an admin (or the scheduled workflow as service role),
// it scans ALL wishlists and sends push + in-app notifications to matched users.
// When called by a regular user (via the Market Watch agent), it scans only
// that user's own wishlist and returns matches as data (no notifications).
// Dedup via NotificationLog ensures each listing triggers at most one alert per user.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { dispatchNotification } from '../../shared/notificationDispatcher.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const isAdmin = user.role === 'admin';

    // Fetch active market listings (newest first)
    const listings = await svc.entities.MarketListing.filter(
      { status: 'active' },
      '-created_date',
      200
    );

    // --- User mode: scan only their own wishlist, return matches as data ---
    if (!isAdmin) {
      const wishlists = await base44.entities.Wishlist.list('-created_date', 100);
      const byCardId = new Map<string, any[]>();
      for (const w of wishlists) {
        if (!w.card_id) continue;
        if (!byCardId.has(w.card_id)) byCardId.set(w.card_id, []);
        byCardId.get(w.card_id)!.push(w);
      }

      const matches: any[] = [];
      for (const listing of listings) {
        const ws = byCardId.get(listing.card_id);
        if (!ws?.length) continue;
        for (const w of ws) {
          // wishlist max_price is in pence; listing price is in major units
          if (w.max_price != null && listing.price != null) {
            if (listing.price * 100 > w.max_price) continue;
          }
          matches.push({
            listing_id: listing.id,
            card_name: listing.card_name,
            card_id: listing.card_id,
            price: listing.price,
            currency: listing.currency,
            condition: listing.condition,
            variant: listing.variant,
            seller_name: listing.seller_name,
            set_name: listing.set_name,
            max_price: w.max_price,
          });
        }
      }
      return Response.json({ matches: matches.length, notified: 0, results: matches });
    }

    // --- Admin mode: scan ALL wishlists and send notifications ---
    const wishlists = await svc.entities.Wishlist.list('-created_date', 500);
    const users = await svc.entities.User.list();
    const userById = new Map(users.map((u: any) => [u.id, u]));

    // Build card_id → [wishlists] map
    const byCardId = new Map<string, any[]>();
    for (const w of wishlists) {
      if (!w.card_id) continue;
      if (!byCardId.has(w.card_id)) byCardId.set(w.card_id, []);
      byCardId.get(w.card_id)!.push(w);
    }

    // Fetch recent notification logs for dedup (one batch)
    const recentLogs = await svc.entities.NotificationLog.filter(
      { notification_type: 'price_alert' },
      '-created_date',
      500
    ).catch(() => []);
    const notifiedKeys = new Set<string>();
    for (const log of recentLogs as any[]) {
      const did = log.did;
      const listingId = log.data?.listingId;
      if (did && listingId) notifiedKeys.add(`${did}:${listingId}`);
    }

    let notified = 0;
    const results: any[] = [];

    for (const listing of listings) {
      const ws = byCardId.get(listing.card_id);
      if (!ws?.length) continue;

      for (const w of ws) {
        // Price check
        if (w.max_price != null && listing.price != null) {
          if (listing.price * 100 > w.max_price) continue;
        }

        const owner = userById.get(w.created_by_id);
        if (!owner) continue;

        const did = (owner as any).did || 'did:plc:' + String(owner.id).replace(/-/g, '').slice(0, 24);
        const dedupKey = `${did}:${listing.id}`;
        if (notifiedKeys.has(dedupKey)) continue;
        notifiedKeys.add(dedupKey);

        const priceStr = `${listing.currency} ${Number(listing.price).toFixed(2)}`;
        const withinBudget = w.max_price != null ? ' — within your max budget' : '';

        // Send push notification via dispatcher
        try {
          await dispatchNotification(svc, {
            recipientDid: did,
            type: 'price_alert',
            title: 'Wishlist match found!',
            body: `${listing.card_name} is listed for ${priceStr}${withinBudget}`,
            params: { cardId: listing.card_id, listingId: listing.id },
            imageUrl: listing.card_image,
            priority: 'standard',
          });
        } catch (e) {
          console.error('matchWishlistListings: dispatch failed', e?.message || e);
        }

        // Create in-app Notification record
        try {
          await svc.entities.Notification.create({
            did,
            action_type: 'price_alert',
            actor_name: listing.seller_name || '',
            target_type: 'listing',
            target_path: '/market',
            target_label: `${listing.card_name} — ${priceStr}`,
            target_image: listing.card_image,
            is_read: false,
            metadata: { listing_id: listing.id, price: listing.price, currency: listing.currency },
          });
        } catch (e) {
          console.error('matchWishlistListings: notification create failed', e?.message || e);
        }

        notified++;
        results.push({ listing_id: listing.id, card_name: listing.card_name, user: owner.email });
      }
    }

    return Response.json({ matches: results.length, notified, results });
  } catch (error) {
    console.error('matchWishlistListings error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});