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
      redirect: 'manual',
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

async function getClassHashAt(rpcUrl: string, contractAddress: string): Promise<string> {
  const result = await rpcCall(rpcUrl, 'starknet_getClassHashAt', [
    'latest',
    normalizeHex(contractAddress, 'contract address'),
  ]);
  return normalizeHex(result, 'class hash');
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

async function readVerificationMirror(
  rpcUrl: string,
  registry: string,
  identityId: string,
  expectedAttester: string,
  verificationMode: string,
) {
  const [values, verifiedValues] = await Promise.all([
    starknetCall(rpcUrl, registry, 'get_effective_verification', [identityId]),
    starknetCall(rpcUrl, registry, 'is_verified', [identityId]),
  ]);
  if (values.length < 8 || verifiedValues.length < 1) throw new Error('verification read returned too few values');

  const root = normalizeHex(values[0], 'verification root');
  const status = asNumber(values[1], 'verification status');
  const schemaHash = normalizeHex(values[2], 'verification schema hash');
  const attestedBy = normalizeHex(values[3], 'verification attester');
  const verifiedAt = asNumber(values[4], 'verification verified_at');
  const expiresAt = asNumber(values[5], 'verification expires_at');
  const revokedAt = asNumber(values[6], 'verification revoked_at');
  const version = asNumber(values[7], 'verification version');
  const currentlyValid = asNumber(verifiedValues[0], 'is_verified') === 1;
  let verificationType = 0;
  let verificationLevel = 0;
  let attestationId = '';
  if (verificationMode === 'V2') {
    const assuranceValues = await starknetCall(rpcUrl, registry, 'get_effective_assurance', [identityId]);
    if (assuranceValues.length < 3) throw new Error('V2 assurance read returned too few values');
    verificationType = asNumber(assuranceValues[0], 'verification type');
    verificationLevel = asNumber(assuranceValues[1], 'verification level');
    const rawAttestationId = normalizeHex(assuranceValues[2], 'verification attestation id');
    attestationId = rawAttestationId === '0x0' ? '' : rawAttestationId;
  } else if (verificationMode !== 'V1') {
    throw new Error('identity verification mode is invalid');
  }

  if (![0, 1, 2].includes(status)) throw new Error(`unknown verification status ${status}`);
  if (status !== 0 && attestedBy !== expectedAttester) throw new Error('verification attester does not match configured identity verifier');
  if (status === 0 && (root !== '0x0' || schemaHash !== '0x0' || version !== 0)) {
    throw new Error('empty verification state contains unexpected data');
  }

  let mirrorStatus = 'NONE';
  if (status === 2) mirrorStatus = 'REVOKED';
  else if (status === 1) mirrorStatus = currentlyValid ? 'ACTIVE' : 'EXPIRED';

  return {
    verification_root: root === '0x0' ? '' : root,
    verification_schema_hash: schemaHash === '0x0' ? '' : schemaHash,
    verification_status: mirrorStatus,
    verification_type: verificationType,
    verification_level: verificationLevel,
    verification_attestation_id: attestationId,
    verification_attested_by: attestedBy === '0x0' ? '' : attestedBy,
    verification_verified_at: verifiedAt,
    verification_expires_at: expiresAt,
    verification_revoked_at: revokedAt,
    verification_version: version,
  };
}

async function reconcileOne(svc: any, config: any, rpcUrl: string, row: any) {
  const now = new Date().toISOString();
  const identityId = normalizeHex(row.chain_identity_id, 'chain_identity_id');
  const registry = normalizeHex(config.identity_registry_address, 'identity_registry_address');
  const expectedAttester = normalizeHex(config.identity_verifier_address, 'identity_verifier_address');
  const verificationMode = String(config.identity_verification_mode || 'V1').trim().toUpperCase();

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
        verification_root: '',
        verification_schema_hash: '',
        verification_status: 'NONE',
        verification_type: 0,
        verification_level: 0,
        verification_attestation_id: '',
        verification_attested_by: '',
        verification_verified_at: 0,
        verification_expires_at: 0,
        verification_revoked_at: 0,
        verification_version: 0,
        last_reconciled_at: now,
        failure_code: 'CHAIN_IDENTITY_NOT_REGISTERED',
      });
      return { id: row.id, outcome: 'NOT_REGISTERED' };
    }

    const verification = await readVerificationMirror(
      rpcUrl,
      registry,
      identityId,
      expectedAttester,
      verificationMode,
    );

    if (chainStatus === 1) {
      if (chainAccount === '0x0') throw new Error('Active identity has zero account');

      const expectedAccountClassHash = normalizeHex(config.account_class_hash, 'configured account class hash');
      const accountClassHash = await getClassHashAt(rpcUrl, chainAccount);
      if (accountClassHash !== expectedAccountClassHash) {
        await svc.entities.ChainIdentity.update(row.id, {
          last_reconciled_at: now,
          failure_code: 'CHAIN_ACCOUNT_CLASS_HASH_MISMATCH',
        });
        return { id: row.id, outcome: 'ACCOUNT_CLASS_MISMATCH' };
      }

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
        ...verification,
        last_reconciled_at: now,
        failure_code: '',
      });
      return {
        id: row.id,
        outcome: nextStatus,
        verification_status: verification.verification_status,
        account_changed: Boolean(row.account_address && normalizeHex(row.account_address, 'local account') !== chainAccount),
        recovery_count: recoveryCount,
        chain_created_at: createdAt,
      };
    }

    if (chainStatus === 2) {
      if (canonical === '0x0' || canonical === identityId) throw new Error('Merged identity has invalid canonical target');

      if (chainAccount !== '0x0') {
        const expectedAccountClassHash = normalizeHex(config.account_class_hash, 'configured account class hash');
        const historicalAccountClassHash = await getClassHashAt(rpcUrl, chainAccount);
        if (historicalAccountClassHash !== expectedAccountClassHash) {
          await svc.entities.ChainIdentity.update(row.id, {
            last_reconciled_at: now,
            failure_code: 'CHAIN_ACCOUNT_CLASS_HASH_MISMATCH',
          });
          return { id: row.id, outcome: 'ACCOUNT_CLASS_MISMATCH' };
        }
      }

      // The registry resolves chained merges to the final active identity. Verify
      // the canonical target is itself active before accepting the Base44 mirror.
      const canonicalValues = await starknetCall(rpcUrl, registry, 'get_identity', [canonical]);
      if (canonicalValues.length < 5 || asNumber(canonicalValues[1], 'canonical status') !== 1) {
        throw new Error('Merged identity canonical target is not active');
      }
      if (normalizeHex(canonicalValues[2], 'canonical target') !== canonical) {
        throw new Error('Merged identity canonical target is not canonical');
      }

      await svc.entities.ChainIdentity.update(row.id, {
        account_address: chainAccount === '0x0' ? String(row.account_address || '') : chainAccount,
        identity_registry_address: registry,
        status: 'MERGED',
        canonical_identity_id: canonical,
        recovery_count: recoveryCount,
        ...verification,
        last_reconciled_at: now,
        failure_code: '',
      });
      return {
        id: row.id,
        outcome: 'MERGED',
        canonical_identity_id: canonical,
        verification_status: verification.verification_status,
      };
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
    const isAdmin = caller.role === 'admin';

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole;
    const config = await getConfig(svc);
    if (!config || config.status !== 'CONFIGURED') {
      return jsonError('SwapPulse Testnet is not configured', 409, 'CHAIN_NOT_CONFIGURED');
    }
    if (!config.identity_registry_address || !config.identity_registry_class_hash || !config.identity_registry_owner || !config.identity_verifier_address || !config.account_class_hash || !config.rpc_url) {
      return jsonError(
        'Identity registry address/owner, authorised verifier, registry class hash, account class hash and public RPC URL are required',
        409,
        'RPC_NOT_CONFIGURED',
      );
    }
    if (
      String(config.verified_chain_id || '').trim() !== String(config.chain_id || '').trim()
      || String(config.verified_identity_registry_class_hash || '').trim() !== String(config.identity_registry_class_hash || '').trim()
      || String(config.verified_identity_registry_owner || '').trim() !== String(config.identity_registry_owner || '').trim()
      || String(config.verified_identity_verifier_address || '').trim() !== String(config.identity_verifier_address || '').trim()
      || String(config.verified_identity_verification_mode || '').trim().toUpperCase() !== String(config.identity_verification_mode || 'V1').trim().toUpperCase()
      || String(config.verified_account_class_hash || '').trim() !== String(config.account_class_hash || '').trim()
      || String(config.verified_rpc_url || '').trim() !== String(config.rpc_url || '').trim()
    ) {
      return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    }

    let rpcUrl: string;
    try {
      rpcUrl = await assertSafeRpcUrl(String(config.rpc_url));
    } catch (error: any) {
      return jsonError(error?.message || 'Unsafe RPC URL', 400, 'UNSAFE_RPC_URL');
    }

    // Confirm the endpoint is actually a Starknet node before reading identity state.
    const [specVersion, chainIdRaw] = await Promise.all([
      rpcCall(rpcUrl, 'starknet_specVersion', []),
      rpcCall(rpcUrl, 'starknet_chainId', []),
    ]);
    const chainId = normalizeHex(chainIdRaw, 'RPC chain id');
    const expectedChainId = normalizeHex(config.chain_id, 'configured chain id');
    if (chainId !== expectedChainId) {
      return jsonError('RPC chain id does not match SwapPulse Testnet configuration', 409, 'CHAIN_ID_MISMATCH');
    }

    const registryAddress = normalizeHex(config.identity_registry_address, 'identity registry address');
    const expectedRegistryClassHash = normalizeHex(
      config.identity_registry_class_hash,
      'configured registry class hash',
    );
    const registryClassHash = await getClassHashAt(rpcUrl, registryAddress);
    if (registryClassHash !== expectedRegistryClassHash) {
      return jsonError(
        'IdentityRegistry class hash does not match SwapPulse Testnet configuration',
        409,
        'REGISTRY_CLASS_HASH_MISMATCH',
      );
    }

    const expectedRegistryOwner = normalizeHex(config.identity_registry_owner, 'configured registry owner');
    const expectedVerifier = normalizeHex(config.identity_verifier_address, 'configured identity verifier');
    const ownerValues = await starknetCall(rpcUrl, registryAddress, 'owner', []);
    if (!ownerValues?.[0] || normalizeHex(ownerValues[0], 'registry owner') !== expectedRegistryOwner) {
      return jsonError(
        'IdentityRegistry owner does not match SwapPulse Testnet configuration',
        409,
        'REGISTRY_OWNER_MISMATCH',
      );
    }
    if (expectedVerifier === expectedRegistryOwner) {
      return jsonError('Identity verifier must be separate from the registry owner', 409, 'VERIFIER_ROLE_NOT_SEPARATED');
    }
    const verifierValues = await starknetCall(rpcUrl, registryAddress, 'is_verifier', [expectedVerifier]);
    if (!verifierValues?.[0] || asNumber(verifierValues[0], 'is_verifier') !== 1) {
      return jsonError('Configured identity verifier is no longer authorised on-chain', 409, 'IDENTITY_VERIFIER_NOT_AUTHORISED');
    }

    const recordId = String(body.record_id || '').trim();
    if (!isAdmin && !recordId) {
      return jsonError('Ordinary users may reconcile only their own specific identity record', 400, 'RECORD_ID_REQUIRED');
    }
    const requestedLimit = Math.max(1, Math.min(Number(body.limit) || 25, MAX_BATCH));
    let rows: any[] = [];
    if (recordId) {
      rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
      if (!isAdmin) {
        if (!rows?.[0] || String(rows[0].user_id || '') !== String(caller.id || '')) {
          return jsonError('Chain identity not found for this account', 404, 'IDENTITY_NOT_FOUND');
        }
      }
      // The batch path filters on network, but a single record lookup does not —
      // and every check above (registry address, class hashes, RPC) is pinned to
      // SWAPPULSE_TESTNET. Reconciling a row from another network against this
      // registry would overwrite its mirrored status from the wrong chain.
      if (rows?.[0] && String(rows[0].network || NETWORK) !== NETWORK) {
        return jsonError('This identity belongs to a different network', 409, 'IDENTITY_NETWORK_MISMATCH');
      }
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
      rpc: {
        spec_version: String(specVersion || ''),
        chain_id: chainId,
        identity_registry_class_hash: registryClassHash,
        identity_registry_owner: expectedRegistryOwner,
        identity_verifier_address: expectedVerifier,
      },
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