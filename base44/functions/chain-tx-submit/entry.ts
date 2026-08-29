import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash, transaction } from 'npm:starknet@10.0.2';
import { secrets } from 'base44:runtime';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';
import { signingHashForTransaction, verifyChainDraftToken, type ChainDraftAction } from '../../shared/chainTxDraft.ts';

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

function feltArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.map((item, index) => normalizeZeroableHex(item, `${field}[${index}]`));
}

function normalizeNumberish(value: unknown, field: string): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(raw) || /^[0-9]+$/.test(raw)) {
    const n = BigInt(raw);
    if (n < 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
    return `0x${n.toString(16)}`;
  }
  throw new Error(`${field} must be a hexadecimal or decimal felt`);
}

function sameFelts(a: string[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => normalizeNumberish(value, `actual[${index}]`) === normalizeNumberish(b[index], `expected[${index}]`));
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

async function relayUrl(): Promise<string> {
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

async function forward(method: string, params: Record<string, unknown>) {
  const token = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '');
  if (token.length < 32) throw new Error('TX_RELAY_TOKEN_NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(await relayUrl(), {
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
      throw new Error(String(payload?.code || payload?.error || `TX_RELAY_HTTP_${response.status}`));
    }
    if (payload?.error) throw new Error(`TX_RELAY_RPC_${payload.error?.code ?? 'ERROR'}`);
    return payload?.result || {};
  } finally {
    clearTimeout(timer);
  }
}

