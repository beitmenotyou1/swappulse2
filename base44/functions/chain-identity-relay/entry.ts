import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash, transaction } from 'npm:starknet@10.0.2';
import { secrets } from 'base44:runtime';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';

const NETWORK = 'SWAPPULSE_TESTNET';
const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const RELAY_TIMEOUT_MS = 12_000;

function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function normalizeHex(value: unknown, field = 'felt'): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n <= 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

function normalizeZeroableHex(value: unknown, field = 'felt'): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n < 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

function normalizeArray(values: unknown, field: string): string[] {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array`);
  return values.map((value, index) => normalizeZeroableHex(value, `${field}[${index}]`));
}

function sameFelts(left: unknown[], right: unknown[]): boolean {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => normalizeZeroableHex(value) === normalizeZeroableHex(right[index]));
}

function extractTransaction(body: any): any {
  const tx = body?.transaction;
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) throw new Error('transaction is required');
  return tx;
}

function validateCommonV3(tx: any, expectedType: string) {
  if (tx.type && String(tx.type) !== expectedType) throw new Error('Wrong transaction type');
  if (normalizeHex(tx.version, 'version') !== '0x3') throw new Error('Only Starknet v3 transactions are accepted');
  const signature = normalizeArray(tx.signature, 'signature');
  if (signature.length !== 2) throw new Error('Stark signature must contain exactly two felts');
  if (tx.paymaster_data && normalizeArray(tx.paymaster_data, 'paymaster_data').length !== 0) {
    throw new Error('Paymaster data is not allowed');
  }
  if (BigInt(normalizeZeroableHex(tx.tip ?? '0x0', 'tip')) !== 0n) throw new Error('Non-zero tips are not allowed');
}

async function ageEligible(svc: any, userId: string): Promise<boolean> {
  const rows = await svc.entities.AgeStatus.filter({ user_id: userId }, '-updated_date', 5).catch(() => []);
  const row = rows?.[0];
  if (!row || !isAgeBand(row.age_band)) return false;
  const band = row.age_band as AgeBand;
  const method = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  return deriveAgeEligibility(band, method).testnet_identity_eligible;
}

async function verifiedNetwork(svc: any) {
  const rows = await svc.entities.ChainNetworkConfig.filter({ network: NETWORK }, '-updated_date', 1).catch(() => []);
  const row = rows?.[0];
  if (!row || row.status !== 'CONFIGURED') throw new Error('CHAIN_NOT_CONFIGURED');
  const required = [
    row.chain_id,
    row.account_class_hash,
    row.identity_registry_class_hash,
    row.identity_registry_address,
    row.identity_registry_owner,
    row.rpc_url,
  ];
  if (required.some((value) => !String(value || '').trim())) throw new Error('CHAIN_CONFIG_INCOMPLETE');
  if (
    String(row.verified_chain_id || '').trim() !== String(row.chain_id || '').trim()
    || String(row.verified_identity_registry_class_hash || '').trim() !== String(row.identity_registry_class_hash || '').trim()
    || String(row.verified_identity_registry_owner || '').trim() !== String(row.identity_registry_owner || '').trim()
    || String(row.verified_account_class_hash || '').trim() !== String(row.account_class_hash || '').trim()
    || String(row.verified_rpc_url || '').trim() !== String(row.rpc_url || '').trim()
  ) throw new Error('CHAIN_VERIFICATION_REQUIRED');
  return row;
}

async function safeRelayUrl(): Promise<string> {
  const raw = String(secrets.get('SWAPPULSE_TX_RELAY_URL') || '').trim();
  if (!raw) throw new Error('TX_RELAY_NOT_CONFIGURED');
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('TX_RELAY_URL_MUST_USE_HTTPS');
  if (url.username || url.password) throw new Error('TX_RELAY_URL_MUST_NOT_CONTAIN_CREDENTIALS');
  await assertSafeHost(url.hostname);
  url.pathname = '/rpc';
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function relay(method: string, params: any): Promise<any> {
  const token = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '');
  if (token.length < 32) throw new Error('TX_RELAY_TOKEN_NOT_CONFIGURED');
  const url = await safeRelayUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = String(payload?.code || payload?.error || `HTTP_${response.status}`).slice(0, 120);
      throw new Error(`TX_RELAY_REJECTED_${code}`);
    }
    if (!payload || payload.error) {
      const code = String(payload?.error?.code ?? payload?.error?.message ?? 'UNKNOWN').slice(0, 120);
      throw new Error(`TX_RELAY_RPC_${code}`);
    }
    return payload.result;
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
    if (!(await ageEligible(svc, me.id))) {
      return jsonError('Your account is not eligible for SwapPulse Testnet identity provisioning', 403, 'AGE_ELIGIBILITY_REQUIRED');
    }

    const network = await verifiedNetwork(svc);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim();
    const recordId = String(body.record_id || '').trim();
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');

    const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
    const record = rows?.[0];
    if (!record || String(record.user_id || '') !== String(me.id)) {
      return jsonError('Chain identity not found for this account', 404, 'IDENTITY_NOT_FOUND');
    }
    if (!['PENDING', 'DEPLOYED'].includes(String(record.status || ''))) {
      return jsonError('This identity is not in a provisioning state', 409, 'INVALID_STATE');
    }
    if (!record.signer_public_key) return jsonError('Reserved identity has no bound signer public key', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');

    const publicKey = normalizeHex(record.signer_public_key, 'reserved signer public key');
    const classHash = normalizeHex(network.account_class_hash, 'configured account class hash');
    const expectedAddress = normalizeHex(
      hash.calculateContractAddressFromHash(publicKey, classHash, [publicKey], 0),
      'expected account address',
    );
    const tx = extractTransaction(body);

    if (action === 'deploy_account') {
      validateCommonV3(tx, 'DEPLOY_ACCOUNT');
      if (normalizeZeroableHex(tx.nonce ?? '0x0', 'nonce') !== '0x0') return jsonError('Deploy-account nonce must be zero', 400, 'INVALID_DEPLOY_NONCE');
      if (normalizeHex(tx.class_hash, 'class_hash') !== classHash) return jsonError('Account class hash does not match the verified network', 409, 'ACCOUNT_CLASS_MISMATCH');
      const constructor = normalizeArray(tx.constructor_calldata, 'constructor_calldata');
      if (constructor.length !== 1 || constructor[0] !== publicKey) return jsonError('Constructor calldata must contain only your reserved public key', 409, 'CONSTRUCTOR_MISMATCH');
      if (normalizeHex(tx.contract_address_salt, 'contract_address_salt') !== publicKey) return jsonError('Contract address salt must equal your reserved public key', 409, 'ADDRESS_SALT_MISMATCH');
      if (record.account_address && normalizeHex(record.account_address, 'record account address') !== expectedAddress) {
        return jsonError('Existing account address conflicts with the reserved signer', 409, 'ACCOUNT_ADDRESS_MISMATCH');
      }

      const result = await relay('starknet_addDeployAccountTransaction', { deploy_account_transaction: tx });
      const txHash = normalizeHex(result?.transaction_hash, 'deployment transaction hash');
      if (result?.contract_address && normalizeHex(result.contract_address, 'deployed account address') !== expectedAddress) {
        return jsonError('Relay returned an unexpected deployed account address', 502, 'RELAY_ACCOUNT_ADDRESS_MISMATCH');
      }
      await svc.entities.ChainIdentity.update(record.id, {
        account_address: expectedAddress,
        deployment_tx_hash: txHash,
        failure_code: '',
      });
      return Response.json({ ok: true, action, account_address: expectedAddress, transaction_hash: txHash });
    }

    if (action === 'configure_recovery') {
      validateCommonV3(tx, 'INVOKE');
      if (!record.deployment_tx_hash || !record.account_address) {
        return jsonError('Deploy the reserved account before configuring recovery', 409, 'ACCOUNT_NOT_DEPLOYED');
      }
      if (normalizeHex(record.account_address, 'record account address') !== expectedAddress) {
        return jsonError('Recorded account address no longer matches the reserved signer', 409, 'ACCOUNT_ADDRESS_MISMATCH');
      }
      if (normalizeHex(tx.sender_address, 'sender_address') !== expectedAddress) {
        return jsonError('Recovery transaction sender does not match your reserved account', 409, 'SENDER_MISMATCH');
      }
      if (tx.account_deployment_data && normalizeArray(tx.account_deployment_data, 'account_deployment_data').length !== 0) {
        return jsonError('Account deployment data is not allowed', 400, 'ACCOUNT_DEPLOYMENT_DATA_NOT_ALLOWED');
      }
      const recoveryController = normalizeZeroableHex(network.recovery_controller || '0x0', 'configured recovery controller');
      const recoveryDelay = Number(network.recovery_delay_seconds ?? 172800);
      const expectedCalldata = transaction.getExecuteCalldata([
        {
          contractAddress: expectedAddress,
          entrypoint: 'set_recovery_controller',
          calldata: [recoveryController],
        },
        {
          contractAddress: expectedAddress,
          entrypoint: 'set_recovery_delay',
          calldata: [String(recoveryDelay)],
        },
      ], '1');
      if (!sameFelts(normalizeArray(tx.calldata, 'calldata'), expectedCalldata)) {
        return jsonError('Only the configured recovery-controller/delay calls are allowed', 403, 'RECOVERY_CALLDATA_MISMATCH');
      }

      const result = await relay('starknet_addInvokeTransaction', { invoke_transaction: tx });
      const txHash = normalizeHex(result?.transaction_hash, 'recovery configuration transaction hash');
      await svc.entities.ChainIdentity.update(record.id, {
        recovery_config_tx_hash: txHash,
        failure_code: '',
      });
      return Response.json({ ok: true, action, account_address: expectedAddress, transaction_hash: txHash });
    }

    return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_IDENTITY_RELAY_FAILED').replace(/[^A-Za-z0-9_ .:-]/g, '').slice(0, 160);
    console.error('chain-identity-relay failed:', code);
    if (code === 'CHAIN_NOT_CONFIGURED' || code === 'CHAIN_CONFIG_INCOMPLETE' || code === 'CHAIN_VERIFICATION_REQUIRED') {
      return jsonError('SwapPulse Testnet is not verified and ready', 409, code);
    }
    if (code.startsWith('TX_RELAY_')) return jsonError('SwapPulse Testnet transaction relay is unavailable or rejected the transaction', 502, code.slice(0, 120));
    return jsonError('Unable to submit the testnet transaction', 500, 'CHAIN_IDENTITY_RELAY_FAILED');
  }
}
