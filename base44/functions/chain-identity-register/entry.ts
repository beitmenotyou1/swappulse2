import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash } from 'npm:starknet@10.0.2';
import { secrets } from 'base44:runtime';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';

const NETWORK = 'SWAPPULSE_TESTNET';
const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const TIMEOUT_MS = 12_000;

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

function normalizeZeroableHex(value: unknown, field: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n < 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

async function ageEligible(svc: any, userId: string): Promise<boolean> {
  const rows = await svc.entities.AgeStatus.filter({ user_id: userId }, '-updated_date', 5).catch(() => []);
  const row = rows?.[0];
  if (!row || !isAgeBand(row.age_band)) return false;
  const band = row.age_band as AgeBand;
  const method = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  return deriveAgeEligibility(band, method).testnet_identity_eligible;
}

async function getVerifiedConfig(svc: any) {
  const rows = await svc.entities.ChainNetworkConfig.filter({ network: NETWORK }, '-updated_date', 1).catch(() => []);
  const row = rows?.[0];
  if (!row || row.status !== 'CONFIGURED') return null;
  const required = [
    row.chain_id,
    row.account_class_hash,
    row.identity_registry_class_hash,
    row.identity_registry_address,
    row.identity_registry_owner,
    row.rpc_url,
  ];
  if (required.some((value) => !String(value || '').trim())) return null;
  if (
    String(row.verified_chain_id || '').trim() !== String(row.chain_id || '').trim()
    || String(row.verified_identity_registry_class_hash || '').trim() !== String(row.identity_registry_class_hash || '').trim()
    || String(row.verified_identity_registry_owner || '').trim() !== String(row.identity_registry_owner || '').trim()
    || String(row.verified_account_class_hash || '').trim() !== String(row.account_class_hash || '').trim()
    || String(row.verified_rpc_url || '').trim() !== String(row.rpc_url || '').trim()
  ) return null;
  return row;
}

async function safePublicRpc(raw: string): Promise<string> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('PUBLIC_RPC_MUST_USE_HTTPS');
  if (url.username || url.password) throw new Error('PUBLIC_RPC_MUST_NOT_CONTAIN_CREDENTIALS');
  await assertSafeHost(url.hostname);
  return url.toString();
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`PUBLIC_RPC_HTTP_${response.status}`);
    const payload = await response.json();
    if (payload?.error) throw new Error(`PUBLIC_RPC_${method}_${payload.error?.code ?? 'ERROR'}`);
    return payload?.result;
  } finally {
    clearTimeout(timer);
  }
}

async function starknetCall(rpcUrl: string, contractAddress: string, entrypoint: string, calldata: string[] = []): Promise<string[]> {
  const result = await rpcCall(rpcUrl, 'starknet_call', [
    {
      contract_address: normalizeHex(contractAddress, 'contract address'),
      entry_point_selector: hash.getSelectorFromName(entrypoint),
      calldata: calldata.map((value, index) => normalizeZeroableHex(value, `${entrypoint} calldata[${index}]`)),
    },
    'latest',
  ]);
  if (!Array.isArray(result)) throw new Error(`PUBLIC_RPC_${entrypoint}_INVALID`);
  return result.map((value, index) => normalizeZeroableHex(value, `${entrypoint} result[${index}]`));
}

