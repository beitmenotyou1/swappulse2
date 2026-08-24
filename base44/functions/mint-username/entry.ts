import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getMintWallet, getUsernameContract, getExplorerUrl, parseMintEvent } from '../../shared/polygonClient.ts';

// Mints a collector's SwapPulse handle as a soulbound (non-transferable)
// ERC-721 on Polygon. The NFT embeds the handle and a reference to the
// collector's AT Protocol DID, serving as a permanent on-chain identity
// and crypto send/receive address. One per collector; re-minting is blocked.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const did = user.did;
    if (!did) return Response.json({ error: 'No AT Protocol DID found for your account' }, { status: 400 });

    // Check for an active wallet link
    const links = await base44.entities.WalletLink.filter({ did, active: true });
    if (!links.length) {
      return Response.json({ error: 'No linked Polygon wallet. Link a wallet in Settings first.' }, { status: 400 });
    }
    const walletAddress = links[0].wallet_address;

    // Check if already minted
    const existing = await base44.asServiceRole.entities.OnChainAsset.filter({
      owner_did: did,
      asset_type: 'username',
    });
    if (existing.length) {
      return Response.json({ error: 'Username already minted', asset: existing[0] }, { status: 400 });
    }

    // Mint on-chain via the platform wallet
    const mintWallet = getMintWallet();
    const contract = getUsernameContract(mintWallet);
    const handle = user.bsky_handle || user.username || '';
    const metadataURI = `https://swappulse.org/u/${handle}`;

    const tx = await contract.mint(walletAddress, handle, did, metadataURI);
    const receipt = await tx.wait();
    const { tokenId } = parseMintEvent(contract, receipt);

    // Record the asset
    const asset = await base44.asServiceRole.entities.OnChainAsset.create({
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

    return Response.json({
      asset,
      txHash: tx.hash,
      explorerUrl: `${getExplorerUrl()}/tx/${tx.hash}`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}