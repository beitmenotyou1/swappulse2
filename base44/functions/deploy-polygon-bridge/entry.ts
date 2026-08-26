import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  POLYGON_BRIDGE_ABI,
  POLYGON_BRIDGE_BYTECODE,
} from '../../shared/pulseCompiledArtifacts.ts';

// Admin-only: deploys the PolygonBridge contract on Polygon. This contract
// locks Polygon NFTs when bridging to PulseChain (lockForBridge) and mints
// Polygon NFTs when bridging back from PulseChain (mintFromPulseChain).
//
// Uses the existing POLYGON_USERNAME_CONTRACT and POLYGON_CARD_CONTRACT as
// constructor arguments. Pre-compiled bytecode from pulseCompiledArtifacts.ts
// (no runtime solc — the Base44 backend runtime blocks WebAssembly).
//
// After deployment, save the returned address as POLYGON_BRIDGE_CONTRACT, then
// set POLYGON_BRIDGE_PEER to the PulseChainBridge address (from
// deploy-pulse-contracts) so the two bridges know each other.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const privateKey = secrets.get('POLYGON_PRIVATE_KEY');
    const rpcUrl = secrets.get('POLYGON_RPC_URL');
    const spunAddress = secrets.get('POLYGON_USERNAME_CONTRACT');
    const spcdAddress = secrets.get('POLYGON_CARD_CONTRACT');
    if (!privateKey || !rpcUrl) {
      return Response.json(
        { error: 'POLYGON_PRIVATE_KEY and POLYGON_RPC_URL secrets must be set first' },
        { status: 400 },
      );
    }
    if (!spunAddress || !spcdAddress) {
      return Response.json(
        { error: 'POLYGON_USERNAME_CONTRACT and POLYGON_CARD_CONTRACT secrets must be set first (run deploy-polygon-contracts)' },
        { status: 400 },
      );
    }

    // Guard against empty bytecode (compile script not yet run)
    if (!POLYGON_BRIDGE_BYTECODE) {
      return Response.json(
        { error: 'PolygonBridge bytecode is empty. Run scripts/compile-pulse.js locally first to populate pulseCompiledArtifacts.ts with compiled bytecode.' },
        { status: 400 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Sanity-check the deployer can pay for gas before sending transactions.
    const balance = await provider.getBalance(wallet.address);
    if (balance === 0n) {
      return Response.json(
        { error: 'Deployer wallet has no POL for gas. Fund it first.' },
        { status: 400 },
      );
    }

    // Deploy PolygonBridge(spun, spcd)
    const BridgeFactory = new ethers.ContractFactory(POLYGON_BRIDGE_ABI, POLYGON_BRIDGE_BYTECODE, wallet);
    const bridgeContract = await BridgeFactory.deploy(spunAddress, spcdAddress);
    await bridgeContract.waitForDeployment();
    const bridgeAddress = await bridgeContract.getAddress();

    return Response.json({
      status: 'deployed',
      contract: 'PolygonBridge',
      address: bridgeAddress,
      polygonExplorer: `${secrets.get('POLYGON_EXPLORER_URL') || 'https://polygonscan.com'}/address/${bridgeAddress}`,
      nextSteps: [
        'Save this address as the POLYGON_BRIDGE_CONTRACT secret',
        'Set POLYGON_BRIDGE_PEER to the PulseChainBridge address (from deploy-pulse-contracts)',
      ],
    });
  } catch (error: any) {
    console.error('deploy-polygon-bridge error:', error?.message || error);
    return Response.json({ error: error?.message || 'Deployment failed' }, { status: 500 });
  }
}