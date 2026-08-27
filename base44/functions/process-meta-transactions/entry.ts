import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { ethers } from 'npm:ethers@6.17.0';
import { resolveDeployedAddress } from '../../shared/contractRegistry.ts';
import { PULSE_GASLESS_RELAY_ABI } from '../../shared/pulseGaslessRelay.ts';

// Gas Station Service — processes queued gas-less meta-transactions every 5
// minutes (via the "Meta Transaction Processor" workflow). Branches on the
// MetaTransaction `chain` field:
//   - polygon: submits to the MetaTransactionRelay contract on Polygon
//     (existing behaviour), relayer = POLYGON_PRIVATE_KEY.
//   - pulse: submits to the PulseGaslessRelay contract on PulseChain, relayer
//     = PULSE_PRIVATE_KEY (the treasury). The treasury's PLS is auto-replenished
//     by the replenish-pulse-gas workflow swapping $PULSE fees via PulseX.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only for direct invocation; the scheduled workflow calls with the
    // BACKEND_FUNCTION_SECRET bearer token.
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      const secret = secrets.get('BACKEND_FUNCTION_SECRET');
      const authHeader = req.headers.get('authorization');
      if (!secret || authHeader !== `Bearer ${secret}`) {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    }

    const pending = await base44.asServiceRole.entities.MetaTransaction.filter(
      { status: 'pending' },
      '-created_date',
      20,
    );
    if (!pending || pending.length === 0) {
      return Response.json({ processed: 0, message: 'No pending meta-transactions' });
    }

    const polygonTxs = pending.filter((tx) => (tx.chain || 'polygon') === 'polygon');
    const pulseTxs = pending.filter((tx) => tx.chain === 'pulse');
    const results = [];

    // --- Polygon path (existing behaviour) ---
    if (polygonTxs.length) {
      const relayAddress = (await base44.asServiceRole.entities.ContractRegistry
        .filter({ contract_key: 'meta_relay' }).catch(() => []))[0]?.address || '';
      const rpcUrl = secrets.get('POLYGON_RPC_URL');
      const relayerKey = secrets.get('POLYGON_PRIVATE_KEY');
      if (!relayAddress || !rpcUrl || !relayerKey) {
        for (const tx of polygonTxs) {
          await base44.asServiceRole.entities.MetaTransaction.update(tx.id, { status: 'failed', error: 'Polygon relay/RPC/key not configured' });
          results.push({ id: tx.id, chain: 'polygon', success: false, error: 'not configured' });
        }
      } else {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const relayerSigner = new ethers.Wallet(relayerKey, provider);
        const relayAbi = ['function executeMetaTransaction(address userAddress, address target, bytes data, uint256 nonce, bytes signature) external payable returns (bytes)'];
        const relayContract = new ethers.Contract(relayAddress, relayAbi, relayerSigner);
        for (const tx of polygonTxs) {
          try {
            await base44.asServiceRole.entities.MetaTransaction.update(tx.id, { status: 'processing' });
            const data = tx.args?.data ? ethers.getBytes(tx.args.data) : '0x';
            const relayTx = await relayContract.executeMetaTransaction(
              tx.user_address, tx.target_contract, data, tx.nonce || 0, tx.signature || '0x',
              { value: ethers.parseEther('0.001') },
            );
            const receipt = await relayTx.wait();
            await base44.asServiceRole.entities.MetaTransaction.update(tx.id, {
              status: 'processed', tx_hash: receipt.hash,
              gas_cost_wei: receipt.gasUsed?.toString() || '0',
              processed_at: new Date().toISOString(),
            });
            results.push({ id: tx.id, chain: 'polygon', success: true, txHash: receipt.hash });
          } catch (err: any) {
            await base44.asServiceRole.entities.MetaTransaction.update(tx.id, { status: 'failed', error: err.message || 'Unknown' });
            results.push({ id: tx.id, chain: 'polygon', success: false, error: err.message });
          }
        }
      }
    }

    // --- PulseChain path (gasless relay) ---
    if (pulseTxs.length) {
      const relayAddress = await resolveDeployedAddress(base44.asServiceRole, 'pulse_meta_relay');
      const rpcUrl = secrets.get('PULSE_RPC_URL');
      const relayerKey = secrets.get('PULSE_PRIVATE_KEY');
      if (!relayAddress || !rpcUrl || !relayerKey) {
        const reason = !relayAddress ? 'PulseGaslessRelay not deployed (run deploy-pulse-relay)' : 'PulseChain RPC/relayer key not configured';
        for (const tx of pulseTxs) {
          await base44.asServiceRole.entities.MetaTransaction.update(tx.id, { status: 'failed', error: reason });
          results.push({ id: tx.id, chain: 'pulse', success: false, error: reason });
        }
      } else {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const relayerSigner = new ethers.Wallet(relayerKey, provider);
        const relayContract = new ethers.Contract(relayAddress, PULSE_GASLESS_RELAY_ABI, relayerSigner);
        for (const tx of pulseTxs) {
          try {
            await base44.asServiceRole.entities.MetaTransaction.update(tx.id, { status: 'processing' });
            const data = tx.args?.data ? ethers.getBytes(tx.args.data) : '0x';
            const relayTx = await relayContract.execute(
              tx.user_address, tx.target_contract, data, tx.nonce || 0, tx.signature || '0x',
            );
            const receipt = await relayTx.wait();
            await base44.asServiceRole.entities.MetaTransaction.update(tx.id, {
              status: 'processed', tx_hash: receipt.hash,
              gas_cost_wei: receipt.gasUsed?.toString() || '0',
              processed_at: new Date().toISOString(),
            });
            results.push({ id: tx.id, chain: 'pulse', success: true, txHash: receipt.hash });
          } catch (err: any) {
            await base44.asServiceRole.entities.MetaTransaction.update(tx.id, { status: 'failed', error: err.message || 'Unknown' });
            results.push({ id: tx.id, chain: 'pulse', success: false, error: err.message });
          }
        }
      }
    }

    return Response.json({
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}