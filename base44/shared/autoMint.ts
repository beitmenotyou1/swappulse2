// Auto-mint logic for the "first top-up" welcome NFTs. Mints the soulbound
// username NFT and a fixed platform "welcome" card NFT into the collector's
// active wallet via the dual-mint engine (Polygon primary, bridged to
// PulseChain). Called from stripe-webhook on the user's first successful
// top-up. Skips the username NFT if it has already been minted (manual mint
// or a re-run of the webhook). The card NFT is a fixed platform card that
// every collector receives on their first top-up.

import { mintUsernameDual, mintCardDual } from './dualMintEngine.ts';

// The fixed welcome card details — every collector gets this card NFT on
// their first successful top-up.
export const WELCOME_CARD_ID = 'swappulse-welcome';
export const WELCOME_CARD_NAME = 'SwapPulse Welcome Card';
export const WELCOME_CARD_IMAGE = 'https://swappulse.org/welcome-card.png';
export const WELCOME_CARD_METADATA_URI = 'https://swappulse.org/card/swappulse-welcome';

export async function mintWelcomeNfts(
  svc: any,
  did: string,
  walletAddress: string,
  handle: string,
  reqUrl?: string,
): Promise<{ usernameAsset?: any; cardAsset?: any; usernameTxHash?: string; cardTxHash?: string; skipped: boolean }> {
  const result: any = { skipped: false };

  // --- Username NFT (dual-mint: Polygon primary, bridge to PulseChain) ---
  // Skip if already minted (manual mint or webhook re-run)
  const existingUsername = await svc.entities.OnChainAsset
    .filter({ owner_did: did, asset_type: 'username' }).catch(() => []);
  if (!existingUsername.length) {
    try {
      // Build the dynamic metadata URI (same as manual mint)
      const origin = reqUrl
        ? `${new URL(reqUrl).protocol}//${new URL(reqUrl).host}`
        : 'https://swappulse.org';
      const metadataURI = `${origin}/functions/username-nft-metadata?did=${encodeURIComponent(did)}`;

      // Welcome NFTs always mint on Polygon first (canonical security) then
      // bridge to PulseChain.
      const dualResult = await mintUsernameDual(svc, walletAddress, handle, did, metadataURI, {
        primaryChain: 'polygon',
        bridgeToSecondary: true,
      });

      result.usernameAsset = dualResult.polygonAsset || dualResult.pulseAsset;
      result.usernameTxHash = dualResult.polygonTxHash || dualResult.pulseTxHash;
    } catch (e) {
      console.error('autoMint: username NFT failed:', (e as any)?.message || e);
      // Non-blocking (same as previous implementation)
    }
  } else {
    result.skipped = true;
  }

  // --- Welcome card NFT (dual-mint: Polygon primary, bridge to PulseChain) ---
  // Skip if the collector already has a welcome card
  const existingCard = await svc.entities.OnChainAsset
    .filter({ owner_did: did, asset_type: 'card', linked_card_id: WELCOME_CARD_ID }).catch(() => []);
  if (!existingCard.length) {
    try {
      const dualResult = await mintCardDual(
        svc,
        walletAddress,
        WELCOME_CARD_ID,
        WELCOME_CARD_NAME,
        WELCOME_CARD_IMAGE,
        WELCOME_CARD_METADATA_URI,
        handle,
        0, // verification_level: self-attested
        did,
        {
          primaryChain: 'polygon',
          bridgeToSecondary: true,
        },
      );

      result.cardAsset = dualResult.polygonAsset || dualResult.pulseAsset;
      result.cardTxHash = dualResult.polygonTxHash || dualResult.pulseTxHash;
    } catch (e) {
      console.error('autoMint: welcome card NFT failed:', (e as any)?.message || e);
    }
  }

  return result;
}