function validateCommonV3(tx: any, expectedType: string) {
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) throw new Error('TRANSACTION_REQUIRED');
  if (tx.type && String(tx.type) !== expectedType) throw new Error('WRONG_TRANSACTION_TYPE');
  if (normalizeHex(tx.version, 'version') !== '0x3') throw new Error('ONLY_V3_TRANSACTIONS_ALLOWED');
  const signature = feltArray(tx.signature, 'signature');
  if (signature.length !== 2) throw new Error('STARK_SIGNATURE_MUST_HAVE_TWO_FELTS');
  if (tx.paymaster_data && feltArray(tx.paymaster_data, 'paymaster_data').length !== 0) throw new Error('PAYMASTER_DATA_NOT_ALLOWED');
  if (tx.proof_facts && feltArray(tx.proof_facts, 'proof_facts').length !== 0) throw new Error('PROOF_FACTS_NOT_ALLOWED');
  if (tx.proof) throw new Error('PROOF_NOT_ALLOWED');
  if (normalizeZeroableHex(tx.tip ?? '0x0', 'tip') !== '0x0') throw new Error('NONZERO_TIP_NOT_ALLOWED');
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
    const action = String(body.action || '').trim() as ChainDraftAction;
    const recordId = String(body.record_id || '').trim();
    const draftToken = String(body.draft_token || '').trim();
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');
    if (!draftToken) return jsonError('A current server-issued transaction draft is required', 400, 'DRAFT_TOKEN_REQUIRED');
    if (action !== 'deploy_account' && action !== 'configure_recovery') return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
    const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
    const identity = rows?.[0];
    if (!identity || String(identity.user_id || '') !== String(me.id)) return jsonError('Chain identity not found', 404, 'IDENTITY_NOT_FOUND');
    if (!['PENDING', 'FAILED'].includes(String(identity.status || ''))) return jsonError('Identity is not awaiting provisioning', 409, 'INVALID_STATE');
    if (!identity.signer_public_key) return jsonError('Reserved identity has no public signer key', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    const publicKey = normalizeHex(identity.signer_public_key, 'reserved public key');
    const accountClassHash = normalizeHex(config.account_class_hash, 'configured account class hash');
    const expectedAddress = normalizeHex(
      hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0),
      'expected account address',
    );
    if (identity.account_address && normalizeHex(identity.account_address, 'recorded account address') !== expectedAddress) {
      return jsonError('Recorded account address does not match the reserved signer', 409, 'ACCOUNT_ADDRESS_MISMATCH');
    }

    const tx = body.transaction;
    if (action === 'deploy_account') {
      validateCommonV3(tx, 'DEPLOY_ACCOUNT');
      if (normalizeZeroableHex(tx.nonce ?? '0x0', 'nonce') !== '0x0') return jsonError('Deploy nonce must be zero', 400, 'DEPLOY_NONCE_MUST_BE_ZERO');
      if (normalizeHex(tx.class_hash, 'class_hash') !== accountClassHash) return jsonError('Account class does not match verified SwapPulseAccount', 409, 'ACCOUNT_CLASS_MISMATCH');
      const constructor = feltArray(tx.constructor_calldata, 'constructor_calldata');
      if (constructor.length !== 1 || constructor[0] !== publicKey) return jsonError('Constructor must contain the reserved public key only', 409, 'PUBLIC_KEY_MISMATCH');
      if (normalizeHex(tx.contract_address_salt, 'contract_address_salt') !== publicKey) return jsonError('Account salt must equal the reserved public key', 409, 'ACCOUNT_SALT_MISMATCH');
      const signingHash = signingHashForTransaction(action, tx, String(config.chain_id), expectedAddress, accountClassHash);
      if (!(await verifyChainDraftToken(draftToken, me.id, identity.id, action, signingHash))) {
        return jsonError('Transaction draft is expired or does not match the signed transaction', 409, 'DRAFT_TOKEN_MISMATCH');
      }

      const result = await forward('starknet_addDeployAccountTransaction', { deploy_account_transaction: tx });
      const txHash = result.transaction_hash ? normalizeHex(result.transaction_hash, 'transaction hash') : '';
      const contractAddress = result.contract_address ? normalizeHex(result.contract_address, 'contract address') : expectedAddress;
      if (contractAddress !== expectedAddress) return jsonError('Relay returned an unexpected account address', 502, 'RELAY_ACCOUNT_ADDRESS_MISMATCH');
      await svc.entities.ChainIdentity.update(identity.id, {
        account_address: expectedAddress,
        deployment_tx_hash: txHash,
        failure_code: '',
      });
      return Response.json({ ok: true, action, account_address: expectedAddress, transaction_hash: txHash });
    }

    if (action === 'configure_recovery') {
      validateCommonV3(tx, 'INVOKE');
      if (normalizeHex(tx.sender_address, 'sender_address') !== expectedAddress) return jsonError('Recovery transaction sender does not match your reserved account', 409, 'ACCOUNT_ADDRESS_MISMATCH');
      if (tx.account_deployment_data && feltArray(tx.account_deployment_data, 'account_deployment_data').length !== 0) {
        return jsonError('account_deployment_data is not allowed', 400, 'ACCOUNT_DEPLOYMENT_DATA_NOT_ALLOWED');
      }
      const recoveryController = normalizeZeroableHex(config.recovery_controller || '0x0', 'configured recovery controller');
      const recoveryDelay = Number(config.recovery_delay_seconds ?? 172800);
      const expectedCalldata = transaction.getExecuteCalldata([
        { contractAddress: expectedAddress, entrypoint: 'set_recovery_controller', calldata: [recoveryController] },
        { contractAddress: expectedAddress, entrypoint: 'set_recovery_delay', calldata: [String(recoveryDelay)] },
      ], '1');
      const actualCalldata = feltArray(tx.calldata, 'calldata');
      if (!sameFelts(actualCalldata, expectedCalldata)) return jsonError('Only the configured recovery setup calls are allowed', 403, 'RECOVERY_CALLDATA_MISMATCH');
      const signingHash = signingHashForTransaction(action, tx, String(config.chain_id), expectedAddress, accountClassHash);
      if (!(await verifyChainDraftToken(draftToken, me.id, identity.id, action, signingHash))) {
        return jsonError('Transaction draft is expired or does not match the signed transaction', 409, 'DRAFT_TOKEN_MISMATCH');
      }

      const result = await forward('starknet_addInvokeTransaction', { invoke_transaction: tx });
      const txHash = result.transaction_hash ? normalizeHex(result.transaction_hash, 'transaction hash') : '';
      await svc.entities.ChainIdentity.update(identity.id, {
        account_address: expectedAddress,
        recovery_config_tx_hash: txHash,
        failure_code: '',
      });
      return Response.json({ ok: true, action, account_address: expectedAddress, transaction_hash: txHash });
    }

    return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_TX_SUBMIT_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('chain-tx-submit failed:', code);
    const clientError = code.includes('NOT_CONFIGURED') || code.includes('MUST_') || code.includes('NOT_ALLOWED') || code.includes('WRONG_') || code.includes('MISMATCH') || code.includes('REQUIRED');
    return jsonError(clientError ? code.replaceAll('_', ' ') : 'Signed testnet transaction submission failed', clientError ? 409 : 502, code);
  }
}