async function relayRegistration(payload: Record<string, string>) {
  const rawUrl = String(secrets.get('SWAPPULSE_TX_RELAY_URL') || '').trim();
  const token = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '');
  if (!rawUrl || token.length < 32) throw new Error('TX_RELAY_NOT_CONFIGURED');
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:') throw new Error('TX_RELAY_URL_MUST_USE_HTTPS');
  if (url.username || url.password) throw new Error('TX_RELAY_URL_MUST_NOT_CONTAIN_CREDENTIALS');
  await assertSafeHost(url.hostname);
  url.pathname = '/register';
  url.search = '';
  url.hash = '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.ok !== true) {
      throw new Error(String(body?.code || body?.error || `TX_RELAY_HTTP_${response.status}`));
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    const svc = base44.asServiceRole;
    if (!(await ageEligible(svc, me.id))) return jsonError('Adult testnet eligibility is required', 403, 'AGE_ELIGIBILITY_REQUIRED');

    const body = await req.json().catch(() => ({}));
    const recordId = String(body.record_id || '').trim();
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');

    const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
    const identity = rows?.[0];
    if (!identity || String(identity.user_id || '') !== String(me.id)) return jsonError('Chain identity not found', 404, 'IDENTITY_NOT_FOUND');
    if (!['PENDING', 'FAILED', 'DEPLOYED'].includes(String(identity.status || ''))) return jsonError('Identity is not awaiting registration', 409, 'INVALID_STATE');
    if (!identity.signer_public_key) return jsonError('Reserved identity has no public signer key', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');

    const publicKey = normalizeHex(identity.signer_public_key, 'reserved public key');
    const accountClassHash = normalizeHex(config.account_class_hash, 'configured account class hash');
    const accountAddress = normalizeHex(
      hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0),
      'derived account address',
    );
    if (identity.account_address && normalizeHex(identity.account_address, 'recorded account address') !== accountAddress) {
      return jsonError('Recorded account address does not match the reserved signer', 409, 'ACCOUNT_ADDRESS_MISMATCH');
    }

    const rpcUrl = await safePublicRpc(String(config.rpc_url));
    const identityId = normalizeHex(identity.chain_identity_id, 'reserved identity id');
    const [accountHashRaw, registryHashRaw, ownerValues, controllerValues, delayValues, identityValues, reverseValues] = await Promise.all([
      rpcCall(rpcUrl, 'starknet_getClassHashAt', ['latest', accountAddress]),
      rpcCall(rpcUrl, 'starknet_getClassHashAt', ['latest', normalizeHex(config.identity_registry_address, 'registry address')]),
      starknetCall(rpcUrl, config.identity_registry_address, 'owner', []),
      starknetCall(rpcUrl, accountAddress, 'get_recovery_controller', []),
      starknetCall(rpcUrl, accountAddress, 'get_recovery_delay', []),
      starknetCall(rpcUrl, config.identity_registry_address, 'get_identity', [identityId]),
      starknetCall(rpcUrl, config.identity_registry_address, 'get_identity_by_account', [accountAddress]),
    ]);

    if (normalizeHex(accountHashRaw, 'deployed account class hash') !== accountClassHash) {
      return jsonError('Deployed account class does not match SwapPulseAccount', 409, 'ACCOUNT_CLASS_MISMATCH');
    }
    if (normalizeHex(registryHashRaw, 'registry class hash') !== normalizeHex(config.identity_registry_class_hash, 'configured registry class hash')) {
      return jsonError('IdentityRegistry class does not match the verified network', 409, 'REGISTRY_CLASS_MISMATCH');
    }
    if (!ownerValues[0] || normalizeHex(ownerValues[0], 'registry owner') !== normalizeHex(config.identity_registry_owner, 'configured registry owner')) {
      return jsonError('IdentityRegistry owner does not match the verified network', 409, 'REGISTRY_OWNER_MISMATCH');
    }

    const expectedController = normalizeZeroableHex(config.recovery_controller || '0x0', 'configured recovery controller');
    const actualController = normalizeZeroableHex(controllerValues?.[0] || '0x0', 'account recovery controller');
    const expectedDelay = Number(config.recovery_delay_seconds ?? 172800);
    const actualDelay = Number(BigInt(delayValues?.[0] || '0x0'));
    if (actualController !== expectedController || actualDelay !== expectedDelay) {
      return jsonError('Account recovery policy is not configured yet', 409, 'RECOVERY_POLICY_NOT_CONFIGURED');
    }

    const chainAccount = normalizeZeroableHex(identityValues?.[0] || '0x0', 'chain identity account');
    const chainStatus = Number(BigInt(identityValues?.[1] || '0x0'));
    const reverseIdentity = normalizeZeroableHex(reverseValues?.[0] || '0x0', 'reverse identity');
    if (chainStatus === 1) {
      if (chainAccount !== accountAddress || reverseIdentity !== identityId) {
        return jsonError('Identity is already registered with a conflicting mapping', 409, 'IDENTITY_MAPPING_CONFLICT');
      }
      await svc.entities.ChainIdentity.update(identity.id, {
        account_address: accountAddress,
        status: 'DEPLOYED',
        failure_code: '',
      });
      return Response.json({
        ok: true,
        identity_id: identityId,
        account_address: accountAddress,
        registration_tx_hash: String(identity.registration_tx_hash || ''),
        idempotent: true,
        status: 'DEPLOYED',
        chain_authority_required: true,
        note: 'Identity is already registered on chain. Public chain reconciliation is still required before REGISTERED.',
      });
    }
    if (chainStatus !== 0) return jsonError('Identity is not available for registration', 409, 'IDENTITY_NOT_AVAILABLE');
    if (reverseIdentity !== '0x0') return jsonError('Smart account is already bound to another identity', 409, 'ACCOUNT_ALREADY_BOUND');

    const result = await relayRegistration({
      identity_id: identityId,
      public_key: publicKey,
      account_address: accountAddress,
    });
    const registrationTxHash = result.transaction_hash ? normalizeHex(result.transaction_hash, 'registration transaction hash') : String(identity.registration_tx_hash || '');

    await svc.entities.ChainIdentity.update(identity.id, {
      account_address: accountAddress,
      registration_tx_hash: registrationTxHash,
      status: 'DEPLOYED',
      failure_code: '',
    });

    return Response.json({
      ok: true,
      identity_id: identityId,
      account_address: accountAddress,
      registration_tx_hash: registrationTxHash,
      idempotent: result.idempotent === true,
      status: 'DEPLOYED',
      chain_authority_required: true,
      note: 'Registration submitted by the host-local registry owner. Public chain reconciliation is still required before REGISTERED.',
    });
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_IDENTITY_REGISTER_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('chain-identity-register failed:', code);
    const clientError = code.includes('NOT_CONFIGURED') || code.includes('MUST_') || code.includes('MISMATCH') || code.includes('REQUIRED') || code.includes('NOT_AVAILABLE') || code.includes('ALREADY_BOUND');
    return jsonError(clientError ? code.replaceAll('_', ' ') : 'Testnet identity registration failed', clientError ? 409 : 502, code);
  }
}
