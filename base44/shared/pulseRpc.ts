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

// Decode a Transfer event log into { from, to, value, is_nft, token_id }.
// ERC-20:  Transfer(address indexed from, address indexed to, uint256 value)      — 3 topics, value in data
// ERC-721: Transfer(address indexed from, address indexed to, uint256 indexed tokenId) — 4 topics, data empty
// topic[0] = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef (same for both)
export function decodeTransferLog(log: any): { from: string; to: string; value: string; is_nft: boolean; token_id: string | null } | null {
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  if (!log || !log.topics || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return null;
  if (log.topics.length < 3) return null;
  const from = '0x' + log.topics[1].slice(26);
  const to = '0x' + log.topics[2].slice(26);
  // ERC-721: tokenId is indexed as topics[3] (4 topics total)
  if (log.topics.length >= 4) {
    const tokenId = BigInt(log.topics[3]).toString();
    return { from, to, value: '1', is_nft: true, token_id: tokenId };
  }
  // ERC-20: value in data
  const value = log.data && log.data !== '0x' ? BigInt(log.data).toString() : '0';
  return { from, to, value, is_nft: false, token_id: null };
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

// Batch-fetch transaction receipts in a single HTTP round-trip.
export async function getTransactionReceiptsBatch(hashes: string[]): Promise<any[]> {
  return rpcBatch(
    hashes.map((h) => ({ method: 'eth_getTransactionReceipt', params: [h] })),
  );
}

// Decode an ABI-encoded string from hex return data (offset + length + data).
function decodeAbiString(hex: string): string {
  if (!hex || hex === '0x') return '';
  const h = hex.slice(2);
  if (h.length < 128) return '';
  try {
    const offset = parseInt(h.slice(0, 64), 16);
    const len = parseInt(h.slice(offset * 2, offset * 2 + 64), 16);
    const strHex = h.slice(offset * 2 + 64, offset * 2 + 64 + len * 2);
    return Buffer.from(strHex, 'hex').toString('utf8').replace(/\u0000/g, '');
  } catch {
    return '';
  }
}

// Fetch NFT metadata (name, image) for an ERC-721 token by calling tokenURI(uint256)
// (or uri(uint256) as fallback) and resolving the returned URI to JSON metadata.
// Best-effort with a 5-second timeout — returns empty strings on any failure.
export async function getNftMetadata(contractAddress: string, tokenId: string): Promise<{ name: string; image: string }> {
  try {
    const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
    // Try tokenURI(uint256) — selector 0xc87b56dd
    let uriHex = await rpcCall('eth_call', [{ to: contractAddress, data: '0xc87b56dd' + tokenIdHex }, 'latest']).catch(() => null);
    // Fallback: uri(uint256) — selector 0x0e89341c
    if (!uriHex || uriHex === '0x') {
      uriHex = await rpcCall('eth_call', [{ to: contractAddress, data: '0x0e89341c' + tokenIdHex }, 'latest']).catch(() => null);
    }
    if (!uriHex || uriHex === '0x') return { name: '', image: '' };

    const uri = decodeAbiString(uriHex);
    if (!uri) return { name: '', image: '' };

    let metadata: any;
    if (uri.startsWith('data:')) {
      const commaIdx = uri.indexOf(',');
      const encoded = uri.slice(commaIdx + 1);
      if (uri.includes('base64')) {
        metadata = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
      } else {
        metadata = JSON.parse(decodeURIComponent(encoded));
      }
    } else {
      let url = uri;
      if (uri.startsWith('ipfs://')) {
        url = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
      metadata = await res.json();
    }

    let image = metadata.image || metadata.image_url || metadata.imageUrl || '';
    if (typeof image === 'object' && image !== null) {
      image = (image as any).url || '';
    }
    if (image.startsWith('ipfs://')) {
      image = image.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return { name: metadata.name || '', image };
  } catch {
    return { name: '', image: '' };
  }
}