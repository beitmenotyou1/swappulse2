import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getMintWallet, getCardContract, getExplorerUrl, parseMintEvent } from '../../shared/polygonClient.ts';

// Mints a card from the collector's CollectionEntry as a transferable
// ERC-721 on Polygon for proof of ownership. The NFT metadata references
// the TCGDex card data. One NFT per collection entry; re-minting is blocked.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { collectionEntryId } = body;
    if (!collectionEntryId) return Response.json({ error: 'Missing collectionEntryId' }, { status: 400 });

    // Fetch the collection entry (user-scoped so RLS enforces ownership)
    const entries = await base44.entities.CollectionEntry.filter({ id: collectionEntryId });
    if (!entries.length) return Response.json({ error: 'Collection entry not found' }, { status: 404 });
    const entry = entries[0];

    const did = user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found' }, { status: 400 });

    // Check for an active wallet link
    const links = await base44.entities.WalletLink.filter({ did, active: true });
    if (!links.length) {
      return Response.json({ error: 'No linked Polygon wallet. Link a wallet in Settings first.' }, { status: 400 });
    }
    const walletAddress = links[0].wallet_address;

    // Check if this collection entry is already minted
    const existing = await base44.asServiceRole.entities.OnChainAsset.filter({
      linked_collection_entry_id: collectionEntryId,
    });
    if (existing.length) {
      return Response.json({ error: 'Card already minted as NFT', asset: existing[0] }, { status: 400 });
    }

    // Mint on-chain via the platform wallet
    const mintWallet = getMintWallet();
    const contract = getCardContract(mintWallet);
    const cardId = entry.card_id || '';
    const cardName = entry.card_name || '';
    const cardImage = entry.card_image || '';
    const metadataURI = `https://swappulse.org/card/${cardId}`;

    const tx = await contract.mint(walletAddress, cardId, cardName, cardImage, metadataURI);
    const receipt = await tx.wait();
    const { tokenId } = parseMintEvent(contract, receipt);

    // Record the asset
    const asset = await base44.asServiceRole.entities.OnChainAsset.create({
      asset_type: 'card',
      token_id: tokenId,
      contract_address: await contract.getAddress(),
      owner_did: did,
      owner_wallet: walletAddress,
      linked_card_id: cardId,
      linked_card_name: cardName,
      linked_card_image: cardImage,
      linked_collection_entry_id: collectionEntryId,
      mint_tx_hash: tx.hash,
      mint_block_number: receipt.blockNumber,
      minted_at: new Date().toISOString(),
      transferable: true,
      metadata_uri: metadataURI,
      chain_id: '137',
    });

    return Response.json({
      asset,
      txHash: tx.hash,
      explorerUrl: `${getExplorerUrl()}/tx/${tx.hash}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}