import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const NETWORK = 'SWAPPULSE_TESTNET';
const CANONICAL_RPC = 'https://rpc.swappulse.org/rpc';
const RPC_TIMEOUT_MS = 10_000;
const LATEST_BLOCK_LIMIT = 6;

class RpcError extends Error {
  code: number | string;
  constructor(message: string, code: number | string = 'RPC_ERROR') {
    super(message);
    this.code = code;
  }
}

function jsonError(code: string, status: number): Response {
  return Response.json({ ok: false, error_code: code }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function normalizeHex(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw) || raw.length > 68) throw new Error('INVALID_HEX');
  return `0x${BigInt(raw).toString(16)}`;
}

function parseBlockId(value: unknown): { block_number: number } | { block_hash: string } {
  const raw = String(value ?? '').trim();
  if (/^\d+$/.test(raw)) {
    const blockNumber = Number(raw);
    if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) throw new Error('INVALID_BLOCK_ID');
    return { block_number: blockNumber };
  }
  return { block_hash: normalizeHex(raw) };
}

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(CANONICAL_RPC, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new RpcError(`HTTP_${response.status}`, response.status);
    const payload = await response.json();
    if (payload?.error) {
      throw new RpcError(String(payload.error?.message || 'RPC_ERROR'), payload.error?.code ?? 'RPC_ERROR');
    }
    return payload?.result;
  } finally {
    clearTimeout(timer);
  }
}

async function loadPublicNetworkConfig(req: Request) {
  const base44 = createClientFromRequest(req);
  const rows = await base44.asServiceRole.entities.ChainNetworkConfig
    .filter({ network: NETWORK }, '-updated_date', 1)
    .catch(() => []);
  const config = rows?.[0] || null;

  // Before Verify & Activate there may be no verified_rpc_url yet. The public
  // explorer is still safe to use because its transport is pinned to the one
  // canonical public read-only endpoint and never accepts a URL from callers.
  const configuredRpc = String(config?.verified_rpc_url || config?.rpc_url || '').trim();
  if (configuredRpc) {
    try {
      const url = new URL(configuredRpc);
      const canonical = new URL(CANONICAL_RPC);
      if (url.protocol !== canonical.protocol || url.hostname !== canonical.hostname || url.pathname !== canonical.pathname) {
        throw new Error('RPC_MISMATCH');
      }
    } catch {
      throw new Error('RPC_MISMATCH');
    }
  }

  return {
    network: NETWORK,
    chain_id: String(config?.verified_chain_id || config?.chain_id || ''),
    explorer_url: String(config?.explorer_url || 'https://swappulse.org/chain/'),
  };
}

function compactBlock(block: any) {
  const txs = Array.isArray(block?.transactions) ? block.transactions : [];
  return {
    block_number: block?.block_number ?? null,
    block_hash: block?.block_hash || '',
    parent_hash: block?.parent_hash || '',
    timestamp: block?.timestamp ?? null,
    status: block?.status || '',
    sequencer_address: block?.sequencer_address || '',
    transaction_count: txs.length,
  };
}

async function getTransaction(hashValue: unknown) {
  const txHash = normalizeHex(hashValue);
  const [transaction, receipt] = await Promise.all([
    rpcCall('starknet_getTransactionByHash', [txHash, []]),
    rpcCall('starknet_getTransactionReceipt', [txHash]),
  ]);
  return { transaction, receipt };
}

async function getBlock(idValue: unknown) {
  const blockId = parseBlockId(idValue);
  const block = await rpcCall('starknet_getBlockWithTxHashes', [blockId]);
  return block;
}

function addIndexedActivity(
  items: Array<{ hash: string; category: string; action: string; sort_key: string }>,
  seen: Set<string>,
  category: string,
  action: string,
  hashValue: unknown,
  sortKey: unknown,
) {
  const raw = String(hashValue || '').trim();
  if (!raw) return;
  let hash: string;
  try { hash = normalizeHex(raw); } catch { return; }
  if (seen.has(hash)) return;
  seen.add(hash);
  items.push({ hash, category, action, sort_key: String(sortKey || '') });
}

