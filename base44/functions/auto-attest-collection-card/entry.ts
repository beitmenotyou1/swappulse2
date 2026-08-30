// auto-attest-collection-card — issues a self-attested (level 0) CardVerificationSession
// when a collector adds a card to their collection, confirming possession at the
// baseline trust level without requiring scan photos. Then updates the author's
// open TradeListings that include this card in their offer list to
// possession_verified = true so the trade board shows a verified badge.
//
// Photo-based AI verification (level 2) is a separate, higher-trust flow invoked
// from the On-Chain tab; this function only records the self-attested baseline.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const collectionEntryId = String(body.collection_entry_id || '').trim();
    const cardId = String(body.card_id || '').trim();
    const cardName = String(body.card_name || '').trim();

    if (!collectionEntryId || !cardId) {
      return Response.json({ error: 'collection_entry_id and card_id are required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;

    // Verify the collection entry belongs to the calling user.
    const entries = await svc.entities.CollectionEntry
      .filter({ id: collectionEntryId, created_by_id: me.id }, '-created_date', 1)
      .catch(() => []);
    if (!entries?.[0]) {
      return Response.json({ error: 'Collection entry not found' }, { status: 404 });
    }

    // Idempotency: skip if a verified session already exists for this entry.
    const existing = await svc.entities.CardVerificationSession
      .filter({ collection_entry_id: collectionEntryId, status: 'verified' }, '-created_date', 1)
      .catch(() => []);
    if (existing?.[0]) {
      return Response.json({ ok: true, attested: true, session_id: existing[0].id, duplicate: true });
    }

    // Create a self-attested verification session (level 0, no photos).
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const session = await svc.entities.CardVerificationSession.create({
      did: me.did || '',
      collection_entry_id: collectionEntryId,
      card_id: cardId,
      card_name: cardName,
      scan_image_urls: [],
      verification_level: 0,
      status: 'verified',
      expires_at: expiresAt,
    });

    // Update the author's open TradeListings that offer this card to possession_verified = true.
    // Only listings where ALL offered cards now have a verified attestation are marked.
    const myListings = await svc.entities.TradeListing
      .filter({ created_by_id: me.id, status: 'open' }, '-created_date', 100)
      .catch(() => []);

    // Gather all verified card IDs for this user in one pass.
    const allSessions = await svc.entities.CardVerificationSession
      .filter({ did: me.did || '', status: 'verified' }, '-created_date', 500)
      .catch(() => []);
    const verifiedCardIds = new Set<string>();
    for (const s of allSessions) {
      if (s.card_id) verifiedCardIds.add(s.card_id);
    }
    // Include the card we just attested.
    verifiedCardIds.add(cardId);

    let updatedCount = 0;
    for (const listing of myListings) {
      const offerIds = listing.offer_card_ids || [];
      if (offerIds.length === 0) continue;
      const allVerified = offerIds.every((id: string) => verifiedCardIds.has(id));
      if (allVerified && !listing.possession_verified) {
        try {
          await svc.entities.TradeListing.update(listing.id, { possession_verified: true });
          updatedCount++;
        } catch { /* best-effort */ }
      }
    }

    return Response.json({
      ok: true,
      attested: true,
      session_id: session.id,
      verification_level: 0,
      listings_verified: updatedCount,
    });
  } catch (error: any) {
    console.error('auto-attest-collection-card error:', error?.message || error);
    return Response.json({ error: error?.message || 'Attestation failed' }, { status: 500 });
  }
}