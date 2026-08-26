import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * initiate-unbridge
 *
 * Called by the PortToPolygon modal. Verifies the user owns the OnChainAsset,
 * creates a BridgeQueue entry for the unbridge (burn on source chain, unlock
 * on target chain), and marks the asset bridge_status as pending.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { assetId } = body;

    if (!assetId) {
      return Response.json({ error: 'Asset ID required' }, { status: 400 });
    }

    // Find the OnChainAsset
    const asset = await base44.entities.OnChainAsset.get(assetId);
    if (!asset) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Verify ownership
    const userDid = user?.data?.did || user?.did;
    if (asset.owner_did !== userDid) {
      return Response.json({ error: 'Not the asset owner' }, { status: 403 });
    }

    // Must be dual-chained to unbridge
    if (!asset.dual_chain && asset.bridge_status === 'none') {
      return Response.json({ error: 'Asset is not bridged' }, { status: 400 });
    }

    const targetChain = asset.source_chain === 'polygon' ? 'pulse' : 'polygon';

    // Create a BridgeQueue entry for the relayer to process
    const bridgeQueue = await base44.asServiceRole.entities.BridgeQueue.create({
      asset_type: asset.asset_type,
      source_chain: asset.source_chain,
      target_chain: targetChain,
      source_tx_hash: asset.mint_tx_hash || asset.polygon_tx_hash || '',
      payload: {
        assetId: asset.id,
        cardId: asset.linked_card_id,
        cardName: asset.linked_card_name,
        cardImage: asset.linked_card_image,
        handle: asset.handle,
        did: asset.owner_did,
        ownerWallet: asset.owner_wallet,
        action: 'unbridge',
        originalTokenId: asset.token_id,
      },
      status: 'queued',
      retry_count: 0,
      max_retries: 5,
    });

    // Mark the asset as pending unbridge
    await base44.asServiceRole.entities.OnChainAsset.update(assetId, {
      bridge_status: 'pending',
    });

    return Response.json({
      success: true,
      bridgeQueueId: bridgeQueue.id,
      message: 'Unbridge initiated. The relayer will process this within 15-30 minutes.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}