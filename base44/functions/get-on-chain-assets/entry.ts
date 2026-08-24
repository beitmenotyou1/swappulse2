import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Reads on-chain assets (minted NFTs) for a given DID, card ID, or wallet.
// Used by profile activity tabs, card detail badges, and collection views
// to surface on-chain ownership proof. Public read — no Polygon secrets needed.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { did, cardId, walletAddress, assetType } = body;

    const query: any = {};
    if (did) query.owner_did = did;
    if (cardId) query.linked_card_id = cardId;
    if (walletAddress) query.owner_wallet = walletAddress.toLowerCase();
    if (assetType) query.asset_type = assetType;

    const assets = await base44.entities.OnChainAsset.filter(query, '-minted_at', 100);
    return Response.json({ assets });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}