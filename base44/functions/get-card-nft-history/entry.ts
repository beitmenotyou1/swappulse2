import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Fetches the complete NFT history for a specific card (by TCGDex card ID):
// all minted OnChainAssets for that card, each with current ownership status,
// mint history, and transfer history (with physical verification flags).
// Public read — no auth required, so even users with crypto disabled can
// view the NFT version of a card.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { cardId } = body;
    if (!cardId) return Response.json({ error: 'cardId is required' }, { status: 400 });

    // Fetch all OnChainAssets for this card
    const assets = await base44.entities.OnChainAsset
      .filter({ asset_type: 'card', linked_card_id: cardId }, '-minted_at', 200)
      .catch(() => []);

    // Enrich each asset with ownership and transfer status
    const enriched = assets.map(asset => {
      const transfers = asset.transfer_history || [];
      const lastTransfer = transfers.length > 0 ? transfers[transfers.length - 1] : null;
      const hasPendingTransfer = lastTransfer && lastTransfer.verified === false;
      const verifiedTransfers = transfers.filter(t => t.verified === true);

      return {
        id: asset.id,
        tokenId: asset.token_id,
        contractAddress: asset.contract_address,
        ownerDid: asset.owner_did,
        ownerWallet: asset.owner_wallet,
        minterUsername: asset.minter_username || 'Unknown Collector',
        minterDid: asset.minter_did || asset.owner_did,
        mintTxHash: asset.mint_tx_hash,
        mintedAt: asset.minted_at,
        verificationLevel: asset.verification_level || 0,
        cardName: asset.linked_card_name,
        cardImage: asset.linked_card_image,
        transferCount: transfers.length,
        hasPendingTransfer,
        verifiedTransferCount: verifiedTransfers.length,
        transfers: transfers.map(t => ({
          toWallet: t.to_wallet,
          toDid: t.to_did,
          txHash: t.tx_hash,
          at: t.at,
          verified: t.verified === true,
          escrowTradeId: t.escrow_trade_id || null,
        })),
      };
    });

    // Summary stats
    const totalMints = enriched.length;
    const totalTransfers = enriched.reduce((sum, a) => sum + a.transferCount, 0);
    const pendingTransfers = enriched.filter(a => a.hasPendingTransfer).length;

    return Response.json({
      cardId,
      assets: enriched,
      totalMints,
      totalTransfers,
      pendingTransfers,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}