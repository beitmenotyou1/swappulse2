// deploy-pulse-token — deploys the base SwapPulse $PULSE ERC-20 token on
// PulseChain. This is the underlying token that the OFTPulseToken (LayerZero
// OFT wrapper) wraps for cross-chain transfers, and the token used for
// usage-mining rewards, airdrops, and governance.
//
// Prerequisites:
//   1. PULSE_RPC_URL and PULSE_PRIVATE_KEY secrets set
//   2. Deployer wallet funded with native PLS for gas
//
// After deployment, save the returned address as the PULSE_TOKEN_CONTRACT
// secret so deploy-lz-pulse-token can wrap it.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { PULSE_TOKEN_ABI, PULSE_TOKEN_BYTECODE } from '../../shared/pulseTokenArtifacts.ts';
import { upsertContract } from '../../shared/contractRegistry.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const rpcUrl = secrets.get('PULSE_RPC_URL');
    const privateKey = secrets.get('PULSE_PRIVATE_KEY');
    const explorerUrl = secrets.get('PULSE_EXPLORER_URL') || '';

    if (!rpcUrl || !privateKey) {
      return Response.json(
        { error: 'PULSE_RPC_URL and PULSE_PRIVATE_KEY secrets must be set' },
        { status: 400 },
      );
    }
    if (!PULSE_TOKEN_BYTECODE || PULSE_TOKEN_BYTECODE === '0x') {
      return Response.json({ error: 'Contract bytecode is empty. Compile the PulseToken contract first.' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check deployer has gas
    const balance = await provider.getBalance(wallet.address);
    if (balance === 0n) {
      return Response.json(
        { error: `Deployer wallet has no PULSE for gas. Fund the wallet at ${wallet.address}` },
        { status: 400 },
      );
    }

    // Deploy PulseToken(admin, minter)
    // admin  = deployer (platform admin, holds the 15% reserve allocation)
    // minter = deployer (can be changed later via setMinter to a bridge/relayer)
    const factory = new ethers.ContractFactory(PULSE_TOKEN_ABI, PULSE_TOKEN_BYTECODE, wallet);
    const contract = await factory.deploy(wallet.address, wallet.address);
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    // Persist deployed address so it survives page refreshes.
    await upsertContract(base44, {
      chain: 'pulse',
      contract_key: 'pulse_token',
      contract_name: 'PulseToken',
      address,
      deployed_by: wallet.address,
      explorer_url: `${explorerUrl}/address/${address}`,
    });

    return Response.json({
      status: 'deployed',
      contract: 'PulseToken',
      address,
      chain: 'pulse',
      explorerUrl: `${explorerUrl}/address/${address}`,
      tokenomics: {
        totalSupply: '1,000,000,000 PULSE',
        miningAllocation: '400,000,000 (40%)',
        reserveAllocation: '150,000,000 (15%) — held by admin',
      },
      nextSteps: [
        'Save PULSE_TOKEN_CONTRACT=<address> as a Base44 secret (required by deploy-lz-pulse-token)',
        'Optionally call setMinter() to delegate minting to a bridge or relayer contract',
        'Deploy the OFT wrapper (deploy-lz-pulse-token) to enable cross-chain transfers',
      ],
    });
  } catch (error: any) {
    console.error('deploy-pulse-token error:', error?.message || error);
    return Response.json({ error: error?.message || 'Deployment failed' }, { status: 500 });
  }
}