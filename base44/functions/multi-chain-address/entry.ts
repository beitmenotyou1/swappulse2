// multi-chain-address — returns live balance, contract status, nonce,
// transaction history (from Transfer event logs + indexed PulseTransaction
// for PulseChain), ERC-20 token balances, and ERC-721 NFT holdings for an
// address on any supported EVM chain. Public read.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { createEvmRpc, decodeTransferLog } from '../../shared/evmRpc.ts';
import { getChain, getChainRpcUrl, getMainChain } from '../../shared/chainRegistry.ts';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MAX_LOG_BLOCKS = 5000;
const MAX_NFT_LOOKUPS = 12;
const MAX_TOKEN_LOOKUPS = 15;

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const chainKey = body.chain || getMainChain().key;
    const address = String(body?.address || '').toLowerCase().trim();
    const page = Math.max(1, parseInt(body?.page || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(body?.limit || '25', 10)), 100);

    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      return Response.json({ error: 'Invalid address' }, { status: 400 });
    }

    const chain = getChain(chainKey);
    if (!chain) return Response.json({ error: `Unsupported chain: ${chainKey}` }, { status: 400 });
    const rpc = createEvmRpc(getChainRpcUrl(chainKey));
    const addrPadded = '0x' + address.slice(2).padStart(64, '0');

    // 1. Live chain state in parallel.
    const [balanceWei, code, nonce, chainHead] = await Promise.all([
      rpc.getBalance(address).catch(() => 0n),
      rpc.getCode(address).catch(() => '0x'),
      rpc.getTransactionCount(address).catch(() => 0),
      rpc.getBlockNumber().catch(() => 0),
    ]);
    const isContract = !!(code && code !== '0x');

    // 2. Fetch Transfer event logs involving this address (recent block range).
    const fromBlock = Math.max(0, chainHead - MAX_LOG_BLOCKS);
    const [incomingLogs, outgoingLogs] = await Promise.all([
      rpc.rpcCall('eth_getLogs', [{
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: 'latest',
        topics: [TRANSFER_TOPIC, null, addrPadded],
      }]).catch(() => []),
      rpc.rpcCall('eth_getLogs', [{
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: 'latest',
        topics: [TRANSFER_TOPIC, addrPadded, null],
      }]).catch(() => []),
    ]);

    // 3. Merge, dedupe, and sort logs.
    const allLogs = [...(incomingLogs || []), ...(outgoingLogs || [])];
    const seen = new Set<string>();
    const uniqueLogs: any[] = [];
    for (const log of allLogs) {
      const key = `${log.transactionHash}-${log.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueLogs.push(log);
    }

    // 4. Build transaction history from logs + track token/NFT holdings.
    const txHistory: any[] = [];
    const erc20Contracts = new Set<string>();
    const nftHoldings = new Map<string, { contract: string; tokenId: string }>();

    for (const log of uniqueLogs) {
      const decoded = decodeTransferLog(log);
      if (!decoded) continue;
      const contractAddr = (log.address || '').toLowerCase();
      const blockNumber = log.blockNumber ? parseInt(log.blockNumber, 16) : 0;
      const isIncoming = decoded.to === address;

      if (decoded.is_nft) {
        const holdingKey = `${contractAddr}-${decoded.token_id}`;
        if (isIncoming) nftHoldings.set(holdingKey, { contract: contractAddr, tokenId: decoded.token_id! });
        else nftHoldings.delete(holdingKey);
      } else {
        erc20Contracts.add(contractAddr);
      }

      txHistory.push({
        tx_hash: log.transactionHash,
        block_number: blockNumber,
        from_address: decoded.from,
        to_address: decoded.to,
        value_wei: '0',
        is_nft: decoded.is_nft,
        token_contract: contractAddr,
        token_id: decoded.token_id,
        token_value: decoded.value,
        direction: isIncoming ? 'in' : 'out',
        timestamp: null,
        status: 'success',
      });
    }

    // 5. For PulseChain, merge indexed native PLS transactions.
    if (chain.isMain) {
      const base44 = createClientFromRequest(req);
      const svc = base44.asServiceRole;
      const indexedTxs = await svc.entities.PulseTransaction.filter(
        { $or: [{ from_address: address }, { to_address: address }] },
        '-block_number',
        limit * 2,
      ).catch(() => []);
      for (const tx of indexedTxs) {
        txHistory.push({
          tx_hash: tx.tx_hash,
          block_number: tx.block_number,
          from_address: tx.from_address,
          to_address: tx.to_address,
          value_wei: tx.value_wei,
          is_nft: false,
          token_contract: '',
          token_id: null,
          token_value: '0',
          direction: tx.from_address === address ? 'out' : 'in',
          timestamp: tx.timestamp,
          status: tx.status,
        });
      }
    }

    // Sort + dedupe by tx_hash.
    txHistory.sort((a, b) => b.block_number - a.block_number);
    const txSeen = new Set<string>();
    const dedupedHistory: any[] = [];
    for (const tx of txHistory) {
      if (txSeen.has(tx.tx_hash)) continue;
      txSeen.add(tx.tx_hash);
      dedupedHistory.push(tx);
    }

    const total = dedupedHistory.length;
    const skip = (page - 1) * limit;
    const paged = dedupedHistory.slice(skip, skip + limit);

    // 6. Fetch ERC-20 token balances.
    const tokenBalances: any[] = [];
    const erc20List = Array.from(erc20Contracts).slice(0, MAX_TOKEN_LOOKUPS);
    for (const contractAddr of erc20List) {
      const meta = await rpc.getTokenMetadata(contractAddr).catch(() => ({ symbol: '???', decimals: 18 }));
      const balanceHex = await rpc.rpcCall('eth_call', [
        { to: contractAddr, data: '0x70a08231' + addrPadded.slice(2) }, 'latest',
      ]).catch(() => '0x0');
      const balance = BigInt(balanceHex || '0x0').toString();
      if (balance !== '0') {
        tokenBalances.push({ contract: contractAddr, symbol: meta.symbol, decimals: meta.decimals, balance });
      }
    }

    // 7. Fetch NFT holdings with metadata (verify current ownership).
    const nfts: any[] = [];
    const nftList = Array.from(nftHoldings.values()).slice(0, MAX_NFT_LOOKUPS);
    for (const nft of nftList) {
      const ownerHex = await rpc.rpcCall('eth_call', [
        { to: nft.contract, data: '0x6352211e' + BigInt(nft.tokenId).toString(16).padStart(64, '0') }, 'latest',
      ]).catch(() => '0x');
      const owner = ownerHex && ownerHex !== '0x' ? '0x' + ownerHex.slice(26).toLowerCase() : '';
      if (owner !== address) continue;
      const meta = await rpc.getNftMetadata(nft.contract, nft.tokenId).catch(() => ({ name: '', image: '' }));
      nfts.push({ contract: nft.contract, token_id: nft.tokenId, name: meta.name, image: meta.image });
    }

    return Response.json({
      chain: { key: chain.key, name: chain.name, symbol: chain.symbol, chainId: chain.chainId, isMain: chain.isMain || false },
      address,
      balance_wei: balanceWei.toString(),
      is_contract: isContract,
      nonce,
      transactions: paged,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
      token_balances: tokenBalances,
      nfts,
    });
  } catch (error: any) {
    console.error('multi-chain-address error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}