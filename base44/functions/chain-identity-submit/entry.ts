import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash, transaction } from 'npm:starknet@10.0.2';
import { secrets } from 'base44:runtime';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';

const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const RELAY_TIMEOUT_MS = 10_000;

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

function normalizeArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.map((item, i) => normalizeZeroableHex(item, `${field}[${i}]`));
}

function sameFelts(a: unknown, b: unknown): boolean {
  const left = normalizeArray(a, 'calldata');
  const right = normalizeArray(b, 'expected calldata');
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

function findForbiddenKey(value: unknown, path = 'request'): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findForbiddenKey(value[i], `${path}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  const forbidden = /(private[_-]?key|mnemonic|seed[_-]?phrase|password|credential|bearer|api[_-]?key)/i;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.test(key)) return `${path}.${key}`;
    const found = findForbiddenKey(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

async function ageEligible(svc: any, userId: string): Promise<boolean> {
  const rows = await svc.entities.AgeStatus.filter({ user_id: userId }, '-updated_date', 5).catch(() => []);
  const row = rows?.[0];
  if (!row || !isAgeBand(row.age_band)) return false;
  const band = row.age_band as AgeBand;
  const method = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  return deriveAgeEligibility(band, method).testnet_identity_eligible;
}

async function networkConfig(svc: any) {
  const rows = await svc.entities.ChainNetworkConfig
    .filter({ network: 'SWAPPULSE_TESTNET' }, '-updated_date', 1)
    .catch(() => []);
  const row = rows?.[0] || null;
  if (!row || row.status !== 'CONFIGURED') return null;
  const required = [
    'chain_id',
    'account_class_hash',
    'identity_registry_class_hash',
    'identity_registry_address',
    'identity_registry_owner',
    'rpc_url',
  ];
  if (required.some((field) => !String(row?.[field] || '').trim())) return null;
  if (
    String(row.verified_chain_id || '').trim() !== String(row.chain_id || '').trim()
    || String(row.verified_identity_registry_class_hash || '').trim() !== String(row.identity_registry_class_hash || '').trim()
    || String(row.verified_identity_registry_owner || '').trim() !== String(row.identity_registry_owner || '').trim()
    || String(row.verified_account_class_hash || '').trim() !== String(row.account_class_hash || '').trim()
    || String(row.verified_rpc_url || '').trim() !== String(row.rpc_url || '').trim()
  ) return null;
  return row;
}

async function safeRelayUrl(raw: string): Promise<string> {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Transaction relay URL must use HTTPS');
  if (url.username || url.password) throw new Error('Transaction relay URL must not contain credentials');
  await assertSafeHost(url.hostname);
  if (url.pathname === '/' || !url.pathname) url.pathname = '/rpc';
  return url.toString();
}

function validateCommonV3(tx: any, expectedType: string) {
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) throw new Error('transaction is required');
  if (tx.type && String(tx.type) !== expectedType) throw new Error('transaction type does not match RPC method');
  if (normalizeHex(tx.version, 'version') !== '0x3') throw new Error('Only Starknet V3 transactions are accepted');
  const sig = normalizeArray(tx.signature, 'signature');
  if (sig.length !== 2) throw new Error('Stark signature must contain exactly two felts');
  if (tx.paymaster_data && normalizeArray(tx.paymaster_data, 'paymaster_data').length !== 0) throw new Error('paymaster_data is not allowed');
  if (BigInt(normalizeZeroableHex(tx.tip ?? '0x0', 'tip')) !== 0n) throw new Error('Non-zero transaction tips are not allowed');
}

function validateDeploy(tx: any, record: any, config: any) {
  validateCommonV3(tx, 'DEPLOY_ACCOUNT');
  if (normalizeZeroableHex(tx.nonce ?? '0x0', 'nonce') !== '0x0') throw new Error('Deploy-account nonce must be zero');
  const reservedPublicKey = normalizeHex(record.signer_public_key, 'reserved public key');
  const classHash = normalizeHex(config.account_class_hash, 'configured account class hash');
  if (normalizeHex(tx.class_hash, 'class_hash') !== classHash) throw new Error('Deploy-account class hash does not match SwapPulseAccount');
  const constructor = normalizeArray(tx.constructor_calldata, 'constructor_calldata');
  if (constructor.length !== 1 || constructor[0] !== reservedPublicKey) throw new Error('Deploy constructor must contain the reserved public key only');
  if (normalizeHex(tx.contract_address_salt, 'contract_address_salt') !== reservedPublicKey) throw new Error('Deploy salt must equal the reserved public key');
  return normalizeHex(
    hash.calculateContractAddressFromHash(reservedPublicKey, classHash, [reservedPublicKey], 0),
    'derived account address',
  );
}

function validateRecoveryInvoke(tx: any, record: any, config: any) {
  validateCommonV3(tx, 'INVOKE');
  if (tx.account_deployment_data && normalizeArray(tx.account_deployment_data, 'account_deployment_data').length !== 0) {
    throw new Error('account_deployment_data is not allowed');
  }
  const publicKey = normalizeHex(record.signer_public_key, 'reserved public key');
  const classHash = normalizeHex(config.account_class_hash, 'configured account class hash');
  const accountAddress = normalizeHex(
    hash.calculateContractAddressFromHash(publicKey, classHash, [publicKey], 0),
    'derived account address',
  );
  if (normalizeHex(tx.sender_address, 'sender_address') !== accountAddress) throw new Error('Invoke sender is not the reserved SwapPulse account');
  const recoveryController = normalizeZeroableHex(config.recovery_controller || '0x0', 'recovery controller');
  const recoveryDelay = Number(config.recovery_delay_seconds ?? 172800);
  const expected = transaction.getExecuteCalldata([
    { contractAddress: accountAddress, entrypoint: 'set_recovery_controller', calldata: [recoveryController] },
    { contractAddress: accountAddress, entrypoint: 'set_recovery_delay', calldata: [String(recoveryDelay)] },
  ], '1');
  if (!sameFelts(tx.calldata, expected)) throw new Error('Invoke calldata is not the approved recovery configuration');
  return accountAddress;
}

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    const svc = base44.asServiceRole;
    if (!(await ageEligible(svc, me.id))) return jsonError('18+ testnet eligibility is required', 403, 'AGE_ELIGIBILITY_REQUIRED');

    const body = await req.json().catch(() => ({}));
    const forbiddenPath = findForbiddenKey(body);
    if (forbiddenPath) return jsonError(`Secret-like field is not allowed at ${forbiddenPath}`, 400, 'SECRET_FIELD_REJECTED');

    const recordId = String(body.record_id || '').trim();
    const rpcMethod = String(body.rpc_method || '').trim();
    const tx = body.transaction;
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');
    if (!['starknet_addDeployAccountTransaction', 'starknet_addInvokeTransaction'].includes(rpcMethod)) {
      return jsonError('RPC method is not allowed for self-service provisioning', 403, 'RPC_METHOD_NOT_ALLOWED');
    }

    const [config, rows] = await Promise.all([
      networkConfig(svc),
      svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []),
    ]);
    if (!config) return jsonError('SwapPulse Testnet verification is stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    const record = rows?.[0];
    if (!record || String(record.user_id || '') !== String(me.id)) return jsonError('Chain identity not found for this account', 404, 'IDENTITY_NOT_FOUND');
    if (!['PENDING', 'DEPLOYED'].includes(String(record.status || ''))) return jsonError('Identity is not in a self-service provisioning state', 409, 'INVALID_STATE');
    if (!record.signer_public_key) return jsonError('Identity has no reserved public signer key', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');

    const accountAddress = rpcMethod === 'starknet_addDeployAccountTransaction'
      ? validateDeploy(tx, record, config)
      : validateRecoveryInvoke(tx, record, config);
    if (record.account_address && normalizeHex(record.account_address, 'record account address') !== accountAddress) {
      return jsonError('Transaction account conflicts with the identity record', 409, 'ACCOUNT_ADDRESS_MISMATCH');
    }

    const relayUrlRaw = String(secrets.get('SWAPPULSE_TX_RELAY_URL') || '').trim();
    const relayToken = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '').trim();
    if (!relayUrlRaw || relayToken.length < 32) return jsonError('Testnet transaction relay is not configured', 503, 'TX_RELAY_NOT_CONFIGURED');
    const relayUrl = await safeRelayUrl(relayUrlRaw);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
    try {
      const params = rpcMethod === 'starknet_addDeployAccountTransaction'
        ? { deploy_account_transaction: tx }
        : { invoke_transaction: tx };
      const response = await fetch(relayUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${relayToken}`,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: rpcMethod, params }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) return jsonError('Transaction relay rejected the request', response.status >= 400 && response.status < 500 ? response.status : 502, payload?.code || 'TX_RELAY_REJECTED');
      if (!payload || payload.error) {
        return Response.json({
          ok: false,
          relay_error: payload?.error || { message: 'Invalid transaction relay response' },
        }, { status: 400 });
      }
      return Response.json({
        ok: true,
        rpc_method: rpcMethod,
        account_address: accountAddress,
        result: payload.result || null,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error: any) {
    const message = String(error?.message || 'Transaction submission failed').slice(0, 200);
    console.warn('chain-identity-submit rejected:', message);
    return Response.json({ error: message }, { status: 400 });
  }
}
