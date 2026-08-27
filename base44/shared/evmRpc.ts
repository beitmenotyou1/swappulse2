// Generic EVM JSON-RPC client — works with any EVM chain given its RPC URL.
// Uses raw fetch (no ethers dependency) for lightweight, batchable calls.
// This is a generalized version of pulseRpc.ts that accepts any RPC URL.

export function createEvmRpc(rpcUrl: string) {
  if (!rpcUrl) throw new Error('RPC URL is required');

  // Single JSON-RPC call.
  async function rpcCall(method: string, params: any[]): Promise<any> {
    const res = await fetch(rpcUrl, {
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
  async function rpcBatch(calls: { method: string; params: any[] }[]): Promise<any[]> {
    if (calls.length === 0) return [];
    const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: c.method, params: c.params }));
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`RPC batch HTTP ${res.status}`);
    const json: any[] = await res.json();
    const byId = new Map<number, any>();
    for (const r of json) byId.set(r.id, r);
    return calls.map((_, i) => {
      const r = byId.get(i + 1);
      if (!r || r.error) return null;
      return r.result;
    });
  }

  // --- Typed helpers ---

  async function getBlockNumber(): Promise<number> {
    const hex = await rpcCall('eth_blockNumber', []);
    return parseInt(hex, 16);
  }

  async function getBlocksByNumberBatch(nums: number[], fullTxs = false): Promise<any[]> {
    return rpcBatch(
      nums.map((n) => ({
        method: 'eth_getBlockByNumber',
        params: ['0x' + n.toString(16), fullTxs],
      })),
    );
  }

  async function getTransactionByHash(hash: string): Promise<any> {
    return rpcCall('eth_getTransactionByHash', [hash]);
  }

  async function getTransactionReceipt(hash: string): Promise<any> {
    return rpcCall('eth_getTransactionReceipt', [hash]);
  }

  async function getTransactionReceiptsBatch(hashes: string[]): Promise<any[]> {
    return rpcBatch(
      hashes.map((h) => ({ method: 'eth_getTransactionReceipt', params: [h] })),
    );
  }

  async function getBalance(address: string): Promise<bigint> {
    const hex = await rpcCall('eth_getBalance', [address, 'latest']);
    return BigInt(hex);
  }

  async function getCode(address: string): Promise<string> {
    return rpcCall('eth_getCode', [address, 'latest']);
  }

  async function getTransactionCount(address: string): Promise<number> {
    const hex = await rpcCall('eth_getTransactionCount', [address, 'latest']);
    return parseInt(hex, 16);
  }

  // --- Token / NFT helpers ---

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

  async function getTokenMetadata(contractAddress: string): Promise<{ symbol: string; decimals: number }> {
    const [symRes, decRes] = await rpcBatch([
      { method: 'eth_call', params: [{ to: contractAddress, data: '0x95d89b41' }, 'latest'] },
      { method: 'eth_call', params: [{ to: contractAddress, data: '0x313ce567' }, 'latest'] },
    ]);
    let symbol = '???';
    let decimals = 18;
    try {
      if (symRes && symRes !== '0x') {
        symbol = decodeAbiString(symRes) || '???';
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

  async function getNftMetadata(contractAddress: string, tokenId: string): Promise<{ name: string; image: string }> {
    try {
      const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
      let uriHex = await rpcCall('eth_call', [{ to: contractAddress, data: '0xc87b56dd' + tokenIdHex }, 'latest']).catch(() => null);
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
        if (uri.startsWith('ipfs://')) url = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
        const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'Accept': 'application/json' } });
        metadata = await res.json();
      }
      let image = metadata.image || metadata.image_url || metadata.imageUrl || '';
      if (typeof image === 'object' && image !== null) image = (image as any).url || '';
      if (image.startsWith('ipfs://')) image = image.replace('ipfs://', 'https://ipfs.io/ipfs/');
      return { name: metadata.name || '', image };
    } catch {
      return { name: '', image: '' };
    }
  }

  return {
    rpcCall,
    rpcBatch,
    getBlockNumber,
    getBlocksByNumberBatch,
    getTransactionByHash,
    getTransactionReceipt,
    getTransactionReceiptsBatch,
    getBalance,
    getCode,
    getTransactionCount,
    getTokenMetadata,
    getNftMetadata,
  };
}

// Decode a Transfer event log into { from, to, value, is_nft, token_id }.
// ERC-20:  3 topics, value in data
// ERC-721: 4 topics, tokenId as topics[3]
export function decodeTransferLog(log: any): { from: string; to: string; value: string; is_nft: boolean; token_id: string | null } | null {
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  if (!log || !log.topics || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return null;
  if (log.topics.length < 3) return null;
  const from = '0x' + log.topics[1].slice(26);
  const to = '0x' + log.topics[2].slice(26);
  if (log.topics.length >= 4) {
    const tokenId = BigInt(log.topics[3]).toString();
    return { from, to, value: '1', is_nft: true, token_id: tokenId };
  }
  const value = log.data && log.data !== '0x' ? BigInt(log.data).toString() : '0';
  return { from, to, value, is_nft: false, token_id: null };
}