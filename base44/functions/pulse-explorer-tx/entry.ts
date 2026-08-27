// pulse-explorer-tx — returns full transaction detail. Tries the indexed
// PulseTransaction entity first; falls back to a live RPC eth_getTransactionByHash
// if not yet indexed. Fetches the receipt on every view for status, gas used,
// created contract, and token transfers (parsed from Transfer event logs).
// Caches parsed token transfers in PulseTokenTransfer and backfills the
// indexed tx with receipt data. Public read.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getTransactionByHash, getTransactionReceipt, getBlockByNumber,
  getTokenMetadata, decodeTransferLog,
} from '../../shared/pulseRpc.ts';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const hash = String(body?.hash || '').toLowerCase().trim();

    if (!/^0x[a-f0-9]{64}$/.test(hash)) {
      return Response.json({ error: 'Invalid transaction hash' }, { status: 400 });
    }

    // 1. Indexed tx, then live RPC fallback.
    let tx = (await svc.entities.PulseTransaction.filter({ tx_hash: hash }, '-block_number', 1).catch(() => []))[0];

    if (!tx) {
      const liveTx = await getTransactionByHash(hash).catch(() => null);
      if (!liveTx) return Response.json({ error: 'Transaction not found' }, { status: 404 });
      tx = {
        tx_hash: liveTx.hash,
        block_number: liveTx.blockNumber ? parseInt(liveTx.blockNumber, 16) : null,
        from_address: (liveTx.from || '').toLowerCase(),
        to_address: (liveTx.to || '').toLowerCase(),
        value_wei: liveTx.value ? BigInt(liveTx.value).toString() : '0',
        gas_price: liveTx.gasPrice ? BigInt(liveTx.gasPrice).toString()
          : (liveTx.maxFeePerGas ? BigInt(liveTx.maxFeePerGas).toString() : '0'),
        gas_limit: liveTx.gas ? BigInt(liveTx.gas).toString() : '0',
        gas_used: '0',
        nonce: liveTx.nonce ? parseInt(liveTx.nonce, 16) : 0,
        status: 'unknown',
        timestamp: null,
        input_data: liveTx.input || '',
        is_contract_creation: !liveTx.to,
        created_contract: '',
      };
    }

    // 2. Receipt for status, gas used, created contract, token transfers.
    let status = tx.status || 'unknown';
    let gasUsed = tx.gas_used || '0';
    let createdContract = tx.created_contract || '';
    const tokenTransfers: any[] = [];

    const receipt = await getTransactionReceipt(hash).catch(() => null);
    if (receipt) {
      status = receipt.status === '0x1' ? 'success' : 'failed';
      gasUsed = receipt.gasUsed ? BigInt(receipt.gasUsed).toString() : '0';
      if (receipt.contractAddress) createdContract = receipt.contractAddress.toLowerCase();

      // Parse Transfer-event logs.
      const transferLogs = (receipt.logs || []).filter(
        (l: any) => l.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC,
      );
      for (const log of transferLogs) {
        const decoded = decodeTransferLog(log);
        if (!decoded) continue;
        const logIndex = log.logIndex ? parseInt(log.logIndex, 16) : 0;

        const cached = (await svc.entities.PulseTokenTransfer.filter(
          { tx_hash: hash, log_index: logIndex }, '-log_index', 1,
        ).catch(() => []))[0];

        if (cached) {
          tokenTransfers.push(cached);
        } else {
          const meta = await getTokenMetadata(log.address.toLowerCase()).catch(() => ({ symbol: '???', decimals: 18 }));
          const record = {
            tx_hash: hash,
            log_index: logIndex,
            token_contract: log.address.toLowerCase(),
            from_address: decoded.from,
            to_address: decoded.to,
            value: decoded.value,
            token_symbol: meta.symbol,
            token_decimals: meta.decimals,
          };
          tokenTransfers.push(record);
          try { await svc.entities.PulseTokenTransfer.create(record); } catch { /* best-effort cache */ }
        }
      }

      // Backfill the indexed tx with receipt data.
      if (tx.id && (tx.status === 'unknown' || tx.gas_used === '0' || !tx.created_contract)) {
        try {
          await svc.entities.PulseTransaction.update(tx.id, {
            status, gas_used: gasUsed, created_contract: createdContract,
          });
        } catch { /* best-effort */ }
      }
    }

    // 3. Block timestamp if missing (live tx fallback path).
    let timestamp = tx.timestamp;
    if (!timestamp && tx.block_number) {
      try {
        const block = await getBlockByNumber(tx.block_number, false);
        if (block?.timestamp) {
          timestamp = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
        }
      } catch { /* leave null */ }
    }

    return Response.json({
      ...tx,
      status,
      gas_used: gasUsed,
      created_contract: createdContract,
      timestamp,
      token_transfers: tokenTransfers,
      wallet_url: '/wallet',
      explorer_url: `/pulse-explorer/tx/${hash}`,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}