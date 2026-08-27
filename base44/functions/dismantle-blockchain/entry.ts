// dismantle-blockchain — admin-only endpoint that performs the complete
// blockchain/crypto/wallet infrastructure dismantle in two phases:
//
// Phase 1 (BURN): Iterate every OnChainAsset record and attempt to burn the
//   on-chain NFT. Burns require treasury gas (MATIC on Polygon, PLS on
//   PulseChain) AND a burn function accessible to the admin/bridge. If either
//   treasury is unfunded or the contract has no admin-burn path, the token is
//   marked "abandoned" (skipped) and the function continues. This phase MUST
//   complete before Phase 2 so we don't lose the token IDs needed to burn.
//
// Phase 2 (PURGE): Delete all records from every blockchain/crypto/wallet
//   entity in dependency order (children before parents). After all records
//   are confirmed gone, the caller deletes the entity schema files, backend
//   functions, shared modules, workflows, and frontend pages separately.
//
// Idempotent: re-running skips already-burned tokens and already-empty entities.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { ethers } from 'npm:ethers@6.13.4';
import { secrets } from 'base44:runtime';

// ERC-1155 burn ABI (used by SwapPulseCardNFTV2 — bridgeBurn is bridge-only,
// but the standard ERC-1155 burn(address from, uint256 id, uint256 amount)
// is available if the contract exposes it; we try both).
const ERC1155_BURN_ABI = [
  'function burn(address from, uint256 id, uint256 amount)',
  'function burn(address account, uint256 id, uint256 value)',
];

