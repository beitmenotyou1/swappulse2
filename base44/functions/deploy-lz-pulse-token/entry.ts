// deploy-lz-pulse-token — deploys the OFTPulseToken contract on a specified chain.
// Uses pre-compiled ABI/bytecode from oftPulseTokenArtifacts.ts.
//
// Prerequisites:
//   1. PULSE_TOKEN_CONTRACT (or POLYGON equivalent) secret set — the native $PULSE ERC-20
//   2. LAYERZERO_ENDPOINT_V2_ADDRESS secret set — the LayerZero V2 endpoint on the target chain
//   3. Deployer wallet funded with native gas tokens

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { OFT_PULSE_TOKEN_ABI, OFT_PULSE_TOKEN_BYTECODE } from '../../shared/oftPulseTokenArtifacts.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const chain = body.chain || 'pulse';

    if (!['pulse', 'polygon'].includes(chain)) {
      return Response.json({ error: 'Invalid chain (must be "pulse" or "polygon")' }, { status: 400 });
    }

    const rpcUrl = chain === 'pulse' ? secrets.get('PULSE_RPC_URL') : secrets.get('POLYGON_RPC_URL');
    const privateKey = chain === 'pulse' ? secrets.get('PULSE_PRIVATE_KEY') : secrets.get('POLYGON_PRIVATE_KEY');
    const explorerUrl = chain === 'pulse' ? secrets.get('PULSE_EXPLORER_URL') : secrets.get('POLYGON_EXPLORER_URL');
    const nativeTokenAddr = chain === 'pulse'
      ? secrets.get('PULSE_TOKEN_CONTRACT')
      : secrets.get('PULSE_TOKEN_CONTRACT'); // Same $PULSE token address on both chains (OFT wraps it)
    const endpointAddr = secrets.get('LAYERZERO_ENDPOINT_V2_ADDRESS');

    if (!rpcUrl || !privateKey) {
      return Response.json(
        { error: `${chain.toUpperCase()}_RPC_URL and ${chain.toUpperCase()}_PRIVATE_KEY secrets must be set` },
        { status: 400 },
      );
    }
    if (!nativeTokenAddr) {
      return Response.json(
        { error: 'PULSE_TOKEN_CONTRACT secret not set. Deploy the PulseToken ERC-20 first.' },
        { status: 400 },
      );
    }
    if (!endpointAddr) {
      return Response.json(
        { error: 'LAYERZERO_ENDPOINT_V2_ADDRESS secret not set. Get the endpoint address from https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts' },
        { status: 400 },
      );
    }
    if (!OFT_PULSE_TOKEN_BYTECODE || OFT_PULSE_TOKEN_BYTECODE === '0x') {
      return Response.json({ error: 'Contract bytecode is empty. Compile the OFT contract first.' }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Check deployer has gas
    const balance = await provider.getBalance(wallet.address);
    if (balance === 0n) {
      return Response.json(
        { error: `Deployer wallet has no native gas tokens on ${chain}. Fund it first.` },
        { status: 400 },
      );
    }

    // Deploy OFTPulseToken(nativeToken, endpoint)
    const factory = new ethers.ContractFactory(OFT_PULSE_TOKEN_ABI, OFT_PULSE_TOKEN_BYTECODE, wallet);
    const contract = await factory.deploy(nativeTokenAddr, endpointAddr);
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    const secretName = chain === 'pulse' ? 'OFT_PULSE_TOKEN_CONTRACT' : 'OFT_POLYGON_TOKEN_CONTRACT';

    return Response.json({
      status: 'deployed',
      contract: 'OFTPulseToken',
      address,
      chain,
      explorerUrl: `${explorerUrl || ''}/address/${address}`,
      dependencies: {
        nativeToken: nativeTokenAddr,
        layerzeroEndpoint: endpointAddr,
      },
      nextSteps: [
        `Save ${secretName}=${address} as a Base44 secret`,
        'Deploy the OFT on the other chain (call this function again with {"chain":"polygon"} or {"chain":"pulse"})',
        'Run configure-lz-peers to establish bidirectional peer links',
        'Test a small cross-chain transfer',
      ],
    });
  } catch (error: any) {
    console.error('deploy-lz-pulse-token error:', error?.message || error);
    return Response.json({ error: error?.message || 'Deployment failed' }, { status: 500 });
  }
}