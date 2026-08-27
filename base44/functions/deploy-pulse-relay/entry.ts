import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import { PULSE_GASLESS_RELAY_ABI, PULSE_GASLESS_RELAY_BYTECODE } from '../../shared/pulseCompiledArtifacts.ts';
import { upsertContract } from '../../shared/contractRegistry.ts';

// Admin-only: deploys the PulseGaslessRelay contract to PulseChain — the
// gas-less meta-transaction relay. Users sign EIP-712 intents off-chain and
// the treasury relayer pays the native PLS gas to submit them on-chain.
//
// ── Security: who can deploy SwapPulse contracts ──────────────────────────
// 1. App layer: only Base44 admin-role users can invoke this function.
// 2. On-chain layer: the deployer signer is the designated treasury wallet
//    (PULSE_PRIVATE_KEY) — the same wallet that pays gas for every PulseChain
//    action. No other wallet can deploy SwapPulse contracts.
//
// ── Gasless deployment ────────────────────────────────────────────────────
// The treasury pays the deployment gas from its own PLS balance — the admin
// clicking "Deploy" never spends their personal gas. This mirrors every other
// deploy-* function in the app.
//
// Prerequisite: run `node scripts/compile-pulse.js` locally to populate
// PULSE_GASLESS_RELAY_BYTECODE (the artifacts file ships with empty bytecode
// because the Base44 backend runtime blocks WebAssembly/solc).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const privateKey = secrets.get('PULSE_PRIVATE_KEY');
    const rpcUrl = secrets.get('PULSE_RPC_URL');
    if (!privateKey || !rpcUrl) {
      return Response.json(
        { error: 'PULSE_PRIVATE_KEY and PULSE_RPC_URL secrets must be set' },
        { status: 400 },
      );
    }

    if (!PULSE_GASLESS_RELAY_BYTECODE) {
      return Response.json(
        { error: 'Relay bytecode is empty. Run scripts/compile-pulse.js locally first to populate PULSE_GASLESS_RELAY_BYTECODE.' },
        { status: 400 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // The treasury must hold native PLS to pay deployment gas.
    const balance = await provider.getBalance(wallet.address);
    if (balance === 0n) {
      const explorer = secrets.get('PULSE_EXPLORER_URL') || '';
      return Response.json(
        { error: `Treasury ${wallet.address} has no native PLS for deployment gas. Fund it first${explorer ? ` — ${explorer}/address/${wallet.address}` : ''}.` },
        { status: 400 },
      );
    }

    const Factory = new ethers.ContractFactory(PULSE_GASLESS_RELAY_ABI, PULSE_GASLESS_RELAY_BYTECODE, wallet);
    const relay = await Factory.deploy();
    await relay.waitForDeployment();
    const relayAddress = await relay.getAddress();

    const pulseExplorer = secrets.get('PULSE_EXPLORER_URL') || '';
    await upsertContract(base44, {
      chain: 'pulse',
      contract_key: 'pulse_meta_relay',
      contract_name: 'PulseGaslessRelay',
      address: relayAddress,
      deployed_by: wallet.address,
      explorer_url: `${pulseExplorer}/address/${relayAddress}`,
    });

    return Response.json({
      status: 'deployed',
      contract: { PulseGaslessRelay: relayAddress },
      deployed_by: wallet.address,
      note: 'Relay admin is the treasury wallet. Users approve the relay to spend $PULSE once (handled automatically by queue-pulse-gasless-transfer); after that all $PULSE transfers are gasless.',
    });
  } catch (error: any) {
    console.error('deploy-pulse-relay error:', error?.message || error);
    return Response.json({ error: error?.message || 'Deployment failed' }, { status: 500 });
  }
}