// ERC-721 burn ABI (used by SwapPulseUsername — bridgeBurn is bridge-only).
const ERC721_BURN_ABI = [
  'function burn(uint256 tokenId)',
  'function bridgeBurn(uint256 tokenId)',
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const svc = base44.asServiceRole;
    const report: any = {
      phase1_burn: { attempted: 0, burned: 0, abandoned: 0, skipped_no_gas: 0, details: [] },
      phase2_purge: {},
      summary: '',
    };

    // ──────────────────────────────────────────────────────────────
    // PHASE 1: BURN ON-CHAIN NFTs
    // ──────────────────────────────────────────────────────────────

    // Check treasury balances
    let polygonGasOk = false;
    let pulseGasOk = false;
    let polygonBalance = '0';
    let pulseBalance = '0';

    try {
      const polygonRpc = secrets.get('POLYGON_RPC_URL');
      const polygonKey = secrets.get('POLYGON_PRIVATE_KEY');
      if (polygonRpc && polygonKey) {
        const provider = new ethers.JsonRpcProvider(polygonRpc);
        const wallet = new ethers.Wallet(polygonKey, provider);
        const bal = await provider.getBalance(wallet.address);
        polygonBalance = ethers.formatEther(bal);
        polygonGasOk = bal > 0n;
      }
    } catch (e: any) {
      report.phase1_burn.details.push({ chain: 'polygon', error: `Balance check failed: ${e?.message}` });
    }

    try {
      const pulseRpc = secrets.get('PULSE_RPC_URL');
      const pulseKey = secrets.get('PULSE_PRIVATE_KEY');
      if (pulseRpc && pulseKey) {
        const provider = new ethers.JsonRpcProvider(pulseRpc);
        const wallet = new ethers.Wallet(pulseKey, provider);
        const bal = await provider.getBalance(wallet.address);
        pulseBalance = ethers.formatEther(bal);
        pulseGasOk = bal > 0n;
      }
    } catch (e: any) {
      report.phase1_burn.details.push({ chain: 'pulse', error: `Balance check failed: ${e?.message}` });
    }

    // List all OnChainAsset records
    const assets = await svc.entities.OnChainAsset.list('-created_date', 500);
    report.phase1_burn.attempted = assets.length;

    for (const asset of assets) {
      const chain = asset.source_chain === 'pulse' || asset.chain_id === '369' ? 'pulse' : 'polygon';
      const hasGas = chain === 'pulse' ? pulseGasOk : polygonGasOk;

      if (!hasGas) {
        report.phase1_burn.skipped_no_gas++;
        report.phase1_burn.details.push({
          asset_id: asset.id,
          chain,
          token_id: asset.token_id,
          contract: asset.contract_address,
          status: 'abandoned_no_gas',
          reason: `${chain === 'pulse' ? 'PulseChain' : 'Polygon'} treasury has 0 native gas — token left on-chain as abandoned`,
        });
        continue;
      }

      // Gas available — attempt burn
      try {
        const rpc = chain === 'pulse' ? secrets.get('PULSE_RPC_URL') : secrets.get('POLYGON_RPC_URL');
        const key = chain === 'pulse' ? secrets.get('PULSE_PRIVATE_KEY') : secrets.get('POLYGON_PRIVATE_KEY');
        const provider = new ethers.JsonRpcProvider(rpc!);
        const wallet = new ethers.Wallet(key!, provider);
        const contract = new ethers.Contract(asset.contract_address, asset.asset_type === 'card' ? ERC1155_BURN_ABI : ERC721_BURN_ABI, wallet);

        let tx;
        if (asset.asset_type === 'card') {
          // ERC-1155 burn
          tx = await contract.burn(asset.owner_wallet, asset.token_id, 1);
        } else {
          // ERC-721 burn — try burn(tokenId) first, then bridgeBurn
          try {
            tx = await contract.burn(asset.token_id);
          } catch {
            tx = await contract.bridgeBurn(asset.token_id);
          }
        }
        const receipt = await tx.wait();
        report.phase1_burn.burned++;
        report.phase1_burn.details.push({
          asset_id: asset.id,
          chain,
          token_id: asset.token_id,
          contract: asset.contract_address,
          status: 'burned',
          tx_hash: tx.hash,
          block: receipt.blockNumber,
        });
      } catch (e: any) {
        report.phase1_burn.abandoned++;
        report.phase1_burn.details.push({
          asset_id: asset.id,
          chain,
          token_id: asset.token_id,
          contract: asset.contract_address,
          status: 'burn_failed',
          error: e?.reason || e?.message || 'Unknown burn error',
        });
      }
    }

    // ──────────────────────────────────────────────────────────────
    // PHASE 2: PURGE ALL BLOCKCHAIN/CRYPTO/WALLET ENTITY RECORDS
    // ──────────────────────────────────────────────────────────────
    // Children first, then parents.

    const childEntities = [
      'PulseTokenTransfer',
      'BridgeQueue',
      'MetaTransaction',
      'CrossChainTransfer',
      'ExplorerBookmark',
      'SeedPhraseCode',
      'SendCode',
      'FeeLedger',
      'CryptoDonation',
    ];

    const parentEntities = [
      'PulseTransaction',
      'PulseBlock',
      'PulseIndexerCursor',
      'OnChainAsset',
      'ContractRegistry',
      'WalletLink',
      'WalletBalance',
      'FiatTopUp',
      'MultiChainWallet',
      'CustodialWallet',
      'CryptoTransfer',
      'PointsLedger',
      'BankAccount',
      'ReceiveAllowlist',
      'TokenBlocklist',
    ];

    let totalPurged = 0;

    for (const name of [...childEntities, ...parentEntities]) {
      try {
        const result = await svc.entities[name].deleteMany({});
        const deleted = result?.deleted_count ?? result?.count ?? 0;
        report.phase2_purge[name] = { deleted, ok: true };
        totalPurged += deleted;
      } catch (e: any) {
        report.phase2_purge[name] = { ok: false, error: e?.message || 'Unknown error' };
      }
    }

    report.summary = `Burn: ${report.phase1_burn.burned} burned, ${report.phase1_burn.skipped_no_gas} abandoned (no gas), ${report.phase1_burn.abandoned} burn-failed. Purge: ${totalPurged} records deleted across ${childEntities.length + parentEntities.length} entities.`;

    return Response.json(report);
  } catch (error: any) {
    console.error('dismantle-blockchain error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}