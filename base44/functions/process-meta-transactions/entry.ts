import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { ethers } from 'npm:ethers@6.17.0';

/**
 * process-meta-transactions
 *
 * Gas Station Service — processes queued gas-less meta-transactions.
 * Called every 5 minutes by the "Meta Transaction Processor" workflow.
 *
 * For each pending MetaTransaction:
 * 1. Marks it as processing
 * 2. Submits the signed meta-tx to the MetaTransactionRelay contract on Polygon
 * 3. Updates the status to processed (with tx hash) or failed (with error)
 *
 * Requires secrets:
 * - POLYGON_RPC_URL (exists)
 * - POLYGON_PRIVATE_KEY (exists)
 * - META_RELAY_CONTRACT_ADDRESS (needs to be set after deploying MetaTransactionRelay.sol)
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Admin-only: prevent direct non-admin invocation
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      const secret = secrets.get('BACKEND_FUNCTION_SECRET');
      const authHeader = req.headers.get('authorization');
      if (!secret || authHeader !== `Bearer ${secret}`) {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
    }

    // Query pending meta-transactions (max 20 per run)
    const pending = await base44.asServiceRole.entities.MetaTransaction.filter(
      { status: 'pending' },
      '-created_date',
      20
    );

    if (!pending || pending.length === 0) {
      return Response.json({ processed: 0, message: 'No pending meta-transactions' });
    }

    // Check relay contract is configured
    const relayAddress = secrets.get('META_RELAY_CONTRACT_ADDRESS');
    if (!relayAddress) {
      return Response.json({
        error: 'META_RELAY_CONTRACT_ADDRESS not configured. Deploy MetaTransactionRelay.sol and set the address.',
        pending: pending.length,
      }, { status: 500 });
    }

    // Set up ethers provider and relayer signer
    const provider = new ethers.JsonRpcProvider(secrets.get('POLYGON_RPC_URL'));
    const relayerKey = secrets.get('POLYGON_PRIVATE_KEY');
    if (!relayerKey) {
      return Response.json({ error: 'POLYGON_PRIVATE_KEY not configured' }, { status: 500 });
    }
    const relayerSigner = new ethers.Wallet(relayerKey, provider);

    const relayAbi = [
      'function executeMetaTransaction(address userAddress, address target, bytes data, uint256 nonce, bytes signature) external payable returns (bytes)',
    ];
    const relayContract = new ethers.Contract(relayAddress, relayAbi, relayerSigner);

    const results = [];

    for (const tx of pending) {
      try {
        // Mark as processing
        await base44.asServiceRole.entities.MetaTransaction.update(tx.id, {
          status: 'processing',
        });

        // Decode the ABI-encoded function data from the args
        const data = tx.args?.data ? ethers.getBytes(tx.args.data) : '0x';

        // Submit to the relay contract
        const relayTx = await relayContract.executeMetaTransaction(
          tx.user_address,
          tx.target_contract,
          data,
          tx.nonce || 0,
          tx.signature || '0x',
          { value: ethers.parseEther('0.001') } // Relayer fee
        );

        const receipt = await relayTx.wait();

        // Update status to processed
        await base44.asServiceRole.entities.MetaTransaction.update(tx.id, {
          status: 'processed',
          tx_hash: receipt.hash,
          gas_cost_wei: receipt.gasUsed?.toString() || '0',
          processed_at: new Date().toISOString(),
        });

        results.push({ id: tx.id, success: true, txHash: receipt.hash });
      } catch (err) {
        // Update status to failed
        await base44.asServiceRole.entities.MetaTransaction.update(tx.id, {
          status: 'failed',
          error: err.message || 'Unknown error',
        });

        results.push({ id: tx.id, success: false, error: err.message });
      }
    }

    return Response.json({
      processed: results.length,
      succeeded: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}