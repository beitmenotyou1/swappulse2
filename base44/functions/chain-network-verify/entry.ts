import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash } from 'npm:starknet@10.0.2';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';

const NETWORK = 'SWAPPULSE_TESTNET';
const RPC_TIMEOUT_MS = 10_000;

function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function normalizeHex(value: unknown, field: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  return `0x${BigInt(raw).toString(16)}`;
}

async function safeRpcUrl(rawUrl: string): Promise<string> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('RPC URL must use HTTPS');
  if (url.username || url.password) throw new Error('Authenticated RPC URLs are not allowed in ChainNetworkConfig');
  await assertSafeHost(url.hostname);
  return url.toString();
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.error) {
      const code = payload.error?.code ?? 'unknown';
      throw new Error(`RPC ${method} error ${code}`);
    }
    return payload?.result;
  } finally {
    clearTimeout(timer);
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return jsonError('Unauthorized', 401);
    if (caller.role !== 'admin') return jsonError('Admin only', 403);

    const svc = base44.asServiceRole;
    const rows = await svc.entities.ChainNetworkConfig
      .filter({ network: NETWORK }, '-updated_date', 1)
      .catch(() => []);
    const config = rows?.[0];
    if (!config) return jsonError('SwapPulse Testnet configuration not found', 404, 'CHAIN_CONFIG_MISSING');

    const rpcRaw = String(config.rpc_url || '').trim();
    const configuredChainId = String(config.chain_id || '').trim();
    const registryAddress = String(config.identity_registry_address || '').trim();
    const configuredRegistryOwner = String(config.identity_registry_owner || '').trim();
    const configuredRegistryHash = String(config.identity_registry_class_hash || '').trim();
    const configuredAccountHash = String(config.account_class_hash || '').trim();
    if (!rpcRaw || !configuredChainId || !registryAddress || !configuredRegistryOwner || !configuredRegistryHash || !configuredAccountHash) {
      return jsonError('Save the RPC URL, chain ID, registry address/owner and both class hashes before verification', 409, 'CHAIN_CONFIG_INCOMPLETE');
    }

    let rpcUrl: string;
    try {
      rpcUrl = await safeRpcUrl(rpcRaw);
    } catch (error: any) {
      return jsonError(error?.message || 'Unsafe RPC URL', 400, 'UNSAFE_RPC_URL');
    }

    const [specVersion, chainIdRaw] = await Promise.all([
      rpcCall(rpcUrl, 'starknet_specVersion', []),
      rpcCall(rpcUrl, 'starknet_chainId', []),
    ]);
    const chainId = normalizeHex(chainIdRaw, 'RPC chain id');
    const expectedChainId = normalizeHex(configuredChainId, 'configured chain id');
    if (chainId !== expectedChainId) {
      return jsonError('RPC chain ID does not match the saved SwapPulse Testnet configuration', 409, 'CHAIN_ID_MISMATCH');
    }

    const expectedRegistryHash = normalizeHex(configuredRegistryHash, 'configured registry class hash');
    const actualRegistryHash = normalizeHex(
      await rpcCall(rpcUrl, 'starknet_getClassHashAt', ['latest', normalizeHex(registryAddress, 'registry address')]),
      'registry class hash',
    );
    if (actualRegistryHash !== expectedRegistryHash) {
      return jsonError('IdentityRegistry class hash does not match the saved configuration', 409, 'REGISTRY_CLASS_HASH_MISMATCH');
    }

    const expectedOwner = normalizeHex(configuredRegistryOwner, 'configured registry owner');
    const ownerResult = await rpcCall(rpcUrl, 'starknet_call', [
      {
        contract_address: normalizeHex(registryAddress, 'registry address'),
        entry_point_selector: hash.getSelectorFromName('owner'),
        calldata: [],
      },
      'latest',
    ]);
    if (!Array.isArray(ownerResult) || !ownerResult[0]) {
      return jsonError('IdentityRegistry owner could not be verified', 409, 'REGISTRY_OWNER_UNREADABLE');
    }
    const actualOwner = normalizeHex(ownerResult[0], 'registry owner');
    if (actualOwner !== expectedOwner) {
      return jsonError('IdentityRegistry owner does not match the saved configuration', 409, 'REGISTRY_OWNER_MISMATCH');
    }

    const expectedAccountHash = normalizeHex(configuredAccountHash, 'configured account class hash');
    const accountClass = await rpcCall(rpcUrl, 'starknet_getClass', ['latest', expectedAccountHash]);
    if (!accountClass || typeof accountClass !== 'object') {
      return jsonError('SwapPulseAccount class declaration could not be verified', 409, 'ACCOUNT_CLASS_NOT_DECLARED');
    }

    const now = new Date().toISOString();
    // Every consumer treats the network as ready only when each verified_* pin is
    // byte-identical to its live config field. The pins hold normalised values
    // (lowercased, leading zeros stripped, URL canonicalised), so an admin entry
    // written in any other equivalent form — a class hash padded to 64 digits,
    // uppercase hex, or a bare origin that canonicalises with a trailing slash —
    // would never compare equal and the network would stay permanently "not
    // ready" despite verification reporting CONFIGURED. Persist the canonical
    // form into the config fields too, so equality is meaningful and a genuine
    // later edit by an admin still correctly invalidates the pins.
    await svc.entities.ChainNetworkConfig.update(config.id, {
      status: 'CONFIGURED',
      last_verified_at: now,
      rpc_url: rpcUrl,
      chain_id: chainId,
      identity_registry_address: normalizeHex(registryAddress, 'registry address'),
      identity_registry_class_hash: actualRegistryHash,
      identity_registry_owner: actualOwner,
      account_class_hash: expectedAccountHash,
      verified_chain_id: chainId,
      verified_identity_registry_class_hash: actualRegistryHash,
      verified_identity_registry_owner: actualOwner,
      verified_account_class_hash: expectedAccountHash,
      verified_rpc_url: rpcUrl,
      verified_by: caller.id,
    });

    return Response.json({
      ok: true,
      network: NETWORK,
      status: 'CONFIGURED',
      verified_at: now,
      rpc: {
        url: rpcUrl,
        spec_version: String(specVersion || ''),
        chain_id: chainId,
      },
      contracts: {
        identity_registry_address: normalizeHex(registryAddress, 'registry address'),
        identity_registry_class_hash: actualRegistryHash,
        identity_registry_owner: actualOwner,
        account_class_hash: expectedAccountHash,
      },
    });
  } catch (error: any) {
    console.error('chain-network-verify failed:', error?.message || error);
    return Response.json({ error: 'SwapPulse Testnet verification failed' }, { status: 500 });
  }
}