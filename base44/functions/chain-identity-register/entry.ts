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
  if (required.some((v) => !String(v || '').trim())) return null;
  if (
    String(row.verified_chain_id || '').trim() !== String(row.chain_id || '').trim()
    || String(row.verified_identity_registry_class_hash || '').trim() !== String(row.identity_registry_class_hash || '').trim()
    || String(row.verified_identity_registry_owner || '').trim() !== String(row.identity_registry_owner || '').trim()
    || String(row.verified_account_class_hash || '').trim() !== String(row.account_class_hash || '').trim()
    || String(row.verified_rpc_url || '').trim() !== String(row.rpc_url || '').trim()
  ) return null;
  return row;
}

async function safePublicRpc(rawUrl: string): Promise<string> {
  const url = new URL(rawUrl);
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
      calldata: calldata.map((value, i) => normalizeZeroableHex(value, `${entrypoint} calldata[${i}]`)),
    },
    'latest',
  ]);
  if (!Array.isArray(result)) throw new Error(`PUBLIC_RPC_${entrypoint}_INVALID`);
  return result.map((value, i) => normalizeZeroableHex(value, `${entrypoint} result[${i}]`));
}

async function registrationRelayUrl(): Promise<string> {
  const raw = String(secrets.get('SWAPPULSE_TX_RELAY_URL') || '').trim();
  if (!raw) throw new Error('TX_RELAY_NOT_CONFIGURED');
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('TX_RELAY_URL_MUST_USE_HTTPS');
  if (url.username || url.password) throw new Error('TX_RELAY_URL_MUST_NOT_CONTAIN_CREDENTIALS');
  await assertSafeHost(url.hostname);
  url.pathname = '/register';
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function forwardRegistration(identityId: string, publicKey: string, accountAddress: string) {
  const token = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '');
  if (token.length < 32) throw new Error('TX_RELAY_TOKEN_NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(await registrationRelayUrl(), {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ identity_id: identityId, public_key: publicKey, account_address: accountAddress }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) {
      throw new Error(String(payload?.code || payload?.error || `TX_RELAY_HTTP_${response.status}`));
    }
    return payload;
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
    if (!['PENDING', 'DEPLOYED', 'FAILED'].includes(String(identity.status || ''))) return jsonError('Identity is not awaiting registration', 409, 'INVALID_STATE');
    if (!identity.signer_public_key) return jsonError('Reserved identity has no public signer key', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');

    const identityId = normalizeHex(identity.chain_identity_id, 'identity id');
    const publicKey = normalizeHex(identity.signer_public_key, 'reserved public key');
    const accountClassHash = normalizeHex(config.account_class_hash, 'configured account class hash');
    const accountAddress = normalizeHex(
      hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0),
      'derived account address',
    );
    if (identity.account_address && normalizeHex(identity.account_address, 'recorded account address') !== accountAddress) {
      return jsonError('Recorded account address does not match the reserved signer', 409, 'ACCOUNT_ADDRESS_MISMATCH');
    }

    const rpcUrl = await safePublicRpc(String(config.rpc_url || ''));
    const registryAddress = normalizeHex(config.identity_registry_address, 'registry address');
    const expectedRegistryClass = normalizeHex(config.identity_registry_class_hash, 'registry class hash');
    const expectedRegistryOwner = normalizeHex(config.identity_registry_owner, 'registry owner');
    const expectedController = normalizeZeroableHex(config.recovery_controller || '0x0', 'recovery controller');
    const expectedDelay = Number(config.recovery_delay_seconds ?? 172800);

    const [actualAccountClassRaw, actualRegistryClassRaw, ownerValues, controllerValues, delayValues] = await Promise.all([
      rpcCall(rpcUrl, 'starknet_getClassHashAt', ['latest', accountAddress]),
      rpcCall(rpcUrl, 'starknet_getClassHashAt', ['latest', registryAddress]),
      starknetCall(rpcUrl, registryAddress, 'owner', []),
      starknetCall(rpcUrl, accountAddress, 'get_recovery_controller', []),
      starknetCall(rpcUrl, accountAddress, 'get_recovery_delay', []),
    ]);

    if (normalizeHex(actualAccountClassRaw, 'deployed account class') !== accountClassHash) return jsonError('Deployed account class does not match SwapPulseAccount', 409, 'ACCOUNT_CLASS_MISMATCH');
    if (normalizeHex(actualRegistryClassRaw, 'deployed registry class') !== expectedRegistryClass) return jsonError('IdentityRegistry class no longer matches verified configuration', 409, 'REGISTRY_CLASS_MISMATCH');
    if (!ownerValues[0] || normalizeHex(ownerValues[0], 'deployed registry owner') !== expectedRegistryOwner) return jsonError('IdentityRegistry owner no longer matches verified configuration', 409, 'REGISTRY_OWNER_MISMATCH');
    if (normalizeZeroableHex(controllerValues?.[0] || '0x0', 'deployed recovery controller') !== expectedController) return jsonError('Recovery controller is not configured correctly', 409, 'RECOVERY_CONTROLLER_MISMATCH');
    if (Number(BigInt(delayValues?.[0] || '0x0')) !== expectedDelay) return jsonError('Recovery delay is not configured correctly', 409, 'RECOVERY_DELAY_MISMATCH');

    const result = await forwardRegistration(identityId, publicKey, accountAddress);
    const returnedIdentity = normalizeHex(result.identity_id, 'relay identity id');
    const returnedAccount = normalizeHex(result.account_address, 'relay account address');
    if (returnedIdentity !== identityId || returnedAccount !== accountAddress) return jsonError('Registration relay returned unexpected identity coordinates', 502, 'RELAY_REGISTRATION_MISMATCH');
    const idempotent = result.idempotent === true;
    const txHash = result.transaction_hash ? normalizeHex(result.transaction_hash, 'registration transaction hash') : '';
    if (!idempotent && !txHash) return jsonError('Relay response did not include a registration transaction hash', 502, 'RELAY_TX_HASH_MISSING');

    await svc.entities.ChainIdentity.update(identity.id, {
      account_address: accountAddress,
      registration_tx_hash: txHash || identity.registration_tx_hash || '',
      status: 'DEPLOYED',
      failure_code: '',
    });

    return Response.json({
      ok: true,
      identity_id: identityId,
      account_address: accountAddress,
      transaction_hash: txHash,
      idempotent,
      chain_authority_required: true,
      note: 'Registration submitted by the host-local registry owner. Chain reconciliation is still required before REGISTERED.',
    });
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_IDENTITY_REGISTER_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('chain-identity-register failed:', code);
    const clientError = code.includes('NOT_CONFIGURED') || code.includes('MUST_') || code.includes('MISMATCH') || code.includes('REQUIRED') || code.includes('INVALID_STATE');
    return jsonError(clientError ? code.replaceAll('_', ' ') : 'Testnet identity registration failed', clientError ? 409 : 502, code);
  }
}
