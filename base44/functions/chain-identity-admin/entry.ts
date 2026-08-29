import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ACTIVE_STATUSES = new Set([
  'PENDING',
  'DEPLOYED',
  'REGISTERED',
  'RECOVERY_PENDING',
  'RECOVERED',
]);

function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function normalizeHex(value: unknown, field: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n <= 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

function normalizeAddress(value: unknown, field: string): string {
  return normalizeHex(value, field);
}

function randomIdentityId(): string {
  // 31 random bytes = 248 bits, safely below the Starknet felt252 field prime.
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  const n = BigInt(`0x${hex}`);
  return `0x${(n === 0n ? 1n : n).toString(16)}`;
}

async function uniqueIdentityId(svc: any): Promise<string> {
  // A 248-bit collision is already vanishingly unlikely, but identity creation
  // should still enforce uniqueness rather than relying on probability alone.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomIdentityId();
    const existing = await svc.entities.ChainIdentity
      .filter({ chain_identity_id: candidate }, '-created_date', 1)
      .catch(() => []);
    if (!existing?.length) return candidate;
  }
  throw new Error('Could not allocate unique chain identity id');
}

function deploymentPayload(config: any, identityId: string, publicKey: string) {
  return {
    account_class_hash: config.accountClassHash,
    constructor: {
      public_key: publicKey,
    },
    post_deploy_account_calls: {
      recovery_controller: config.recoveryController || '0x0',
      recovery_delay_seconds: config.recoveryDelaySeconds,
      note: 'Recovery is disabled at construction. Configure these values through signed account self-calls after deployment.',
    },
    identity_registry_address: config.identityRegistryAddress,
    register_identity_calldata: {
      identity_id: identityId,
      account_address: '<fill after account deployment>',
    },
  };
}

async function networkConfig(svc: any) {
  const rows = await svc.entities.ChainNetworkConfig
    .filter({ network: 'SWAPPULSE_TESTNET' }, '-updated_date', 1)
    .catch(() => []);
  const row = rows?.[0] || null;
  const chainId = String(row?.chain_id || '').trim();
  const accountClassHash = String(row?.account_class_hash || '').trim();
  const identityRegistryClassHash = String(row?.identity_registry_class_hash || '').trim();
  const identityRegistryAddress = String(row?.identity_registry_address || '').trim();
  const recoveryController = String(row?.recovery_controller || '').trim();
  const parsedDelay = Number(row?.recovery_delay_seconds ?? 172800);
  const recoveryDelaySeconds = Number.isFinite(parsedDelay) && parsedDelay >= 0
    ? Math.min(2592000, Math.floor(parsedDelay))
    : 172800;
  const status = String(row?.status || 'UNCONFIGURED');

  return {
    id: row?.id || '',
    network: 'SWAPPULSE_TESTNET',
    chainId,
    accountClassHash,
    identityRegistryClassHash,
    identityRegistryAddress,
    recoveryController,
    recoveryDelaySeconds,
    rpcUrl: String(row?.rpc_url || '').trim(),
    explorerUrl: String(row?.explorer_url || '').trim(),
    status,
    lastVerifiedAt: String(row?.last_verified_at || '').trim(),
    verifiedChainId: String(row?.verified_chain_id || '').trim(),
    verifiedRegistryClassHash: String(row?.verified_identity_registry_class_hash || '').trim(),
    verifiedAccountClassHash: String(row?.verified_account_class_hash || '').trim(),
    verifiedRpcUrl: String(row?.verified_rpc_url || '').trim(),
    verifiedBy: String(row?.verified_by || '').trim(),
    ready: status === 'CONFIGURED'
      && Boolean(chainId && accountClassHash && identityRegistryClassHash && identityRegistryAddress)
      && String(row?.verified_chain_id || '').trim() === chainId
      && String(row?.verified_identity_registry_class_hash || '').trim() === identityRegistryClassHash
      && String(row?.verified_account_class_hash || '').trim() === accountClassHash
      && String(row?.verified_rpc_url || '').trim() === String(row?.rpc_url || '').trim(),
  };
}

