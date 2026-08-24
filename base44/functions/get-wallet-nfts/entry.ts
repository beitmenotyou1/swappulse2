// get-wallet-nfts — fetches all OnChainAssets owned by the user's DID,
// enriched with card market prices from CardPricing. Received NFTs (those
// with non-empty transfer_history) are filtered against the user's
// ReceiveAllowlist — only NFTs received from allowlisted sender wallets
// are visible. Returns { nfts, totalValueUsd, currency }.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.data?.did || user.did;
    if (!did) return Response.json({ error: 'No DID found' }, { status: 400 });

    // Fetch all OnChainAssets owned by this user
    const assets = await base44.entities.OnChainAsset
      .filter({ owner_did: did }, '-minted_at', 200).catch(() => []);

    // Fetch user's ReceiveAllowlist for filtering received NFTs
    const allowlist = await base44.entities.ReceiveAllowlist
      .filter({ did }, '-added_at', 500).catch(() => []);
    const allowlistedAddresses = new Set(
      allowlist.map(a => (a.address || '').toLowerCase()).filter(Boolean)
    );

    // Fetch card prices for all card NFTs in one batch
    const cardIds = assets
      .filter(a => a.asset_type === 'card' && a.linked_card_id)
      .map(a => a.linked_card_id);
    const priceMap = new Map();
    if (cardIds.length) {
      const pricingResults = await Promise.all(
        cardIds.map(id =>
          base44.entities.CardPricing
            .filter({ card_id: id }, '-updated_date', 1).catch(() => [])
        )
      );
      cardIds.forEach((id, i) => {
        const pricing = pricingResults[i][0];
        if (pricing) {
          const avg = pricing.avg ?? pricing.avg30 ?? pricing.low ?? 0;
          priceMap.set(id, { avg, currency: pricing.unit || 'USD' });
        }
      });
    }

    // Build NFT list with prices, received status, and allowlist filtering
    const nfts = assets.map(asset => {
      const isReceived = !!(asset.transfer_history && asset.transfer_history.length > 0);
      const lastTransfer = isReceived
        ? asset.transfer_history[asset.transfer_history.length - 1]
        : null;

      // Determine sender: from_wallet of last transfer, or previous owner
      // (second-to-last transfer's to_wallet) for legacy entries without from_wallet
      let receivedFrom = null;
      if (isReceived) {
        receivedFrom = (lastTransfer as any)?.from_wallet ||
          (asset.transfer_history.length >= 2
            ? asset.transfer_history[asset.transfer_history.length - 2].to_wallet
            : null);
      }

      // For received NFTs, check if sender is in allowlist
      let allowlisted = true;
      if (isReceived && receivedFrom) {
        allowlisted = allowlistedAddresses.has(receivedFrom.toLowerCase());
      }

      const price = asset.asset_type === 'card' && asset.linked_card_id
        ? priceMap.get(asset.linked_card_id)
        : null;

      return {
        asset,
        marketPrice: price ? price.avg : 0,
        priceCurrency: price ? price.currency : 'USD',
        isReceived,
        receivedFrom,
        allowlisted,
      };
    });

    // Filter out received NFTs from non-allowlisted senders
    const visibleNfts = nfts.filter(n => !n.isReceived || n.allowlisted);

    // Calculate total (card NFTs only, in USD)
    const totalValueUsd = visibleNfts
      .filter(n => n.asset.asset_type === 'card')
      .reduce((sum, n) => sum + (n.marketPrice || 0), 0);

    return Response.json({
      nfts: visibleNfts,
      totalValueUsd,
      currency: 'USD',
    });
  } catch (error: any) {
    console.error('get-wallet-nfts error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}