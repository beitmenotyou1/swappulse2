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
import { authorizeDeployment } from '../../shared/deploymentAuthority.ts';
import { OFT_PULSE_TOKEN_ABI, OFT_PULSE_TOKEN_BYTECODE } from '../../shared/oftPulseTokenArtifacts.ts';
import { upsertContract } from '../../shared/contractRegistry.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const chain = body.chain || 'pulse';

    if (!['pulse', 'polygon'].includes(chain)) {
      return Response.json({ error: 'Invalid chain (must be "pulse" or "polygon")' }, { status: 400 });
    }

    // PulseChain is NOT a LayerZero V2 supported chain. LayerZero V2 endpoints
    // are deployed on 150+ networks (Polygon, Ethereum, Arbitrum, Base, …) but
    // not on PulseChain — see https://docs.layerzero.network/v2/deployments/deployed-contracts.
    // The OFT wrapper therefore only makes sense on Polygon (and other LZ V2
    // chains). PulseChain ↔ Polygon asset bridging uses the custom
    // PolygonBridge / PulseChainBridge contracts for NFTs, not LayerZero.
    if (chain === 'pulse') {
      return Response.json({
        error: 'PulseChain is not a LayerZero V2 supported chain — there is no V2 endpoint to deploy the OFT against. Deploy the OFT on Polygon only (chain: "polygon") using the Polygon V2 endpoint 0x1a44076050125825900e736c501f859c50fE728c. PulseChain asset bridging uses the custom NFT bridge contracts instead. See https://docs.layerzero.network/v2/deployments/deployed-contracts',
      }, { status: 400 });
    }

    const auth = await authorizeDeployment(req, 'polygon');
    if (!auth.ok) return auth.response;
    const { base44, wallet, provider, explorerUrl } = auth.authority;

    const nativeTokenAddr = secrets.get('PULSE_TOKEN_CONTRACT');
    // LayerZero V2 endpoint address for the target chain. Passed in the request
    // body (endpoint) so no secret dependency. Find the address for your chain
    // at https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
    const endpointAddr = body.endpoint || '';

    if (!nativeTokenAddr) {
      return Response.json(
        { error: 'PULSE_TOKEN_CONTRACT secret not set. Deploy the PulseToken ERC-20 first.' },
        { status: 400 },
      );
    }
    if (!endpointAddr) {
      return Response.json(
        { error: 'LayerZero V2 endpoint address required. Pass it in the request body as { "endpoint": "0x..." }. Find the address for your chain at https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts' },
        { status: 400 },
      );
    }
    if (!OFT_PULSE_TOKEN_BYTECODE || OFT_PULSE_TOKEN_BYTECODE === '0x') {
      return Response.json({ error: 'Contract bytecode is empty. Compile the OFT contract first.' }, { status: 400 });
    }

    // Deploy OFTPulseToken(nativeToken, endpoint)
    const factory = new ethers.ContractFactory(OFT_PULSE_TOKEN_ABI, OFT_PULSE_TOKEN_BYTECODE, wallet);
    const contract = await factory.deploy(nativeTokenAddr, endpointAddr);
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    const secretName = chain === 'pulse' ? 'OFT_PULSE_TOKEN_CONTRACT' : 'OFT_POLYGON_TOKEN_CONTRACT';

    // Persist deployed address so it survives page refreshes.
    await upsertContract(base44, {
      chain,
      contract_key: chain === 'pulse' ? 'oft_pulse' : 'oft_polygon',
      contract_name: 'OFTPulseToken',
      address,
      deployed_by: wallet.address,
      explorer_url: `${explorerUrl || ''}/address/${address}`,
    });

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