function safeIdentity(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    chain_identity_id: row.chain_identity_id,
    account_address: row.account_address || '',
    network: row.network,
    account_class_hash: row.account_class_hash || '',
    identity_registry_address: row.identity_registry_address || '',
    deployment_tx_hash: row.deployment_tx_hash || '',
    registration_tx_hash: row.registration_tx_hash || '',
    signer_version: row.signer_version,
    status: row.status,
    canonical_identity_id: row.canonical_identity_id || row.chain_identity_id,
    recovery_count: Number(row.recovery_count || 0),
    created_at: row.created_at || row.created_date || '',
    last_reconciled_at: row.last_reconciled_at || '',
    failure_code: row.failure_code || '',
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return jsonError('Unauthorized', 401);
    if (caller.role !== 'admin') return jsonError('Admin only', 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'config');
    const svc = base44.asServiceRole;
    const config = await networkConfig(svc);

    if (action === 'config') {
      return Response.json({
        ok: true,
        config: {
          network: config.network,
          chain_id: config.chainId,
          status: config.status,
          ready: config.ready,
          account_class_hash: config.accountClassHash,
          identity_registry_class_hash: config.identityRegistryClassHash,
          identity_registry_address: config.identityRegistryAddress,
          recovery_controller: config.recoveryController,
          recovery_controller_configured: Boolean(config.recoveryController),
          recovery_delay_seconds: config.recoveryDelaySeconds,
          rpc_url: config.rpcUrl,
          explorer_url: config.explorerUrl,
          last_verified_at: config.lastVerifiedAt,
          verified_chain_id: config.verifiedChainId,
          verified_identity_registry_class_hash: config.verifiedRegistryClassHash,
          verified_account_class_hash: config.verifiedAccountClassHash,
          verified_rpc_url: config.verifiedRpcUrl,
        },
        notes: [
          'These are public blockchain configuration values stored in the admin-only ChainNetworkConfig entity, not secrets.',
          'This endpoint never returns a private key or passkey secret.',
          'Ordinary-user provisioning remains disabled until AgeStatus enforcement is implemented.',
        ],
      });
    }

    if (action === 'save_config') {
      const status = String(body.status || 'CONFIGURED').trim().toUpperCase();
      if (!['UNCONFIGURED', 'CONFIGURED', 'PAUSED'].includes(status)) {
        return jsonError('Invalid config status', 400, 'INVALID_CONFIG_STATUS');
      }
      if (status === 'CONFIGURED' && config.status !== 'CONFIGURED') {
        return jsonError('Use RPC verification to activate SwapPulse Testnet', 409, 'CHAIN_VERIFICATION_REQUIRED');
      }

      let chainId = '';
      let accountClassHash = '';
      let identityRegistryClassHash = '';
      let identityRegistryAddress = '';
      let recoveryController = '';
      try {
        if (body.chain_id) chainId = normalizeHex(body.chain_id, 'chain_id');
        if (body.account_class_hash) accountClassHash = normalizeHex(body.account_class_hash, 'account_class_hash');
        if (body.identity_registry_class_hash) identityRegistryClassHash = normalizeHex(body.identity_registry_class_hash, 'identity_registry_class_hash');
        if (body.identity_registry_address) identityRegistryAddress = normalizeAddress(body.identity_registry_address, 'identity_registry_address');
        if (body.recovery_controller) recoveryController = normalizeAddress(body.recovery_controller, 'recovery_controller');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid chain configuration', 400, 'INVALID_CHAIN_CONFIG');
      }

      if (status === 'CONFIGURED' && (!chainId || !accountClassHash || !identityRegistryClassHash || !identityRegistryAddress)) {
        return jsonError('Configured network requires chain_id, account_class_hash, identity_registry_class_hash and identity_registry_address', 400, 'INCOMPLETE_CHAIN_CONFIG');
      }

      const parsedDelay = Number(body.recovery_delay_seconds ?? 172800);
      if (!Number.isFinite(parsedDelay) || parsedDelay < 0 || parsedDelay > 2592000) {
        return jsonError('recovery_delay_seconds must be between 0 and 2592000', 400, 'INVALID_RECOVERY_DELAY');
      }

      const rpcUrl = String(body.rpc_url || '').trim();
      const explorerUrl = String(body.explorer_url || '').trim();
      for (const [label, url] of [['rpc_url', rpcUrl], ['explorer_url', explorerUrl]] as const) {
        if (url && !/^https:\/\//i.test(url)) return jsonError(`${label} must use https`, 400, 'INVALID_PUBLIC_URL');
      }

      const trustedCoordinatesChanged = Boolean(config.id) && (
        chainId !== config.chainId
        || accountClassHash !== config.accountClassHash
        || identityRegistryClassHash !== config.identityRegistryClassHash
        || identityRegistryAddress !== config.identityRegistryAddress
        || rpcUrl !== config.rpcUrl
      );
      const effectiveStatus = status === 'PAUSED'
        ? 'PAUSED'
        : (trustedCoordinatesChanged ? 'UNCONFIGURED' : status);

      const payload = {
        network: 'SWAPPULSE_TESTNET',
        chain_id: chainId,
        account_class_hash: accountClassHash,
        identity_registry_class_hash: identityRegistryClassHash,
        identity_registry_address: identityRegistryAddress,
        recovery_controller: recoveryController,
        recovery_delay_seconds: Math.floor(parsedDelay),
        rpc_url: rpcUrl,
        explorer_url: explorerUrl,
        status: effectiveStatus,
        last_verified_at: trustedCoordinatesChanged ? '' : config.lastVerifiedAt,
        verified_chain_id: trustedCoordinatesChanged ? '' : config.verifiedChainId,
        verified_identity_registry_class_hash: trustedCoordinatesChanged ? '' : config.verifiedRegistryClassHash,
        verified_account_class_hash: trustedCoordinatesChanged ? '' : config.verifiedAccountClassHash,
        verified_rpc_url: trustedCoordinatesChanged ? '' : config.verifiedRpcUrl,
        verified_by: trustedCoordinatesChanged ? '' : config.verifiedBy,
        updated_at: new Date().toISOString(),
        updated_by: caller.id,
      };

      if (config.id) await svc.entities.ChainNetworkConfig.update(config.id, payload);
      else await svc.entities.ChainNetworkConfig.create(payload);

      const saved = await networkConfig(svc);
      return Response.json({
        ok: true,
        config: {
          network: saved.network,
          chain_id: saved.chainId,
          status: saved.status,
          ready: saved.ready,
          account_class_hash: saved.accountClassHash,
          identity_registry_class_hash: saved.identityRegistryClassHash,
          identity_registry_address: saved.identityRegistryAddress,
          recovery_controller: saved.recoveryController,
          recovery_controller_configured: Boolean(saved.recoveryController),
          recovery_delay_seconds: saved.recoveryDelaySeconds,
          rpc_url: saved.rpcUrl,
          explorer_url: saved.explorerUrl,
          last_verified_at: saved.lastVerifiedAt,
          verified_chain_id: saved.verifiedChainId,
          verified_identity_registry_class_hash: saved.verifiedRegistryClassHash,
          verified_account_class_hash: saved.verifiedAccountClassHash,
          verified_rpc_url: saved.verifiedRpcUrl,
        },
      });
    }

    if (action === 'prepare') {
      const targetUserId = String(body.target_user_id || '').trim();
      if (!targetUserId) return jsonError('target_user_id is required', 400);

      let publicKey: string;
      try {
        publicKey = normalizeHex(body.public_key, 'public_key');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid public key', 400, 'INVALID_PUBLIC_KEY');
      }

      const users = await svc.entities.User.filter({ id: targetUserId }, '-created_date', 1).catch(() => []);
      if (!users?.[0]) return jsonError('Target user not found', 404);

      const existing = await svc.entities.ChainIdentity
        .filter({ user_id: targetUserId }, '-created_date', 20)
        .catch(() => []);
      const current = existing.find((row: any) => ACTIVE_STATUSES.has(String(row?.status || '')));
      if (current) {
        if (String(current.status || '') === 'PENDING') {
          const refreshedFields = {
            account_class_hash: config.accountClassHash,
            identity_registry_address: config.identityRegistryAddress,
            failure_code: '',
          };
          await svc.entities.ChainIdentity.update(current.id, refreshedFields);
          const refreshedRows = await svc.entities.ChainIdentity
            .filter({ id: current.id }, '-created_date', 1)
            .catch(() => []);
          const refreshed = refreshedRows?.[0] || { ...current, ...refreshedFields };
          return Response.json({
            ok: true,
            existing: true,
            chain_ready: config.ready,
            identity: safeIdentity(refreshed),
            deployment: deploymentPayload(config, refreshed.chain_identity_id, publicKey),
            warnings: config.ready ? [] : [
              'SwapPulse Testnet contract coordinates are not configured yet. The identity remains PENDING.',
            ],
          });
        }

        return Response.json({
          ok: true,
          existing: true,
          identity: safeIdentity(current),
        });
      }

      const identityId = await uniqueIdentityId(svc);
      const now = new Date().toISOString();
      const record = await svc.entities.ChainIdentity.create({
        user_id: targetUserId,
        chain_identity_id: identityId,
        network: config.network,
        account_class_hash: config.accountClassHash,
        identity_registry_address: config.identityRegistryAddress,
        signer_version: 'STARK_V1',
        status: 'PENDING',
        canonical_identity_id: identityId,
        recovery_count: 0,
        created_at: now,
        last_reconciled_at: '',
        failure_code: '',
      });

      return Response.json({
        ok: true,
        existing: false,
        chain_ready: config.ready,
        identity: safeIdentity(record),
        deployment: deploymentPayload(config, identityId, publicKey),
        warnings: config.ready ? [] : [
          'SwapPulse Testnet contract addresses are not configured yet. The identity reservation is PENDING and cannot be deployed until the contracts are declared/deployed.',
        ],
      });
    }

    if (action === 'record_deployment') {
      const recordId = String(body.record_id || '').trim();
      if (!recordId) return jsonError('record_id is required', 400);
      if (!config.ready) return jsonError('SwapPulse Testnet is not configured', 409, 'CHAIN_NOT_CONFIGURED');

      let accountAddress: string;
      try {
        accountAddress = normalizeAddress(body.account_address, 'account_address');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid account address', 400, 'INVALID_ACCOUNT_ADDRESS');
      }

      const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
      const record = rows?.[0];
      if (!record) return jsonError('ChainIdentity not found', 404);
      if (!['PENDING', 'FAILED'].includes(String(record.status || ''))) {
        return jsonError('Identity is not awaiting deployment', 409, 'INVALID_STATE');
      }

      if (record.account_class_hash && normalizeHex(record.account_class_hash, 'record account_class_hash') !== config.accountClassHash) {
        return jsonError('Reserved identity uses a different account class hash', 409, 'ACCOUNT_CLASS_CHANGED');
      }
      if (record.identity_registry_address && normalizeAddress(record.identity_registry_address, 'record identity_registry_address') !== config.identityRegistryAddress) {
        return jsonError('Reserved identity uses a different IdentityRegistry', 409, 'REGISTRY_CHANGED');
      }

      const deploymentTxHash = body.deployment_tx_hash
        ? normalizeHex(body.deployment_tx_hash, 'deployment_tx_hash')
        : '';
      const registrationTxHash = body.registration_tx_hash
        ? normalizeHex(body.registration_tx_hash, 'registration_tx_hash')
        : '';

      await svc.entities.ChainIdentity.update(record.id, {
        account_address: accountAddress,
        deployment_tx_hash: deploymentTxHash,
        registration_tx_hash: registrationTxHash,
        status: 'DEPLOYED',
        failure_code: '',
      });

      const updatedRows = await svc.entities.ChainIdentity.filter({ id: record.id }, '-created_date', 1).catch(() => []);
      return Response.json({
        ok: true,
        identity: safeIdentity(updatedRows?.[0] || { ...record, account_address: accountAddress, status: 'DEPLOYED' }),
        chain_authority_required: true,
        note: 'DEPLOYED means transaction details were recorded. REGISTERED is reserved for a later chain read-back/reconciliation check.',
      });
    }

    if (action === 'mark_failed') {
      const recordId = String(body.record_id || '').trim();
      const failureCode = String(body.failure_code || 'ADMIN_ABORTED').trim().slice(0, 120);
      if (!recordId) return jsonError('record_id is required', 400);
      const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
      const record = rows?.[0];
      if (!record) return jsonError('ChainIdentity not found', 404);
      if (record.status === 'REGISTERED' || record.status === 'MERGED') {
        return jsonError('Registered/merged identities cannot be marked failed from Base44', 409, 'CHAIN_STATE_PROTECTED');
      }
      await svc.entities.ChainIdentity.update(record.id, { status: 'FAILED', failure_code: failureCode });
      return Response.json({ ok: true, status: 'FAILED', record_id: record.id });
    }

    return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
  } catch (e: any) {
    console.error('chain-identity-admin failed', e?.message || e);
    return Response.json({ error: 'Chain identity operation failed' }, { status: 500 });
  }
}
