import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash } from 'npm:starknet@10.0.2';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';

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

function normalizePublicHttpsUrl(value: unknown, field: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error(`${field} must use https`);
  if (url.username || url.password) throw new Error(`${field} must not contain embedded credentials`);
  return url.toString();
}

function findForbiddenManifestKey(value: unknown, path = 'manifest'): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findForbiddenManifestKey(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }

  const forbidden = /(private[_-]?key|mnemonic|seed[_-]?phrase|password|secret|credential|bearer|api[_-]?key)/i;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.test(key)) return `${path}.${key}`;
    const found = findForbiddenManifestKey(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
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

async function ageEligibilityForUser(svc: any, userId: string) {
  const rows = await svc.entities.AgeStatus
    .filter({ user_id: userId }, '-updated_date', 5)
    .catch(() => []);
  const row = rows?.[0] || null;
  if (!row || !isAgeBand(row.age_band)) {
    return { row: null, eligible: false, ageBand: '' };
  }
  const ageBand = row.age_band as AgeBand;
  const method = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  const eligibility = deriveAgeEligibility(ageBand, method);
  return {
    row,
    eligible: eligibility.testnet_identity_eligible,
    ageBand,
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
  const identityRegistryOwner = String(row?.identity_registry_owner || '').trim();
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
    identityRegistryOwner,
    recoveryController,
    recoveryDelaySeconds,
    rpcUrl: String(row?.rpc_url || '').trim(),
    explorerUrl: String(row?.explorer_url || '').trim(),
    status,
    lastVerifiedAt: String(row?.last_verified_at || '').trim(),
    verifiedChainId: String(row?.verified_chain_id || '').trim(),
    verifiedRegistryClassHash: String(row?.verified_identity_registry_class_hash || '').trim(),
    verifiedRegistryOwner: String(row?.verified_identity_registry_owner || '').trim(),
    verifiedAccountClassHash: String(row?.verified_account_class_hash || '').trim(),
    verifiedRpcUrl: String(row?.verified_rpc_url || '').trim(),
    verifiedBy: String(row?.verified_by || '').trim(),
    ready: status === 'CONFIGURED'
      && Boolean(chainId && accountClassHash && identityRegistryClassHash && identityRegistryAddress && identityRegistryOwner)
      && String(row?.verified_chain_id || '').trim() === chainId
      && String(row?.verified_identity_registry_class_hash || '').trim() === identityRegistryClassHash
      && String(row?.verified_identity_registry_owner || '').trim() === identityRegistryOwner
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
    signer_public_key: row.signer_public_key || '',
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
          identity_registry_owner: config.identityRegistryOwner,
          recovery_controller: config.recoveryController,
          recovery_controller_configured: Boolean(config.recoveryController),
          recovery_delay_seconds: config.recoveryDelaySeconds,
          rpc_url: config.rpcUrl,
          explorer_url: config.explorerUrl,
          last_verified_at: config.lastVerifiedAt,
          verified_chain_id: config.verifiedChainId,
          verified_identity_registry_class_hash: config.verifiedRegistryClassHash,
          verified_identity_registry_owner: config.verifiedRegistryOwner,
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

    if (action === 'import_manifest') {
      let manifest: any = body.manifest;
      try {
        if (typeof manifest === 'string') manifest = JSON.parse(manifest);
      } catch {
        return jsonError('Deployment manifest is not valid JSON', 400, 'INVALID_MANIFEST_JSON');
      }
      if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        return jsonError('Deployment manifest must be a JSON object', 400, 'INVALID_MANIFEST');
      }
      if (Number(manifest.schema_version) !== 1) {
        return jsonError('Unsupported deployment manifest schema_version', 400, 'UNSUPPORTED_MANIFEST_VERSION');
      }
      if (String(manifest.network || '') !== 'SWAPPULSE_TESTNET') {
        return jsonError('Deployment manifest is not for SWAPPULSE_TESTNET', 400, 'WRONG_MANIFEST_NETWORK');
      }
      const forbiddenPath = findForbiddenManifestKey(manifest);
      if (forbiddenPath) {
        return jsonError(`Deployment manifest contains a forbidden secret-like field at ${forbiddenPath}`, 400, 'MANIFEST_CONTAINS_SECRET');
      }

      let chainId: string;
      let accountClassHash: string;
      let identityRegistryClassHash: string;
      let identityRegistryAddress: string;
      let identityRegistryOwner: string;
      let recoveryController = '';
      let rpcUrl: string;
      let explorerUrl = '';
      try {
        chainId = normalizeHex(manifest.chain_id, 'chain_id');
        accountClassHash = normalizeHex(manifest.account_class_hash, 'account_class_hash');
        identityRegistryClassHash = normalizeHex(manifest.identity_registry_class_hash, 'identity_registry_class_hash');
        identityRegistryAddress = normalizeAddress(manifest.identity_registry_address, 'identity_registry_address');
        identityRegistryOwner = normalizeAddress(manifest.identity_registry_owner, 'identity_registry_owner');
        if (manifest.recovery_controller) recoveryController = normalizeAddress(manifest.recovery_controller, 'recovery_controller');
        rpcUrl = normalizePublicHttpsUrl(manifest.rpc_url, 'rpc_url');
        if (!rpcUrl) throw new Error('rpc_url is required');
        if (manifest.explorer_url) explorerUrl = normalizePublicHttpsUrl(manifest.explorer_url, 'explorer_url');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid deployment manifest', 400, 'INVALID_MANIFEST');
      }

      const recoveryDelay = Number(manifest.recovery_delay_seconds ?? 172800);
      if (!Number.isInteger(recoveryDelay) || recoveryDelay < 0 || recoveryDelay > 2592000) {
        return jsonError('Manifest recovery_delay_seconds must be an integer from 0 to 2592000', 400, 'INVALID_MANIFEST_RECOVERY_DELAY');
      }

      const payload = {
        network: 'SWAPPULSE_TESTNET',
        chain_id: chainId,
        account_class_hash: accountClassHash,
        identity_registry_class_hash: identityRegistryClassHash,
        identity_registry_address: identityRegistryAddress,
        identity_registry_owner: identityRegistryOwner,
        recovery_controller: recoveryController,
        recovery_delay_seconds: recoveryDelay,
        rpc_url: rpcUrl,
        explorer_url: explorerUrl,
        status: 'UNCONFIGURED',
        last_verified_at: '',
        verified_chain_id: '',
        verified_identity_registry_class_hash: '',
        verified_identity_registry_owner: '',
        verified_account_class_hash: '',
        verified_rpc_url: '',
        verified_by: '',
        updated_at: new Date().toISOString(),
        updated_by: caller.id,
      };

      if (config.id) await svc.entities.ChainNetworkConfig.update(config.id, payload);
      else await svc.entities.ChainNetworkConfig.create(payload);
      const saved = await networkConfig(svc);
      return Response.json({
        ok: true,
        imported: true,
        config: {
          network: saved.network,
          chain_id: saved.chainId,
          status: saved.status,
          ready: saved.ready,
          account_class_hash: saved.accountClassHash,
          identity_registry_class_hash: saved.identityRegistryClassHash,
          identity_registry_address: saved.identityRegistryAddress,
          identity_registry_owner: saved.identityRegistryOwner,
          recovery_controller: saved.recoveryController,
          recovery_delay_seconds: saved.recoveryDelaySeconds,
          rpc_url: saved.rpcUrl,
          explorer_url: saved.explorerUrl,
        },
        note: 'Manifest imported as an unverified draft. Verify & Activate must independently read the public RPC before this network becomes ready.',
      });
    }

    if (action === 'save_config') {
      const status = String(body.status || config.status || 'UNCONFIGURED').trim().toUpperCase();
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
      let identityRegistryOwner = '';
      let recoveryController = '';
      try {
        if (body.chain_id) chainId = normalizeHex(body.chain_id, 'chain_id');
        if (body.account_class_hash) accountClassHash = normalizeHex(body.account_class_hash, 'account_class_hash');
        if (body.identity_registry_class_hash) identityRegistryClassHash = normalizeHex(body.identity_registry_class_hash, 'identity_registry_class_hash');
        if (body.identity_registry_address) identityRegistryAddress = normalizeAddress(body.identity_registry_address, 'identity_registry_address');
        if (body.identity_registry_owner) identityRegistryOwner = normalizeAddress(body.identity_registry_owner, 'identity_registry_owner');
        if (body.recovery_controller) recoveryController = normalizeAddress(body.recovery_controller, 'recovery_controller');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid chain configuration', 400, 'INVALID_CHAIN_CONFIG');
      }

      if (status === 'CONFIGURED' && (!chainId || !accountClassHash || !identityRegistryClassHash || !identityRegistryAddress || !identityRegistryOwner)) {
        return jsonError('Configured network requires chain_id, account_class_hash, identity_registry_class_hash, identity_registry_address and identity_registry_owner', 400, 'INCOMPLETE_CHAIN_CONFIG');
      }

      const parsedDelay = Number(body.recovery_delay_seconds ?? 172800);
      if (!Number.isFinite(parsedDelay) || parsedDelay < 0 || parsedDelay > 2592000) {
        return jsonError('recovery_delay_seconds must be between 0 and 2592000', 400, 'INVALID_RECOVERY_DELAY');
      }

      let rpcUrl = '';
      let explorerUrl = '';
      try {
        rpcUrl = normalizePublicHttpsUrl(body.rpc_url, 'rpc_url');
        explorerUrl = normalizePublicHttpsUrl(body.explorer_url, 'explorer_url');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid public URL', 400, 'INVALID_PUBLIC_URL');
      }

      const trustedCoordinatesChanged = Boolean(config.id) && (
        chainId !== config.chainId
        || accountClassHash !== config.accountClassHash
        || identityRegistryClassHash !== config.identityRegistryClassHash
        || identityRegistryAddress !== config.identityRegistryAddress
        || identityRegistryOwner !== config.identityRegistryOwner
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
        identity_registry_owner: identityRegistryOwner,
        recovery_controller: recoveryController,
        recovery_delay_seconds: Math.floor(parsedDelay),
        rpc_url: rpcUrl,
        explorer_url: explorerUrl,
        status: effectiveStatus,
        last_verified_at: trustedCoordinatesChanged ? '' : config.lastVerifiedAt,
        verified_chain_id: trustedCoordinatesChanged ? '' : config.verifiedChainId,
        verified_identity_registry_class_hash: trustedCoordinatesChanged ? '' : config.verifiedRegistryClassHash,
        verified_identity_registry_owner: trustedCoordinatesChanged ? '' : config.verifiedRegistryOwner,
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
          identity_registry_owner: saved.identityRegistryOwner,
          recovery_controller: saved.recoveryController,
          recovery_controller_configured: Boolean(saved.recoveryController),
          recovery_delay_seconds: saved.recoveryDelaySeconds,
          rpc_url: saved.rpcUrl,
          explorer_url: saved.explorerUrl,
          last_verified_at: saved.lastVerifiedAt,
          verified_chain_id: saved.verifiedChainId,
          verified_identity_registry_class_hash: saved.verifiedRegistryClassHash,
          verified_identity_registry_owner: saved.verifiedRegistryOwner,
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

      const ageStatus = await ageEligibilityForUser(svc, targetUserId);
      if (!ageStatus.eligible) {
        return jsonError(
          'Target user must have an eligible 18+ AgeStatus before any SwapPulse Testnet identity can be prepared',
          403,
          'AGE_ELIGIBILITY_REQUIRED',
        );
      }

      const existing = await svc.entities.ChainIdentity
        .filter({ user_id: targetUserId }, '-created_date', 20)
        .catch(() => []);
      const current = existing.find((row: any) => ACTIVE_STATUSES.has(String(row?.status || '')));
      if (current) {
        if (String(current.status || '') === 'PENDING') {
          const existingPublicKey = String(current.signer_public_key || '').trim();
          if (existingPublicKey && normalizeHex(existingPublicKey, 'reserved signer_public_key') !== publicKey) {
            return jsonError('This pending identity was reserved for a different public key', 409, 'SIGNER_PUBLIC_KEY_MISMATCH');
          }
          const refreshedFields = {
            account_class_hash: config.accountClassHash,
            identity_registry_address: config.identityRegistryAddress,
            signer_public_key: publicKey,
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
        signer_public_key: publicKey,
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

    if (action === 'import_provisioning_result') {
      const recordId = String(body.record_id || '').trim();
      if (!recordId) return jsonError('record_id is required', 400);
      if (!config.ready) return jsonError('SwapPulse Testnet is not configured', 409, 'CHAIN_NOT_CONFIGURED');

      let result: any = body.result;
      try {
        if (typeof result === 'string') result = JSON.parse(result);
      } catch {
        return jsonError('Provisioning result is not valid JSON', 400, 'INVALID_PROVISIONING_JSON');
      }
      if (!result || typeof result !== 'object' || Array.isArray(result)) {
        return jsonError('Provisioning result must be a JSON object', 400, 'INVALID_PROVISIONING_RESULT');
      }
      if (Number(result.schema_version) !== 1 || String(result.kind || '') !== 'SWAPPULSE_TEST_IDENTITY_PROVISIONING_RESULT') {
        return jsonError('Unsupported provisioning result format', 400, 'UNSUPPORTED_PROVISIONING_RESULT');
      }
      if (result.ok !== true || String(result.network || '') !== 'SWAPPULSE_TESTNET') {
        return jsonError('Provisioning result is not a successful SwapPulse Testnet result', 400, 'INVALID_PROVISIONING_RESULT');
      }
      const forbiddenPath = findForbiddenManifestKey(result, 'provisioning_result');
      if (forbiddenPath) {
        return jsonError(`Provisioning result contains a forbidden secret-like field at ${forbiddenPath}`, 400, 'PROVISIONING_RESULT_CONTAINS_SECRET');
      }

      const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
      const record = rows?.[0];
      if (!record) return jsonError('ChainIdentity not found', 404);
      const currentAgeStatus = await ageEligibilityForUser(svc, String(record.user_id || ''));
      if (!currentAgeStatus.eligible) {
        return jsonError('This user is no longer eligible for SwapPulse Testnet identity provisioning', 403, 'AGE_ELIGIBILITY_REQUIRED');
      }
      if (['REGISTERED', 'MERGED', 'RECOVERED'].includes(String(record.status || ''))) {
        return jsonError('This identity is already chain-authoritative and cannot be overwritten from a provisioning result', 409, 'CHAIN_STATE_PROTECTED');
      }
      if (!['PENDING', 'FAILED', 'DEPLOYED'].includes(String(record.status || ''))) {
        return jsonError('Identity is not in a provisioning state', 409, 'INVALID_STATE');
      }

      let resultChainId: string;
      let resultIdentityId: string;
      let resultPublicKey: string;
      let resultAccountAddress: string;
      let resultAccountClassHash: string;
      let resultRegistryAddress: string;
      let resultRegistryOwner: string;
      let resultRecoveryController: string;
      let deploymentTxHash = '';
      let registrationTxHash = '';
      try {
        resultChainId = normalizeHex(result.chain_id, 'result chain_id');
        resultIdentityId = normalizeHex(result.identity_id, 'result identity_id');
        resultPublicKey = normalizeHex(result.public_key, 'result public_key');
        resultAccountAddress = normalizeAddress(result.account_address, 'result account_address');
        resultAccountClassHash = normalizeHex(result.account_class_hash, 'result account_class_hash');
        resultRegistryAddress = normalizeAddress(result.identity_registry_address, 'result identity_registry_address');
        resultRegistryOwner = normalizeAddress(result.identity_registry_owner, 'result identity_registry_owner');
        resultRecoveryController = result.recovery_controller
          ? normalizeAddress(result.recovery_controller, 'result recovery_controller')
          : '0x0';
        if (result.transactions?.account_deploy) deploymentTxHash = normalizeHex(result.transactions.account_deploy, 'account_deploy tx hash');
        if (result.transactions?.identity_register) registrationTxHash = normalizeHex(result.transactions.identity_register, 'identity_register tx hash');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid provisioning result fields', 400, 'INVALID_PROVISIONING_RESULT');
      }

      const expectedRecoveryController = config.recoveryController
        ? normalizeAddress(config.recoveryController, 'configured recovery controller')
        : '0x0';
      const resultRecoveryDelay = Number(result.recovery_delay_seconds);
      if (!Number.isInteger(resultRecoveryDelay)) {
        return jsonError('Provisioning recovery_delay_seconds must be an integer', 400, 'INVALID_PROVISIONING_RESULT');
      }

      if (resultChainId !== normalizeHex(config.chainId, 'configured chain id')) return jsonError('Provisioning result chain ID does not match the verified network', 409, 'CHAIN_ID_MISMATCH');
      if (resultIdentityId !== normalizeHex(record.chain_identity_id, 'reserved identity id')) return jsonError('Provisioning result identity ID does not match this reservation', 409, 'IDENTITY_ID_MISMATCH');
      if (!record.signer_public_key) return jsonError('Reserved identity has no bound signer public key. Prepare the identity again with its public key before importing.', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');
      if (resultPublicKey !== normalizeHex(record.signer_public_key, 'reserved signer public key')) return jsonError('Provisioning result public key does not match the reserved signer', 409, 'SIGNER_PUBLIC_KEY_MISMATCH');
      if (resultAccountClassHash !== normalizeHex(config.accountClassHash, 'configured account class hash')) return jsonError('Provisioning result account class does not match the verified network', 409, 'ACCOUNT_CLASS_MISMATCH');
      if (resultRegistryAddress !== normalizeAddress(config.identityRegistryAddress, 'configured registry address')) return jsonError('Provisioning result registry address does not match the verified network', 409, 'REGISTRY_MISMATCH');
      if (resultRegistryOwner !== normalizeAddress(config.identityRegistryOwner, 'configured registry owner')) return jsonError('Provisioning result registry owner does not match the verified network', 409, 'REGISTRY_OWNER_MISMATCH');
      if (resultRecoveryController !== expectedRecoveryController || resultRecoveryDelay !== config.recoveryDelaySeconds) return jsonError('Provisioning result recovery policy does not match the verified network', 409, 'RECOVERY_POLICY_MISMATCH');

      const derivedAccountAddress = normalizeAddress(
        hash.calculateContractAddressFromHash(resultPublicKey, resultAccountClassHash, [resultPublicKey], 0),
        'derived account address',
      );
      if (derivedAccountAddress !== resultAccountAddress) {
        return jsonError('Provisioning account address does not derive from the reserved public key and account class', 409, 'ACCOUNT_ADDRESS_DERIVATION_MISMATCH');
      }
      if (record.account_address && normalizeAddress(record.account_address, 'record account address') !== resultAccountAddress) {
        return jsonError('Provisioning result account address conflicts with the existing record', 409, 'ACCOUNT_ADDRESS_MISMATCH');
      }

      await svc.entities.ChainIdentity.update(record.id, {
        account_address: resultAccountAddress,
        signer_public_key: resultPublicKey,
        deployment_tx_hash: deploymentTxHash || record.deployment_tx_hash || '',
        registration_tx_hash: registrationTxHash || record.registration_tx_hash || '',
        status: 'DEPLOYED',
        failure_code: '',
      });
      const updatedRows = await svc.entities.ChainIdentity.filter({ id: record.id }, '-created_date', 1).catch(() => []);
      return Response.json({
        ok: true,
        imported: true,
        identity: safeIdentity(updatedRows?.[0] || { ...record, account_address: resultAccountAddress, status: 'DEPLOYED' }),
        chain_authority_required: true,
        note: 'Public provisioning result accepted and recorded as DEPLOYED. Reconcile From Chain is still required before REGISTERED.',
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
      const currentAgeStatus = await ageEligibilityForUser(svc, String(record.user_id || ''));
      if (!currentAgeStatus.eligible) {
        return jsonError('This user is no longer eligible for SwapPulse Testnet identity provisioning', 403, 'AGE_ELIGIBILITY_REQUIRED');
      }
      if (!['PENDING', 'FAILED'].includes(String(record.status || ''))) {
        return jsonError('Identity is not awaiting deployment', 409, 'INVALID_STATE');
      }

      if (record.account_class_hash && normalizeHex(record.account_class_hash, 'record account_class_hash') !== config.accountClassHash) {
        return jsonError('Reserved identity uses a different account class hash', 409, 'ACCOUNT_CLASS_CHANGED');
      }
      if (record.identity_registry_address && normalizeAddress(record.identity_registry_address, 'record identity_registry_address') !== config.identityRegistryAddress) {
        return jsonError('Reserved identity uses a different IdentityRegistry', 409, 'REGISTRY_CHANGED');
      }
      if (!record.signer_public_key) {
        return jsonError('Reserved identity has no bound signer public key. Prepare the identity again before recording deployment.', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');
      }
      const reservedPublicKey = normalizeHex(record.signer_public_key, 'reserved signer public key');
      const expectedAccountAddress = normalizeAddress(
        hash.calculateContractAddressFromHash(reservedPublicKey, config.accountClassHash, [reservedPublicKey], 0),
        'expected account address',
      );
      if (accountAddress !== expectedAccountAddress) {
        return jsonError('Account address does not derive from the reserved signer public key', 409, 'ACCOUNT_ADDRESS_DERIVATION_MISMATCH');
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
