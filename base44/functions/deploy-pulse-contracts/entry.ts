import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';
import {
  PULSE_USERNAME_ABI,
  PULSE_USERNAME_BYTECODE,
  PULSE_CARD_ABI,
  PULSE_CARD_BYTECODE,
  PULSE_BRIDGE_ABI,
  PULSE_BRIDGE_BYTECODE,
} from '../../shared/pulseCompiledArtifacts.ts';
import { upsertContract } from '../../shared/contractRegistry.ts';

// Admin-only: deploys the SwapPulseUsernameV2 (soulbound, sourceChain-aware),
// SwapPulseCardNFTV2 (transferable, verificationLevel + sourceChain), and
// PulseChainBridge contracts to PulseChain using the deployer wallet
// configured in secrets. Uses pre-compiled ABI/bytecode
// (pulseCompiledArtifacts.ts) so no Solidity compiler is loaded at runtime —
// the Base44 backend runtime blocks WebAssembly, which solc requires.
//
// After deployment, wire the bridge ↔ contract references and return the
// addresses to save as PULSE_SPUN_CONTRACT / PULSE_SPCD_CONTRACT /
// PULSE_BRIDGE_CONTRACT secrets.
//
// Prerequisites:
//   1. Run scripts/compile-pulse.js locally to populate pulseCompiledArtifacts.ts
//      with real bytecode (the file ships with empty bytecode).
//   2. Provision the PulseChain testnet (Polygon CDK validium) and set
//      PULSE_RPC_URL / PULSE_CHAIN_ID / PULSE_PRIVATE_KEY / PULSE_EXPLORER_URL.
//   3. Fund the mint wallet with $PULSE for gas.
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
        { error: 'PULSE_PRIVATE_KEY and PULSE_RPC_URL secrets must be set first' },
        { status: 400 },
      );
    }

    // Guard against empty bytecode (compile script not yet run)
    if (!PULSE_USERNAME_BYTECODE || !PULSE_CARD_BYTECODE || !PULSE_BRIDGE_BYTECODE) {
      return Response.json(
        { error: 'Contract bytecode is empty. Run scripts/compile-pulse.js locally first to populate pulseCompiledArtifacts.ts with compiled bytecode.' },
        { status: 400 },
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Sanity-check the deployer can pay for gas before sending transactions.
    const balance = await provider.getBalance(wallet.address);
    if (balance === 0n) {
      const explorer = secrets.get('PULSE_EXPLORER_URL') || '';
      return Response.json(
        { error: `Deployer wallet ${wallet.address} has no native PLS for gas. PulseToken (ERC-20) is NOT the same as native PLS — you need native PLS (the chain's gas coin) to deploy. Send PLS to this address first${explorer ? ` — ${explorer}/address/${wallet.address}` : ''}.` },
        { status: 400 },
      );
    }

    // 1. Deploy SwapPulseUsernameV2 (soulbound, sourceChain-aware)
    const UsernameFactory = new ethers.ContractFactory(PULSE_USERNAME_ABI, PULSE_USERNAME_BYTECODE, wallet);
    const usernameContract = await UsernameFactory.deploy();
    await usernameContract.waitForDeployment();
    const usernameAddress = await usernameContract.getAddress();

    // 2. Deploy SwapPulseCardNFTV2 (constructor takes the username address)
    const CardFactory = new ethers.ContractFactory(PULSE_CARD_ABI, PULSE_CARD_BYTECODE, wallet);
    const cardContract = await CardFactory.deploy(usernameAddress);
    await cardContract.waitForDeployment();
    const cardAddress = await cardContract.getAddress();

    // 3. Deploy PulseChainBridge
    const BridgeFactory = new ethers.ContractFactory(PULSE_BRIDGE_ABI, PULSE_BRIDGE_BYTECODE, wallet);
    const bridgeContract = await BridgeFactory.deploy();
    await bridgeContract.waitForDeployment();
    const bridgeAddress = await bridgeContract.getAddress();

    // 4. Wire up bridge ↔ contract references
    //    bridge.setContracts(spun, spcd)
    const bridge = new ethers.Contract(bridgeAddress, PULSE_BRIDGE_ABI, wallet);
    await (await bridge.setContracts(usernameAddress, cardAddress)).wait();

    //    SPUN.setBridgeContract(bridge)
    const spun = new ethers.Contract(usernameAddress, PULSE_USERNAME_ABI, wallet);
    await (await spun.setBridgeContract(bridgeAddress)).wait();

    //    SPCD.setBridgeContract(bridge)
    const spcd = new ethers.Contract(cardAddress, PULSE_CARD_ABI, wallet);
    await (await spcd.setBridgeContract(bridgeAddress)).wait();

    // Persist deployed addresses so they survive page refreshes.
    const pulseExplorer = secrets.get('PULSE_EXPLORER_URL') || '';
    await upsertContract(base44, {
      chain: 'pulse', contract_key: 'pulse_username', contract_name: 'SwapPulseUsernameV2',
      address: usernameAddress, deployed_by: wallet.address,
      explorer_url: `${pulseExplorer}/address/${usernameAddress}`,
    });
    await upsertContract(base44, {
      chain: 'pulse', contract_key: 'pulse_card', contract_name: 'SwapPulseCardNFTV2',
      address: cardAddress, deployed_by: wallet.address,
      explorer_url: `${pulseExplorer}/address/${cardAddress}`,
    });
    await upsertContract(base44, {
      chain: 'pulse', contract_key: 'pulse_bridge', contract_name: 'PulseChainBridge',
      address: bridgeAddress, deployed_by: wallet.address,
      explorer_url: `${pulseExplorer}/address/${bridgeAddress}`,
    });

    return Response.json({
      status: 'deployed',
      contracts: {
        SwapPulseUsernameV2: usernameAddress,
        SwapPulseCardNFTV2: cardAddress,
        PulseChainBridge: bridgeAddress,
      },
      chain: {
        rpcUrl,
        chainId: secrets.get('PULSE_CHAIN_ID') || '9999',
        explorerUrl: secrets.get('PULSE_EXPLORER_URL') || '',
      },
      nextSteps: [
        'Save these as secrets: PULSE_SPUN_CONTRACT, PULSE_SPCD_CONTRACT, PULSE_BRIDGE_CONTRACT',
        'Deploy PolygonBridge on Polygon via deploy-polygon-bridge',
        'Set POLYGON_BRIDGE_PEER to the PulseChainBridge address on the Polygon bridge',
      ],
    });
  } catch (error: any) {
    console.error('deploy-pulse-contracts error:', error?.message || error);
    return Response.json({ error: error?.message || 'Deployment failed' }, { status: 500 });
  }
}