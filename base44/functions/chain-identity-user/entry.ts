import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash } from 'npm:starknet@10.0.2';
import { secrets } from 'base44:runtime';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';
import { AGE_POLICY_VERSION, deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';

const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ACTIVE_STATUSES = new Set(['PENDING', 'DEPLOYED', 'REGISTERED', 'RECOVERY_PENDING', 'RECOVERED']);
const RELAY_READY_TIMEOUT_MS = 5_000;
const RELAY_READY_CACHE_MS = 30_000;
let relayReadyCache: { key: string; expires_at: number; value: any } | null = null;

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

function findForbiddenResultKey(value: unknown, path = 'result'): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findForbiddenResultKey(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  const forbidden = /(private[_-]?key|mnemonic|seed[_-]?phrase|password|secret|credential|bearer|api[_-]?key)/i;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.test(key)) return `${path}.${key}`;
    const found = findForbiddenResultKey(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function normalizeZeroableHex(value: unknown, field: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n < 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

function randomIdentityId(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  const n = BigInt(`0x${hex}`);
  return `0x${(n === 0n ? 1n : n).toString(16)}`;
}

async function uniqueIdentityId(svc: any): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomIdentityId();
    const existing = await svc.entities.ChainIdentity
      .filter({ chain_identity_id: candidate }, '-created_date', 1)
      .catch(() => []);
    if (!existing?.length) return candidate;
  }
  throw new Error('Could not allocate unique chain identity id');
}

async function getAgeEligibility(svc: any, userId: string) {
  const rows = await svc.entities.AgeStatus.filter({ user_id: userId }, '-updated_date', 5).catch(() => []);
  const row = rows?.[0] || null;
  if (!row || !isAgeBand(row.age_band)) {
    return {
      declared: false,
      age_band: '',
      method: '',
      eligible: false,
      policy_version: AGE_POLICY_VERSION,
      revision: 0,
      chain_attestable: false,
    };
  }
  const ageBand = row.age_band as AgeBand;
  const method = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  const verifierStatus = ['PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED'].includes(String(row.verifier_status || ''))
    ? String(row.verifier_status)
    : 'NONE';
  const verifierExpiry = String(row.verifier_expires_at || '').trim();
  const verifierCurrent = method === 'THIRD_PARTY_VERIFIED'
    && verifierStatus === 'VERIFIED'
    && (!verifierExpiry || new Date(verifierExpiry).getTime() > Date.now());
  const eligibility = deriveAgeEligibility(ageBand, verifierCurrent ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED');
  return {
    declared: true,
    age_band: ageBand,
    method,
    verifier_status: verifierStatus,
    verifier_expires_at: verifierExpiry,
    eligible: eligibility.testnet_identity_eligible,
    testnet_wallet_eligible: eligibility.testnet_wallet_eligible,
    value_features_eligible: eligibility.value_features_eligible,
    policy_version: String(row.policy_version || AGE_POLICY_VERSION),
    revision: Math.max(1, Number(row.revision || 1)),
    chain_attestable: verifierCurrent && eligibility.testnet_identity_eligible,
  };
}

async function getNetwork(svc: any) {
  const rows = await svc.entities.ChainNetworkConfig
    .filter({ network: 'SWAPPULSE_TESTNET' }, '-updated_date', 1)
    .catch(() => []);
  const row = rows?.[0] || null;
  const chainId = String(row?.chain_id || '').trim();
  const accountClassHash = String(row?.account_class_hash || '').trim();
  const registryClassHash = String(row?.identity_registry_class_hash || '').trim();
  const registryAddress = String(row?.identity_registry_address || '').trim();
  const registryOwner = String(row?.identity_registry_owner || '').trim();
  const identityVerifierAddress = String(row?.identity_verifier_address || '').trim();
  const identityVerificationMode = String(row?.identity_verification_mode || 'V1').trim().toUpperCase();
  const rpcUrl = String(row?.rpc_url || '').trim();
  const status = String(row?.status || 'UNCONFIGURED');
  const ready = status === 'CONFIGURED'
    && Boolean(chainId && accountClassHash && registryClassHash && registryAddress && registryOwner && identityVerifierAddress && rpcUrl)
    && String(row?.verified_chain_id || '').trim() === chainId
    && String(row?.verified_identity_registry_class_hash || '').trim() === registryClassHash
    && String(row?.verified_identity_registry_owner || '').trim() === registryOwner
    && String(row?.verified_identity_verifier_address || '').trim() === identityVerifierAddress
    && String(row?.verified_identity_verification_mode || '').trim().toUpperCase() === identityVerificationMode
    && String(row?.verified_account_class_hash || '').trim() === accountClassHash
    && String(row?.verified_rpc_url || '').trim() === rpcUrl;
  return {
    ready,
    status,
    chain_id: chainId,
    account_class_hash: accountClassHash,
    identity_registry_class_hash: registryClassHash,
    identity_registry_address: registryAddress,
    identity_registry_owner: registryOwner,
    identity_verifier_address: identityVerifierAddress,
    identity_verification_mode: identityVerificationMode,
    recovery_controller: String(row?.recovery_controller || '').trim(),
    recovery_delay_seconds: Number(row?.recovery_delay_seconds ?? 172800),
  };
}

async function relayAutomationStatus(network: any) {
  const rawUrl = String(secrets.get('SWAPPULSE_TX_RELAY_URL') || '').trim();
  const token = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '');
  const configured = Boolean(rawUrl && token.length >= 32);
  if (!configured) return { configured: false, verified: false, code: 'TX_RELAY_NOT_CONFIGURED' };

  const tokenDigest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const cacheKey = [
    rawUrl,
    tokenDigest,
    network.chain_id,
    network.account_class_hash,
    network.identity_registry_class_hash,
    network.identity_registry_address,
    network.identity_registry_owner,
    network.identity_verifier_address,
    network.identity_verification_mode,
    network.recovery_controller || '0x0',
    network.recovery_delay_seconds,
  ].join('|');
  if (relayReadyCache && relayReadyCache.key === cacheKey && relayReadyCache.expires_at > Date.now()) {
    return relayReadyCache.value;
  }

  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') throw new Error('TX_RELAY_URL_MUST_USE_HTTPS');
    if (url.username || url.password) throw new Error('TX_RELAY_URL_MUST_NOT_CONTAIN_CREDENTIALS');
    await assertSafeHost(url.hostname);
    url.pathname = '/readyz';
    url.search = '';
    url.hash = '';

    controller = new AbortController();
    timer = setTimeout(() => controller?.abort(), RELAY_READY_TIMEOUT_MS);
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'error',
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) {
      throw new Error(String(payload?.code || `TX_RELAY_READY_HTTP_${response.status}`));
    }
    if (String(payload?.purpose || '') !== 'swappulse-testnet-provisioning-relay') throw new Error('TX_RELAY_PURPOSE_MISMATCH');
    if (normalizeHex(payload.chain_id, 'relay chain id') !== normalizeHex(network.chain_id, 'verified chain id')) throw new Error('TX_RELAY_CHAIN_ID_MISMATCH');
    if (normalizeHex(payload.account_class_hash, 'relay account class hash') !== normalizeHex(network.account_class_hash, 'verified account class hash')) throw new Error('TX_RELAY_ACCOUNT_CLASS_MISMATCH');
    if (normalizeHex(payload.identity_registry_class_hash, 'relay registry class hash') !== normalizeHex(network.identity_registry_class_hash, 'verified registry class hash')) throw new Error('TX_RELAY_REGISTRY_CLASS_MISMATCH');
    if (normalizeHex(payload.identity_registry_address, 'relay registry address') !== normalizeHex(network.identity_registry_address, 'verified registry address')) throw new Error('TX_RELAY_REGISTRY_ADDRESS_MISMATCH');
    if (normalizeHex(payload.identity_registry_owner, 'relay registry owner') !== normalizeHex(network.identity_registry_owner, 'verified registry owner')) throw new Error('TX_RELAY_REGISTRY_OWNER_MISMATCH');
    if (normalizeHex(payload.identity_verifier_address, 'relay identity verifier') !== normalizeHex(network.identity_verifier_address, 'verified identity verifier')) throw new Error('TX_RELAY_IDENTITY_VERIFIER_MISMATCH');
    if (String(payload.identity_verification_mode || '').trim().toUpperCase() !== String(network.identity_verification_mode || '').trim().toUpperCase()) throw new Error('TX_RELAY_IDENTITY_VERIFICATION_MODE_MISMATCH');
    if (normalizeZeroableHex(payload.recovery_controller ?? '0x0', 'relay recovery controller') !== normalizeZeroableHex(network.recovery_controller || '0x0', 'verified recovery controller')) throw new Error('TX_RELAY_RECOVERY_CONTROLLER_MISMATCH');
    if (Number(payload.recovery_delay_seconds) !== Number(network.recovery_delay_seconds)) throw new Error('TX_RELAY_RECOVERY_DELAY_MISMATCH');

    const value = { configured: true, verified: true, code: 'READY' };
    relayReadyCache = { key: cacheKey, expires_at: Date.now() + RELAY_READY_CACHE_MS, value };
    return value;
  } catch (error: any) {
    const rawCode = error?.name === 'AbortError' ? 'TX_RELAY_READY_TIMEOUT' : String(error?.message || 'TX_RELAY_READY_FAILED');
    const code = rawCode.replace(/[^A-Za-z0-9_:-]/g, '_').slice(0, 120);
    const value = { configured: true, verified: false, code };
    relayReadyCache = { key: cacheKey, expires_at: Date.now() + 5_000, value };
    return value;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safeIdentity(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    chain_identity_id: row.chain_identity_id,
    account_address: row.account_address || '',
    network: row.network || 'SWAPPULSE_TESTNET',
    signer_public_key: row.signer_public_key || '',
    signer_version: row.signer_version || 'STARK_V1',
    status: row.status || 'PENDING',
    canonical_identity_id: row.canonical_identity_id || row.chain_identity_id,
    recovery_count: Number(row.recovery_count || 0),
    created_at: row.created_at || row.created_date || '',
    last_reconciled_at: row.last_reconciled_at || '',
    failure_code: row.failure_code || '',
    age_policy_version: row.age_policy_version || '',
    eligibility_basis: row.eligibility_basis || '',
    verification_tx_hash: row.verification_tx_hash || '',
    verification_revoke_tx_hash: row.verification_revoke_tx_hash || '',
    verification_root: row.verification_root || '',
    verification_schema_hash: row.verification_schema_hash || '',
    verification_status: row.verification_status || 'NONE',
    verification_type: Number(row.verification_type || 0),
    verification_level: Number(row.verification_level || 0),
    verification_attestation_id: row.verification_attestation_id || '',
    verification_attested_by: row.verification_attested_by || '',
    verification_verified_at: Number(row.verification_verified_at || 0),
    verification_expires_at: Number(row.verification_expires_at || 0),
    verification_revoked_at: Number(row.verification_revoked_at || 0),
    verification_version: Number(row.verification_version || 0),
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me) return jsonError('Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');
    const svc = base44.asServiceRole;
    const [age, network, identities] = await Promise.all([
      getAgeEligibility(svc, me.id),
      getNetwork(svc),
      svc.entities.ChainIdentity.filter({ user_id: me.id }, '-created_date', 20).catch(() => []),
    ]);
    const current = identities.find((row: any) => ACTIVE_STATUSES.has(String(row?.status || ''))) || null;

    if (action === 'status') {
      const relay = age.eligible && network.ready
        ? await relayAutomationStatus(network)
        : { configured: false, verified: false, code: age.eligible ? 'CHAIN_NOT_CONFIGURED' : 'AGE_ELIGIBILITY_REQUIRED' };
      return Response.json({
        ok: true,
        age,
        network: {
          ready: network.ready,
          status: network.status,
          chain_id: network.ready ? network.chain_id : '',
          identity_verification_mode: network.ready ? network.identity_verification_mode : '',
        },
        identity: safeIdentity(current),
        can_prepare: Boolean(age.eligible && network.ready && !current),
        provisioning: current && network.ready && current.signer_public_key ? {
          schema_version: 1,
          kind: 'SWAPPULSE_TEST_IDENTITY_PROVISIONING_REQUEST',
          network: 'SWAPPULSE_TESTNET',
          chain_id: network.chain_id,
          identity_id: current.chain_identity_id,
          public_key: current.signer_public_key,
          account_class_hash: network.account_class_hash,
          identity_registry_address: network.identity_registry_address,
          recovery_controller: network.recovery_controller || '0x0',
          recovery_delay_seconds: network.recovery_delay_seconds,
        } : null,
        relay,
        automation_ready: Boolean(age.eligible && network.ready && relay.verified),
        private_key_required_by_base44: false,
      });
    }

    if (action === 'import_provisioning_result') {
      if (!age.eligible) {
        return jsonError('Your account is not currently eligible for SwapPulse Testnet identity provisioning', 403, 'AGE_ELIGIBILITY_REQUIRED');
      }
      if (!network.ready) return jsonError('SwapPulse Testnet is not independently verified and ready yet', 409, 'CHAIN_NOT_CONFIGURED');

      const recordId = String(body.record_id || '').trim();
      if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');
      const record = identities.find((row: any) => String(row?.id || '') === recordId);
      if (!record) return jsonError('Chain identity not found for this account', 404, 'IDENTITY_NOT_FOUND');
      if (!['PENDING', 'FAILED', 'DEPLOYED'].includes(String(record.status || ''))) {
        return jsonError('This identity is no longer in a provisioning state', 409, 'INVALID_STATE');
      }

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
      const forbiddenPath = findForbiddenResultKey(result, 'provisioning_result');
      if (forbiddenPath) {
        return jsonError(`Provisioning result contains a forbidden secret-like field at ${forbiddenPath}`, 400, 'PROVISIONING_RESULT_CONTAINS_SECRET');
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
        resultAccountAddress = normalizeHex(result.account_address, 'result account_address');
        resultAccountClassHash = normalizeHex(result.account_class_hash, 'result account_class_hash');
        resultRegistryAddress = normalizeHex(result.identity_registry_address, 'result identity_registry_address');
        resultRegistryOwner = normalizeHex(result.identity_registry_owner, 'result identity_registry_owner');
        resultRecoveryController = normalizeZeroableHex(result.recovery_controller ?? '0x0', 'result recovery_controller');
        if (result.transactions?.account_deploy) deploymentTxHash = normalizeHex(result.transactions.account_deploy, 'account_deploy tx hash');
        if (result.transactions?.identity_register) registrationTxHash = normalizeHex(result.transactions.identity_register, 'identity_register tx hash');
      } catch (e: any) {
        return jsonError(e?.message || 'Invalid provisioning result fields', 400, 'INVALID_PROVISIONING_RESULT');
      }

      const expectedRecoveryController = normalizeZeroableHex(network.recovery_controller || '0x0', 'configured recovery controller');
      const resultRecoveryDelay = Number(result.recovery_delay_seconds);
      if (!Number.isInteger(resultRecoveryDelay)) return jsonError('Provisioning recovery_delay_seconds must be an integer', 400, 'INVALID_PROVISIONING_RESULT');
      if (resultChainId !== normalizeHex(network.chain_id, 'configured chain id')) return jsonError('Provisioning result chain ID does not match the verified network', 409, 'CHAIN_ID_MISMATCH');
      if (resultIdentityId !== normalizeHex(record.chain_identity_id, 'reserved identity id')) return jsonError('Provisioning result identity ID does not match your reservation', 409, 'IDENTITY_ID_MISMATCH');
      if (!record.signer_public_key) return jsonError('Reserved identity has no bound public key', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');
      if (resultPublicKey !== normalizeHex(record.signer_public_key, 'reserved signer public key')) return jsonError('Provisioning result public key does not match your reserved signer', 409, 'SIGNER_PUBLIC_KEY_MISMATCH');
      if (resultAccountClassHash !== normalizeHex(network.account_class_hash, 'configured account class hash')) return jsonError('Provisioning result account class does not match the verified network', 409, 'ACCOUNT_CLASS_MISMATCH');
      if (resultRegistryAddress !== normalizeHex(network.identity_registry_address, 'configured registry address')) return jsonError('Provisioning result registry does not match the verified network', 409, 'REGISTRY_MISMATCH');
      if (resultRegistryOwner !== normalizeHex(network.identity_registry_owner, 'configured registry owner')) return jsonError('Provisioning result registry owner does not match the verified network', 409, 'REGISTRY_OWNER_MISMATCH');
      if (resultRecoveryController !== expectedRecoveryController || resultRecoveryDelay !== network.recovery_delay_seconds) return jsonError('Provisioning result recovery policy does not match the verified network', 409, 'RECOVERY_POLICY_MISMATCH');

      const derivedAccountAddress = normalizeHex(
        hash.calculateContractAddressFromHash(resultPublicKey, resultAccountClassHash, [resultPublicKey], 0),
        'derived account address',
      );
      if (derivedAccountAddress !== resultAccountAddress) {
        return jsonError('Provisioning account address does not derive from your reserved public key and account class', 409, 'ACCOUNT_ADDRESS_DERIVATION_MISMATCH');
      }
      if (record.account_address && normalizeHex(record.account_address, 'existing account address') !== resultAccountAddress) {
        return jsonError('Provisioning result conflicts with the account address already recorded', 409, 'ACCOUNT_ADDRESS_MISMATCH');
      }

      await svc.entities.ChainIdentity.update(record.id, {
        account_address: resultAccountAddress,
        deployment_tx_hash: deploymentTxHash || record.deployment_tx_hash || '',
        registration_tx_hash: registrationTxHash || record.registration_tx_hash || '',
        status: 'DEPLOYED',
        failure_code: '',
      });
      const refreshed = await svc.entities.ChainIdentity.filter({ id: record.id }, '-created_date', 1).catch(() => []);
      return Response.json({
        ok: true,
        imported: true,
        identity: safeIdentity(refreshed?.[0] || { ...record, account_address: resultAccountAddress, status: 'DEPLOYED' }),
        chain_authority_required: true,
        note: 'Public provisioning result accepted as DEPLOYED. Chain reconciliation is still required before REGISTERED.',
      });
    }

    if (action !== 'prepare') return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
    if (!age.eligible) {
      return jsonError('You must have an eligible 18+ AgeStatus before preparing a SwapPulse Testnet identity', 403, 'AGE_ELIGIBILITY_REQUIRED');
    }
    if (!network.ready) {
      return jsonError('SwapPulse Testnet is not independently verified and ready yet', 409, 'CHAIN_NOT_CONFIGURED');
    }

    let publicKey: string;
    try {
      publicKey = normalizeHex(body.public_key, 'public_key');
    } catch (e: any) {
      return jsonError(e?.message || 'Invalid public key', 400, 'INVALID_PUBLIC_KEY');
    }

    if (current) {
      if (String(current.status || '') === 'PENDING') {
        const existingKey = String(current.signer_public_key || '').trim();
        if (existingKey && normalizeHex(existingKey, 'reserved signer_public_key') !== publicKey) {
          return jsonError('Your pending identity is already bound to a different public key', 409, 'SIGNER_PUBLIC_KEY_MISMATCH');
        }
        if (!existingKey || !current.age_policy_version || !current.eligibility_basis) {
          await svc.entities.ChainIdentity.update(current.id, {
            ...(existingKey ? {} : { signer_public_key: publicKey }),
            age_policy_version: age.policy_version || AGE_POLICY_VERSION,
            eligibility_basis: age.method || 'SELF_DECLARED',
            failure_code: '',
          });
        }
        const refreshed = await svc.entities.ChainIdentity.filter({ id: current.id }, '-created_date', 1).catch(() => []);
        return Response.json({ ok: true, existing: true, identity: safeIdentity(refreshed?.[0] || { ...current, signer_public_key: publicKey }) });
      }
      return Response.json({ ok: true, existing: true, identity: safeIdentity(current) });
    }

    const identityId = await uniqueIdentityId(svc);
    const now = new Date().toISOString();
    const record = await svc.entities.ChainIdentity.create({
      user_id: me.id,
      chain_identity_id: identityId,
      network: 'SWAPPULSE_TESTNET',
      account_class_hash: network.account_class_hash,
      identity_registry_address: network.identity_registry_address,
      age_policy_version: age.policy_version || AGE_POLICY_VERSION,
      eligibility_basis: age.method || 'SELF_DECLARED',
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
      identity: safeIdentity(record),
      provisioning: {
        network: 'SWAPPULSE_TESTNET',
        chain_id: network.chain_id,
        account_class_hash: network.account_class_hash,
        identity_registry_address: network.identity_registry_address,
        public_key: publicKey,
        recovery_controller: network.recovery_controller || '0x0',
        recovery_delay_seconds: network.recovery_delay_seconds,
      },
      note: 'Identity reserved. Base44 received only the public Stark key. Deployment/signing remains outside Base44.',
    });
  } catch (e: any) {
    console.error('chain-identity-user failed', e?.message || e);
    return Response.json({ error: 'Unable to prepare chain identity' }, { status: 500 });
  }
}
