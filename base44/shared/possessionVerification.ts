// Shared possession-verification sync — after any verified CardVerificationSession
// is recorded for a user, mark their open TradeListings as possession_verified
// when every offered card has a verified attestation from that user.
// Sessions are always scoped by created_by_id (never did) to prevent
// cross-user leakage when a DID is empty.

export async function syncPossessionVerified(
  svc: any,
  userId: string,
  extraVerifiedCardId?: string,
): Promise<number> {
  const myListings = await svc.entities.TradeListing
    .filter({ created_by_id: userId, status: 'open' }, '-created_date', 100)
    .catch(() => []);
  if (!myListings?.length) return 0;

  const allSessions = await svc.entities.CardVerificationSession
    .filter({ created_by_id: userId, status: 'verified' }, '-created_date', 500)
    .catch(() => []);
  const verifiedCardIds = new Set<string>();
  for (const s of allSessions) {
    // A level-0 self-attestation is only a collector claim, and level 1 is a
    // partial visual match. Neither is strong enough to display the platform's
    // possession-verified badge. Require a level-2+ reviewed photo match.
    if (s.card_id && Number(s.verification_level || 0) >= 2) verifiedCardIds.add(s.card_id);
  }
  if (extraVerifiedCardId) {
    const extraVerified = allSessions.some(
      (s: any) => s.card_id === extraVerifiedCardId && Number(s.verification_level || 0) >= 2,
    );
    if (extraVerified) verifiedCardIds.add(extraVerifiedCardId);
  }

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
  return updatedCount;
}