// Public activity that SwapPulse already knows how to tie to a smart-account
// address. This is intentionally labelled as indexed activity rather than a
// complete archive: Starknet JSON-RPC itself is not an address-history indexer.
// Only public transaction hashes and coarse action names leave this function.
async function indexedAddressActivity(req: Request, address: string) {
  const base44 = createClientFromRequest(req);
  const svc = base44.asServiceRole;
  const [identities, stakes, cards, bridges] = await Promise.all([
    svc.entities.ChainIdentity.filter({ account_address: address }, '-updated_date', 20).catch(() => []),
    svc.entities.StakePosition.filter({ account_address: address }, '-created_date', 100).catch(() => []),
    svc.entities.ChainCardToken.filter({ owner_address: address }, '-created_date', 100).catch(() => []),
    svc.entities.BridgeTransfer.filter({ sender_address: address }, '-created_date', 100).catch(() => []),
  ]);

  const items: Array<{ hash: string; category: string; action: string; sort_key: string }> = [];
  const seen = new Set<string>();

  for (const row of identities || []) {
    addIndexedActivity(items, seen, 'identity', 'account_deployment', row.deployment_tx_hash, row.created_date || row.updated_date);
    addIndexedActivity(items, seen, 'identity', 'recovery_configuration', row.recovery_config_tx_hash, row.created_date || row.updated_date);
    addIndexedActivity(items, seen, 'identity', 'identity_registration', row.registration_tx_hash, row.created_date || row.updated_date);
    addIndexedActivity(items, seen, 'identity', 'v2_verification', row.verification_tx_hash, row.updated_date);
    addIndexedActivity(items, seen, 'identity', 'verification_revocation', row.verification_revoke_tx_hash, row.updated_date);
  }
  for (const row of stakes || []) {
    addIndexedActivity(items, seen, 'staking', String(row.intent_kind || 'stake'), row.tx_hash, row.created_date || row.updated_date);
  }
  for (const row of cards || []) {
    addIndexedActivity(items, seen, 'card', 'card_mint', row.tx_hash, row.created_date || row.updated_date);
  }
  for (const row of bridges || []) {
    addIndexedActivity(items, seen, 'bridge', `bridge_${String(row.direction || 'outbound')}_${String(row.asset_kind || 'asset')}`, row.source_tx_hash, row.created_date || row.updated_date);
  }

  items.sort((a, b) => b.sort_key.localeCompare(a.sort_key));
  return items.slice(0, 50).map(({ sort_key, ...item }) => item);
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('METHOD_NOT_ALLOWED', 405);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'summary').trim().toLowerCase();
    const network = await loadPublicNetworkConfig(req);

    if (action === 'summary') {
      const [blockNumber, specVersion, chainId] = await Promise.all([
        rpcCall('starknet_blockNumber', []),
        rpcCall('starknet_specVersion', []),
        rpcCall('starknet_chainId', []),
      ]);
      const latest = Number(blockNumber);
      const ids = Array.from({ length: Math.min(LATEST_BLOCK_LIMIT, latest + 1) }, (_, i) => ({ block_number: latest - i }));
      const blocks = await Promise.all(ids.map((id) => rpcCall('starknet_getBlockWithTxHashes', [id]).catch(() => null)));
      const availableBlocks = blocks.filter(Boolean);
      const latestTransactions = availableBlocks
        .flatMap((block: any) => (Array.isArray(block?.transactions) ? block.transactions : []).map((hash: string) => ({
          transaction_hash: hash,
          block_number: block.block_number ?? null,
          timestamp: block.timestamp ?? null,
        })))
        .slice(0, 12);
      return Response.json({
        ok: true,
        kind: 'summary',
        network: network.network,
        chain_id: chainId || network.chain_id,
        rpc_spec_version: String(specVersion || ''),
        latest_block_number: latest,
        latest_blocks: availableBlocks.map(compactBlock),
        latest_transactions: latestTransactions,
      }, { headers: { 'Cache-Control': 'public, max-age=5, stale-while-revalidate=10' } });
    }

    if (action === 'transaction') {
      try {
        const result = await getTransaction(body?.hash);
        return Response.json({ ok: true, kind: 'transaction', network: network.network, ...result }, { headers: { 'Cache-Control': 'public, max-age=20' } });
      } catch (error) {
        if (error instanceof RpcError) return jsonError('TRANSACTION_NOT_FOUND', 404);
        throw error;
      }
    }

    if (action === 'block') {
      try {
        const block = await getBlock(body?.id);
        return Response.json({ ok: true, kind: 'block', network: network.network, block }, { headers: { 'Cache-Control': 'public, max-age=10' } });
      } catch (error) {
        if (error instanceof RpcError) return jsonError('BLOCK_NOT_FOUND', 404);
        if (String((error as Error)?.message || '').includes('INVALID_')) return jsonError('INVALID_IDENTIFIER', 400);
        throw error;
      }
    }

    if (action === 'address') {
      let address: string;
      try {
        address = normalizeHex(body?.address);
      } catch {
        return jsonError('INVALID_IDENTIFIER', 400);
      }
      try {
        const [classHash, nonce, activity] = await Promise.all([
          rpcCall('starknet_getClassHashAt', ['latest', address]),
          rpcCall('starknet_getNonce', ['latest', address]).catch(() => '0x0'),
          indexedAddressActivity(req, address),
        ]);
        return Response.json({
          ok: true,
          kind: 'address',
          network: network.network,
          address: { address, class_hash: classHash || '', nonce: nonce || '0x0', indexed_activity: activity },
        }, { headers: { 'Cache-Control': 'public, max-age=20' } });
      } catch (error) {
        if (error instanceof RpcError) return jsonError('ADDRESS_NOT_FOUND', 404);
        throw error;
      }
    }

    if (action === 'resolve') {
      const raw = String(body?.identifier ?? '').trim();
      if (!raw || raw.length > 80) return jsonError('INVALID_IDENTIFIER', 400);
      if (/^\d+$/.test(raw)) {
        try {
          const block = await getBlock(raw);
          return Response.json({ ok: true, kind: 'block', network: network.network, block }, { headers: { 'Cache-Control': 'public, max-age=10' } });
        } catch (error) {
          if (error instanceof RpcError) return jsonError('BLOCK_NOT_FOUND', 404);
          return jsonError('INVALID_IDENTIFIER', 400);
        }
      }
      let normalised: string;
      try {
        normalised = normalizeHex(raw);
      } catch {
        return jsonError('INVALID_IDENTIFIER', 400);
      }
      try {
        const result = await getTransaction(normalised);
        return Response.json({ ok: true, kind: 'transaction', network: network.network, ...result }, { headers: { 'Cache-Control': 'public, max-age=20' } });
      } catch (txError) {
        try {
          const block = await getBlock(normalised);
          return Response.json({ ok: true, kind: 'block', network: network.network, block }, { headers: { 'Cache-Control': 'public, max-age=10' } });
        } catch {
          try {
            const [classHash, nonce, activity] = await Promise.all([
              rpcCall('starknet_getClassHashAt', ['latest', normalised]),
              rpcCall('starknet_getNonce', ['latest', normalised]).catch(() => '0x0'),
              indexedAddressActivity(req, normalised),
            ]);
            return Response.json({
              ok: true,
              kind: 'address',
              network: network.network,
              address: { address: normalised, class_hash: classHash || '', nonce: nonce || '0x0', indexed_activity: activity },
            }, { headers: { 'Cache-Control': 'public, max-age=20' } });
          } catch {
            return jsonError('LOOKUP_NOT_FOUND', 404);
          }
        }
      }
    }

    return jsonError('INVALID_ACTION', 400);
  } catch (error: any) {
    console.error('chain-explorer failed:', error?.message || error);
    if (String(error?.message || '') === 'RPC_MISMATCH') return jsonError('NETWORK_CONFIGURATION_UNSAFE', 503);
    return jsonError('EXPLORER_UNAVAILABLE', 503);
  }
}
