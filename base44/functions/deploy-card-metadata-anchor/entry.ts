// deploy-card-metadata-anchor — deploys the CardMetadataAnchor contract to
// PulseChain. This contract stores on-chain hashes of TCGDex card metadata
// so trade fairness calculations can verify off-chain data integrity.
//
// Admin-only. After deployment, set the CARD_METADATA_ANCHOR_CONTRACT secret
// to the returned contract address so the anchor-card-metadata function can
// call it.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  CARD_METADATA_ANCHOR_ABI,
  CARD_METADATA_ANCHOR_BYTECODE,
} from '../../shared/cardMetadataAnchorArtifacts.ts';
import { getPulseMintWallet, getPulseExplorerUrl } from '../../shared/pulseClient.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const wallet = getPulseMintWallet();
    const balance = await wallet.provider.getBalance(wallet.address);
    if (balance === 0n) {
      return Response.json({
        error: 'Deployer wallet has no PULSE for gas. Fund the wallet at ' + wallet.address,
      }, { status: 400 });
    }

    // Deploy the contract
    const factory = new ethers.ContractFactory(
      CARD_METADATA_ANCHOR_ABI,
      CARD_METADATA_ANCHOR_BYTECODE,
      wallet,
    );

    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    const tx = contract.deploymentTransaction();
    const receipt = await tx?.wait();

    // Verify the admin was set correctly (should be the deployer)
    const admin = await contract.admin();

    return Response.json({
      success: true,
      contract_address: contractAddress,
      deployer: wallet.address,
      admin,
      tx_hash: tx?.hash,
      block_number: receipt?.blockNumber,
      explorer: `${getPulseExplorerUrl()}/address/${contractAddress}`,
      next_step: `Set the secret CARD_METADATA_ANCHOR_CONTRACT to ${contractAddress}`,
    });
  } catch (error: any) {
    console.error('[deploy-card-metadata-anchor] error', error?.message || error);
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}