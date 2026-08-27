// multi-chain-tx — returns full transaction detail for any supported EVM chain.
// Fetches tx + receipt from the chain's RPC, parses token transfers, and
// fetches NFT metadata for ERC-721 transfers. Caches parsed token transfers
// in PulseTokenTransfer. Public read.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { createEvmRpc, decodeTransferLog } from '../../shared/evmRpc.ts';
import { getChain, getChainRpcUrl, getMainChain } from '../../shared/chainRegistry.ts';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const chainKey = body.chain || getMainChain().key;
    const hash = String(body?.hash || '').toLowerCase().trim();

    if (!/^0x[a-f0-9]{64}$/.test(hash)) {
      return Response.json({ error: 'Invalid transaction hash' }, { status: 400 });
    }

    const chain = getChain(chainKey);
    if (!chain) return Response.json({ error: `Unsupported chain: ${chainKey}` }, { status: 400 });
    const rpc = createEvmRpc(getChainRpcUrl(chainKey));

    // 1. Fetch transaction from RPC.
    const liveTx = await rpc.getTransactionByHash(hash).catch(() => null);
    if (!liveTx) return Response.json({ error: 'Transaction not found' }, { status: 404 });

    const blockNumber = liveTx.blockNumber ? parseInt(liveTx.blockNumber, 16) : null;

    const tx: any = {
      tx_hash: liveTx.hash,
      block_number: blockNumber,
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
      token_transfers: [],
    };

    // 2. Fetch block for timestamp.
    if (blockNumber != null) {
      const blocks = await rpc.getBlocksByNumberBatch([blockNumber], false).catch(() => [null]);
      if (blocks[0]?.timestamp) {
        tx.timestamp = new Date(parseInt(blocks[0].timestamp, 16) * 1000).toISOString();
      }
    }

    // 3. Receipt for status, gas used, created contract, token transfers.
    const receipt = await rpc.getTransactionReceipt(hash).catch(() => null);
    if (receipt) {
      tx.status = receipt.status === '0x1' ? 'success' : 'failed';
      tx.gas_used = receipt.gasUsed ? BigInt(receipt.gasUsed).toString() : '0';
      if (receipt.contractAddress) tx.created_contract = receipt.contractAddress.toLowerCase();

      const transferLogs = (receipt.logs || []).filter(
        (l: any) => l.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC,
      );
      for (const log of transferLogs) {
        const decoded = decodeTransferLog(log);
        if (!decoded) continue;
        const logIndex = log.logIndex ? parseInt(log.logIndex, 16) : 0;
        const contractAddr = (log.address || '').toLowerCase();

        const cached = (await svc.entities.PulseTokenTransfer.filter(
          { tx_hash: hash, log_index: logIndex }, '-log_index', 1,
        ).catch(() => []))[0];

        if (cached) {
          tx.token_transfers.push(cached);
        } else {
          let record: any;
          if (decoded.is_nft) {
            const nftMeta = await rpc.getNftMetadata(contractAddr, decoded.token_id!).catch(() => ({ name: '', image: '' }));
            record = {
              tx_hash: hash, log_index: logIndex, token_contract: contractAddr,
              from_address: decoded.from, to_address: decoded.to, value: decoded.value,
              token_symbol: 'NFT', token_decimals: 0, is_nft: true,
              token_id: decoded.token_id, nft_name: nftMeta.name, nft_image: nftMeta.image,
            };
          } else {
            const meta = await rpc.getTokenMetadata(contractAddr).catch(() => ({ symbol: '???', decimals: 18 }));
            record = {
              tx_hash: hash, log_index: logIndex, token_contract: contractAddr,
              from_address: decoded.from, to_address: decoded.to, value: decoded.value,
              token_symbol: meta.symbol, token_decimals: meta.decimals, is_nft: false,
              token_id: '', nft_name: '', nft_image: '',
            };
          }
          tx.token_transfers.push(record);
          try { await svc.entities.PulseTokenTransfer.create(record); } catch { /* best-effort */ }
        }
      }
    }

    return Response.json({
      ...tx,
      wallet_url: '/wallet',
      explorer_url: chain.explorerUrl ? `${chain.explorerUrl}/tx/${hash}` : `/blockchain/tx/${hash}`,
      chain: { key: chain.key, name: chain.name, symbol: chain.symbol, chainId: chain.chainId, isMain: chain.isMain || false },
    });
  } catch (error: any) {
    console.error('multi-chain-tx error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}