// Auto-mint logic for the "first top-up" welcome NFTs. Mints the soulbound
// username NFT and a fixed platform "welcome" card NFT into the collector's
// active wallet. Called from stripe-webhook on the user's first successful
// top-up. Skips the username NFT if it has already been minted (manual mint
// or a re-run of the webhook). The card NFT is a fixed platform card that
// every collector receives on their first top-up.

import { getMintWallet, getUsernameContract, getCardContract, parseMintEvent, getExplorerUrl } from './polygonClient.ts';

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

  // --- Username NFT (soulbound) ---
  // Skip if already minted (manual mint or webhook re-run)
  const existingUsername = await svc.entities.OnChainAsset
    .filter({ owner_did: did, asset_type: 'username' }).catch(() => []);
  if (!existingUsername.length) {
    try {
      const mintWallet = getMintWallet();
      const contract = getUsernameContract(mintWallet);

      // Build the dynamic metadata URI (same as manual mint)
      const origin = reqUrl
        ? `${new URL(reqUrl).protocol}//${new URL(reqUrl).host}`
        : 'https://swappulse.org';
      const metadataURI = `${origin}/functions/username-nft-metadata?did=${encodeURIComponent(did)}`;

      const tx = await contract.mint(walletAddress, handle, did, metadataURI);
      const receipt = await tx.wait();
      const { tokenId } = parseMintEvent(contract, receipt);

      result.usernameAsset = await svc.entities.OnChainAsset.create({
        asset_type: 'username',
        token_id: tokenId,
        contract_address: await contract.getAddress(),
        owner_did: did,
        owner_wallet: walletAddress,
        handle,
        did_ref: did,
        mint_tx_hash: tx.hash,
        mint_block_number: receipt.blockNumber,
        minted_at: new Date().toISOString(),
        transferable: false,
        metadata_uri: metadataURI,
        chain_id: '137',
      });
      result.usernameTxHash = tx.hash;
    } catch (e) {
      console.error('autoMint: username NFT failed:', (e as any)?.message || e);
    }
  } else {
    result.skipped = true;
  }

  // --- Welcome card NFT (transferable) ---
  // Skip if the collector already has a welcome card
  const existingCard = await svc.entities.OnChainAsset
    .filter({ owner_did: did, asset_type: 'card', linked_card_id: WELCOME_CARD_ID }).catch(() => []);
  if (!existingCard.length) {
    try {
      const mintWallet = getMintWallet();
      const contract = getCardContract(mintWallet);

      const tx = await contract.mint(
        walletAddress,
        WELCOME_CARD_ID,
        WELCOME_CARD_NAME,
        WELCOME_CARD_IMAGE,
        WELCOME_CARD_METADATA_URI,
      );
      const receipt = await tx.wait();
      const { tokenId } = parseMintEvent(contract, receipt);

      result.cardAsset = await svc.entities.OnChainAsset.create({
        asset_type: 'card',
        token_id: tokenId,
        contract_address: await contract.getAddress(),
        owner_did: did,
        owner_wallet: walletAddress,
        linked_card_id: WELCOME_CARD_ID,
        linked_card_name: WELCOME_CARD_NAME,
        linked_card_image: WELCOME_CARD_IMAGE,
        minter_username: handle,
        minter_did: did,
        mint_tx_hash: tx.hash,
        mint_block_number: receipt.blockNumber,
        minted_at: new Date().toISOString(),
        transferable: true,
        metadata_uri: WELCOME_CARD_METADATA_URI,
        chain_id: '137',
        verification_level: 0,
      });
      result.cardTxHash = tx.hash;
    } catch (e) {
      console.error('autoMint: welcome card NFT failed:', (e as any)?.message || e);
    }
  }

  return result;
}