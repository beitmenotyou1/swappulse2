// Shared PulseChain JSON-RPC client for the explorer backend functions.
// Uses raw fetch (no ethers dependency) for lightweight, batchable calls
// against PULSE_RPC_URL. The indexer uses batched JSON-RPC for throughput;
// the detail functions use single calls.

import { secrets } from 'base44:runtime';

export function getPulseRpcUrl(): string {
  const url = secrets.get('PULSE_RPC_URL');
  if (!url) throw new Error('PULSE_RPC_URL secret not set');
  return url;
}

export function getPulseExplorerUrl(): string {
  return secrets.get('PULSE_EXPLORER_URL') || 'https://otter.pulsechain.com';
}

// Single JSON-RPC call.
export async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(getPulseRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status} for ${method}`);
  const json: any = await res.json();
  if (json.error) throw new Error(`RPC error ${method}: ${json.error.message || json.error.code}`);
  return json.result;
}

// Batched JSON-RPC call — sends an array of requests in one HTTP round-trip.
// Returns results in the same order as the input calls (null on per-call error).
export async function rpcBatch(calls: { method: string; params: any[] }[]): Promise<any[]> {
  if (calls.length === 0) return [];
  const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: c.method, params: c.params }));
  const res = await fetch(getPulseRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC batch HTTP ${res.status}`);
  const json: any[] = await res.json();
  // Index by id, then return in input order.
  const byId = new Map<number, any>();
  for (const r of json) byId.set(r.id, r);
  return calls.map((_, i) => {
    const r = byId.get(i + 1);
    if (!r || r.error) return null;
    return r.result;
  });
}

// --- Typed helpers ---

export async function getBlockNumber(): Promise<number> {
  const hex = await rpcCall('eth_blockNumber', []);
  return parseInt(hex, 16);
}

export async function getBlockByNumber(num: number, fullTxs = false): Promise<any> {
  const hex = '0x' + num.toString(16);
  return rpcCall('eth_getBlockByNumber', [hex, fullTxs]);
}

// Fetch multiple blocks by number in a single batched JSON-RPC request.
export async function getBlocksByNumberBatch(nums: number[], fullTxs = false): Promise<any[]> {
  return rpcBatch(
    nums.map((n) => ({
      method: 'eth_getBlockByNumber',
      params: ['0x' + n.toString(16), fullTxs],
    })),
  );
}

export async function getTransactionByHash(hash: string): Promise<any> {
  return rpcCall('eth_getTransactionByHash', [hash]);
}

export async function getTransactionReceipt(hash: string): Promise<any> {
  return rpcCall('eth_getTransactionReceipt', [hash]);
}

export async function getBalance(address: string): Promise<bigint> {
  const hex = await rpcCall('eth_getBalance', [address, 'latest']);
  return BigInt(hex);
}

export async function getCode(address: string): Promise<string> {
  return rpcCall('eth_getCode', [address, 'latest']);
}

export async function getTransactionCount(address: string): Promise<number> {
  const hex = await rpcCall('eth_getTransactionCount', [address, 'latest']);
  return parseInt(hex, 16);
}

// --- ERC-20 metadata (for token-transfer decoding) ---

const ERC20_MIN_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
];

// Fetch token symbol + decimals for a contract address. Best-effort — returns
// defaults if the call fails (e.g. non-standard token or non-contract).
export async function getTokenMetadata(contractAddress: string): Promise<{ symbol: string; decimals: number }> {
  // symbol() selector: 0x95d89b41
  // decimals() selector: 0x313ce567
  const [symRes, decRes] = await rpcBatch([
    { method: 'eth_call', params: [{ to: contractAddress, data: '0x95d89b41' }, 'latest'] },
    { method: 'eth_call', params: [{ to: contractAddress, data: '0x313ce567' }, 'latest'] },
  ]);

  let symbol = '???';
  let decimals = 18;

  try {
    if (symRes && symRes !== '0x') {
      // ABI-decode a dynamic string from the return data.
      const hex = symRes.slice(2);
      // String offset (32 bytes) + length (32 bytes) + data
      const offset = parseInt(hex.slice(0, 64), 16);
      const len = parseInt(hex.slice(offset * 2, offset * 2 + 64), 16);
      const strHex = hex.slice(offset * 2 + 64, offset * 2 + 64 + len * 2);
      symbol = Buffer.from(strHex, 'hex').toString('utf8').replace(/\u0000/g, '');
    }
  } catch { /* keep default */ }

  try {
    if (decRes && decRes !== '0x') {
      decimals = parseInt(decRes.slice(2), 16);
      if (!isFinite(decimals) || decimals < 0 || decimals > 36) decimals = 18;
    }
  } catch { /* keep default */ }

  return { symbol, decimals };
}

// Decode a Transfer event log into { from, to, value }.
// Transfer(address indexed from, address indexed to, uint256 value)
// topic[0] = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
export function decodeTransferLog(log: any): { from: string; to: string; value: string } | null {
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  if (!log || !log.topics || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return null;
  if (log.topics.length < 3) return null;
  const from = '0x' + log.topics[1].slice(26);
  const to = '0x' + log.topics[2].slice(26);
  const value = log.data && log.data !== '0x' ? BigInt(log.data).toString() : '0';
  return { from, to, value };
}

// Convert a hex string to a UTF-8 string (for input-data decoding attempts).
export function hexToUtf8(hex: string): string {
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    return Buffer.from(clean, 'hex').toString('utf8');
  } catch {
    return '';
  }
}