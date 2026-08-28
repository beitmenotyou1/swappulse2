import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash } from 'npm:starknet@10.0.2';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';

const NETWORK = 'SWAPPULSE_TESTNET';
const MAX_BATCH = 100;
const RPC_TIMEOUT_MS = 10_000;

function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function normalizeHex(value: unknown, field = 'felt'): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} is not valid hex`);
  return `0x${BigInt(raw).toString(16)}`;
}

function asNumber(value: unknown, field: string): number {
  const hex = normalizeHex(value, field);
  const n = BigInt(hex);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${field} exceeds safe integer range`);
  return Number(n);
}

async function getConfig(svc: any) {
  const rows = await svc.entities.ChainNetworkConfig
    .filter({ network: NETWORK }, '-updated_date', 1)
    .catch(() => []);
  return rows?.[0] || null;
}

async function assertSafeRpcUrl(rawUrl: string): Promise<string> {
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

async function starknetCall(
  rpcUrl: string,
  contractAddress: string,
  entrypoint: string,
  calldata: string[],
): Promise<string[]> {
  const result = await rpcCall(rpcUrl, 'starknet_call', [
    {
      contract_address: normalizeHex(contractAddress, 'contract address'),
      entry_point_selector: hash.getSelectorFromName(entrypoint),
      calldata: calldata.map((v) => normalizeHex(v, 'calldata')),
    },
    'latest',
  ]);
  if (!Array.isArray(result)) throw new Error(`RPC ${entrypoint} returned an invalid result`);
  return result.map((v) => normalizeHex(v, `${entrypoint} result`));
}

async function reconcileOne(svc: any, config: any, rpcUrl: string, row: any) {
  const now = new Date().toISOString();
  const identityId = normalizeHex(row.chain_identity_id, 'chain_identity_id');
  const registry = normalizeHex(config.identity_registry_address, 'identity_registry_address');

  try {
    const values = await starknetCall(rpcUrl, registry, 'get_identity', [identityId]);
    if (values.length < 5) throw new Error('get_identity returned too few values');

    const chainAccount = normalizeHex(values[0], 'chain account');
    const chainStatus = asNumber(values[1], 'chain status');
    const canonical = normalizeHex(values[2], 'canonical identity');
    const createdAt = asNumber(values[3], 'created_at');
    const recoveryCount = asNumber(values[4], 'recovery_count');

    if (chainStatus === 0) {
      await svc.entities.ChainIdentity.update(row.id, {
        last_reconciled_at: now,
        failure_code: 'CHAIN_IDENTITY_NOT_REGISTERED',
      });
      return { id: row.id, outcome: 'NOT_REGISTERED' };
    }

    if (chainStatus === 1) {
      if (chainAccount === '0x0') throw new Error('Active identity has zero account');
      const reverse = await starknetCall(rpcUrl, registry, 'get_identity_by_account', [chainAccount]);
      if (reverse.length < 1 || normalizeHex(reverse[0], 'reverse identity') !== identityId) {
        await svc.entities.ChainIdentity.update(row.id, {
          last_reconciled_at: now,
          failure_code: 'CHAIN_REVERSE_MAPPING_MISMATCH',
        });
        return { id: row.id, outcome: 'REVERSE_MISMATCH' };
      }

      const previousRecoveryCount = Number(row.recovery_count || 0);
      const nextStatus = recoveryCount > previousRecoveryCount ? 'RECOVERED' : 'REGISTERED';
      await svc.entities.ChainIdentity.update(row.id, {
        account_address: chainAccount,
        identity_registry_address: registry,
        status: nextStatus,
        canonical_identity_id: canonical === '0x0' ? identityId : canonical,
        recovery_count: recoveryCount,
        last_reconciled_at: now,
        failure_code: '',
      });
      return {
        id: row.id,
        outcome: nextStatus,
        account_changed: Boolean(row.account_address && normalizeHex(row.account_address, 'local account') !== chainAccount),
        recovery_count: recoveryCount,
        chain_created_at: createdAt,
      };
    }

    if (chainStatus === 2) {
      if (canonical === '0x0' || canonical === identityId) throw new Error('Merged identity has invalid canonical target');
      await svc.entities.ChainIdentity.update(row.id, {
        account_address: chainAccount === '0x0' ? String(row.account_address || '') : chainAccount,
        identity_registry_address: registry,
        status: 'MERGED',
        canonical_identity_id: canonical,
        recovery_count: recoveryCount,
        last_reconciled_at: now,
        failure_code: '',
      });
      return { id: row.id, outcome: 'MERGED', canonical_identity_id: canonical };
    }

    await svc.entities.ChainIdentity.update(row.id, {
      last_reconciled_at: now,
      failure_code: `UNKNOWN_CHAIN_STATUS_${chainStatus}`.slice(0, 120),
    });
    return { id: row.id, outcome: 'UNKNOWN_STATUS', chain_status: chainStatus };
  } catch (error: any) {
    const failure = String(error?.message || 'RPC_RECONCILIATION_FAILED')
      .replace(/[^A-Za-z0-9_ .:-]/g, '')
      .slice(0, 120);
    await svc.entities.ChainIdentity.update(row.id, {
      last_reconciled_at: now,
      failure_code: failure || 'RPC_RECONCILIATION_FAILED',
    }).catch(() => null);
    return { id: row.id, outcome: 'ERROR', error: failure || 'RPC reconciliation failed' };
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return jsonError('Unauthorized', 401);
    if (caller.role !== 'admin') return jsonError('Admin only', 403);

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const config = await getConfig(svc);
    if (!config || config.status !== 'CONFIGURED') {
      return jsonError('SwapPulse Testnet is not configured', 409, 'CHAIN_NOT_CONFIGURED');
    }
    if (!config.identity_registry_address || !config.rpc_url) {
      return jsonError('Identity registry address and public RPC URL are required', 409, 'RPC_NOT_CONFIGURED');
    }

    let rpcUrl: string;
    try {
      rpcUrl = await assertSafeRpcUrl(String(config.rpc_url));
    } catch (error: any) {
      return jsonError(error?.message || 'Unsafe RPC URL', 400, 'UNSAFE_RPC_URL');
    }

    // Confirm the endpoint is actually a Starknet node before reading identity state.
    const [specVersion, chainId] = await Promise.all([
      rpcCall(rpcUrl, 'starknet_specVersion', []),
      rpcCall(rpcUrl, 'starknet_chainId', []),
    ]);

    const recordId = String(body.record_id || '').trim();
    const requestedLimit = Math.max(1, Math.min(Number(body.limit) || 25, MAX_BATCH));
    let rows: any[] = [];
    if (recordId) {
      rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
    } else {
      rows = await svc.entities.ChainIdentity
        .filter({ network: NETWORK }, '-created_date', requestedLimit)
        .catch(() => []);
    }

    const results = [];
    for (const row of rows) {
      results.push(await reconcileOne(svc, config, rpcUrl, row));
    }

    const counts: Record<string, number> = {};
    for (const item of results) counts[item.outcome] = (counts[item.outcome] || 0) + 1;

    return Response.json({
      ok: true,
      network: NETWORK,
      rpc: { spec_version: String(specVersion || ''), chain_id: String(chainId || '') },
      processed: results.length,
      counts,
      results,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('chain-identity-reconcile failed:', error?.message || error);
    return Response.json({ error: 'Chain reconciliation failed' }, { status: 500 });
  }
}
