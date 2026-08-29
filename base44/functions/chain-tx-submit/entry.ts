import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { hash, transaction } from 'npm:starknet@10.0.2';
import { Point, Signature, verify as verifyStarkSignature } from 'npm:@scure/starknet@2.4.0';
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

function verifyReservedSignature(signature: string[], signingHash: string, publicKey: string): boolean {
  if (signature.length !== 2) return false;
  const sig = new Signature(BigInt(signature[0]), BigInt(signature[1]));
  const x = normalizeHex(publicKey, 'reserved public key').slice(2).padStart(64, '0');
  // Starknet accounts store only the Stark public-key x-coordinate. Rebuild
  // both possible curve points for that x and accept only a valid signature.
  for (const prefix of ['02', '03']) {
    try {
      const fullPublicKey = Point.fromHex(`${prefix}${x}`).toBytes(false);
      if (verifyStarkSignature(sig, signingHash, fullPublicKey)) return true;
    } catch {
      // Invalid point/parity or signature, try the other possible point.
    }
  }
  return false;
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

async function relayUrl(pathname = '/rpc'): Promise<string> {
  const raw = String(secrets.get('SWAPPULSE_TX_RELAY_URL') || '').trim();
  if (!raw) throw new Error('TX_RELAY_NOT_CONFIGURED');
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('TX_RELAY_URL_MUST_USE_HTTPS');
  if (url.username || url.password) throw new Error('TX_RELAY_URL_MUST_NOT_CONTAIN_CREDENTIALS');
  await assertSafeHost(url.hostname);
  url.pathname = pathname;
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
    const response = await fetch(await relayUrl('/rpc'), {
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

async function forwardRegistration(payload: Record<string, unknown>) {
  const token = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '');
  if (token.length < 32) throw new Error('TX_RELAY_TOKEN_NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(await relayUrl('/register'), {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(String(result?.code || result?.error || `TX_RELAY_HTTP_${response.status}`));
    if (!result?.ok) throw new Error('TX_RELAY_REGISTRATION_FAILED');
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function publicRpc(config: any, method: string, params: unknown[]) {
  const url = new URL(String(config.rpc_url || '').trim());
  if (url.protocol !== 'https:') throw new Error('VERIFIED_RPC_MUST_USE_HTTPS');
  if (url.username || url.password) throw new Error('VERIFIED_RPC_MUST_NOT_CONTAIN_CREDENTIALS');
  await assertSafeHost(url.hostname);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`PUBLIC_RPC_HTTP_${response.status}`);
    if (payload?.error) throw new Error(`PUBLIC_RPC_${method}_${payload.error?.code ?? 'ERROR'}`);
    return payload?.result;
  } finally {
    clearTimeout(timer);
  }
}

async function publicCall(config: any, contractAddress: string, entrypoint: string, calldata: string[] = []) {
  const result = await publicRpc(config, 'starknet_call', [
    {
      contract_address: normalizeHex(contractAddress, 'contract address'),
      entry_point_selector: hash.getSelectorFromName(entrypoint),
      calldata: calldata.map((value, index) => normalizeZeroableHex(value, `${entrypoint} calldata[${index}]`)),
    },
    'latest',
  ]);
  if (!Array.isArray(result)) throw new Error(`PUBLIC_RPC_${entrypoint.toUpperCase()}_INVALID`);
  return result.map((value, index) => normalizeZeroableHex(value, `${entrypoint} result[${index}]`));
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
    const action = String(body.action || '').trim();
    const signedAction = action === 'deploy_account' || action === 'configure_recovery';
    const recordId = String(body.record_id || '').trim();
    const draftToken = String(body.draft_token || '').trim();
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');
    if (signedAction && !draftToken) return jsonError('A current server-issued transaction draft is required', 400, 'DRAFT_TOKEN_REQUIRED');
    if (!signedAction && action !== 'register_identity') return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
    const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
    const identity = rows?.[0];
    if (!identity || String(identity.user_id || '') !== String(me.id)) return jsonError('Chain identity not found', 404, 'IDENTITY_NOT_FOUND');
    const identityStatus = String(identity.status || '');
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
      if (!['PENDING', 'FAILED'].includes(identityStatus)) return jsonError('Identity is not awaiting account deployment', 409, 'INVALID_STATE');
      validateCommonV3(tx, 'DEPLOY_ACCOUNT');
      if (normalizeZeroableHex(tx.nonce ?? '0x0', 'nonce') !== '0x0') return jsonError('Deploy nonce must be zero', 400, 'DEPLOY_NONCE_MUST_BE_ZERO');
      if (normalizeHex(tx.class_hash, 'class_hash') !== accountClassHash) return jsonError('Account class does not match verified SwapPulseAccount', 409, 'ACCOUNT_CLASS_MISMATCH');
      const constructor = feltArray(tx.constructor_calldata, 'constructor_calldata');
      if (constructor.length !== 1 || constructor[0] !== publicKey) return jsonError('Constructor must contain the reserved public key only', 409, 'PUBLIC_KEY_MISMATCH');
      if (normalizeHex(tx.contract_address_salt, 'contract_address_salt') !== publicKey) return jsonError('Account salt must equal the reserved public key', 409, 'ACCOUNT_SALT_MISMATCH');
      const signingHash = signingHashForTransaction(action as ChainDraftAction, tx, String(config.chain_id), expectedAddress, accountClassHash);
      if (!(await verifyChainDraftToken(draftToken, me.id, identity.id, action as ChainDraftAction, signingHash))) {
        return jsonError('Transaction draft is expired or does not match the signed transaction', 409, 'DRAFT_TOKEN_MISMATCH');
      }
      if (!verifyReservedSignature(feltArray(tx.signature, 'signature'), signingHash, publicKey)) {
        return jsonError('Transaction signature does not match the reserved device signer', 403, 'INVALID_STARK_SIGNATURE');
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
      if (!['PENDING', 'FAILED'].includes(identityStatus)) return jsonError('Identity is not awaiting recovery configuration', 409, 'INVALID_STATE');
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
      const signingHash = signingHashForTransaction(action as ChainDraftAction, tx, String(config.chain_id), expectedAddress, accountClassHash);
      if (!(await verifyChainDraftToken(draftToken, me.id, identity.id, action as ChainDraftAction, signingHash))) {
        return jsonError('Transaction draft is expired or does not match the signed transaction', 409, 'DRAFT_TOKEN_MISMATCH');
      }
      if (!verifyReservedSignature(feltArray(tx.signature, 'signature'), signingHash, publicKey)) {
        return jsonError('Transaction signature does not match the reserved device signer', 403, 'INVALID_STARK_SIGNATURE');
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

    if (action === 'register_identity') {
      if (!['PENDING', 'FAILED', 'DEPLOYED'].includes(identityStatus)) return jsonError('Identity is not in a registrable state', 409, 'INVALID_STATE');
      const registryAddress = normalizeHex(config.identity_registry_address, 'configured registry address');
      const registryClassHash = normalizeHex(config.identity_registry_class_hash, 'configured registry class hash');
      const registryOwner = normalizeHex(config.identity_registry_owner, 'configured registry owner');
      const recoveryController = normalizeZeroableHex(config.recovery_controller || '0x0', 'configured recovery controller');
      const recoveryDelay = Number(config.recovery_delay_seconds ?? 172800);
      if (!Number.isInteger(recoveryDelay) || recoveryDelay < 0 || recoveryDelay > 2_592_000) return jsonError('Configured recovery delay is invalid', 409, 'RECOVERY_POLICY_INVALID');
      const identityId = normalizeHex(identity.chain_identity_id, 'identity id');

      const [registryHashRaw, accountHashRaw, ownerRead, controllerRead, delayRead, identityRead, reverseRead] = await Promise.all([
        publicRpc(config, 'starknet_getClassHashAt', ['latest', registryAddress]),
        publicRpc(config, 'starknet_getClassHashAt', ['latest', expectedAddress]),
        publicCall(config, registryAddress, 'owner'),
        publicCall(config, expectedAddress, 'get_recovery_controller'),
        publicCall(config, expectedAddress, 'get_recovery_delay'),
        publicCall(config, registryAddress, 'get_identity', [identityId]),
        publicCall(config, registryAddress, 'get_identity_by_account', [expectedAddress]),
      ]);
      if (normalizeHex(registryHashRaw, 'registry class hash') !== registryClassHash) return jsonError('Registry class no longer matches the verified network', 409, 'REGISTRY_CLASS_MISMATCH');
      if (normalizeHex(accountHashRaw, 'account class hash') !== accountClassHash) return jsonError('Account class does not match SwapPulseAccount', 409, 'ACCOUNT_CLASS_MISMATCH');
      if (!ownerRead[0] || normalizeHex(ownerRead[0], 'registry owner') !== registryOwner) return jsonError('Registry owner no longer matches the verified network', 409, 'REGISTRY_OWNER_MISMATCH');
      if (normalizeZeroableHex(controllerRead?.[0] || '0x0', 'recovery controller') !== recoveryController) return jsonError('Account recovery controller is not configured correctly', 409, 'RECOVERY_CONTROLLER_MISMATCH');
      if (Number(BigInt(delayRead?.[0] || '0x0')) !== recoveryDelay) return jsonError('Account recovery delay is not configured correctly', 409, 'RECOVERY_DELAY_MISMATCH');

      const chainAccount = normalizeZeroableHex(identityRead?.[0] || '0x0', 'chain account');
      const chainStatus = Number(BigInt(identityRead?.[1] || '0x0'));
      const reverseIdentity = normalizeZeroableHex(reverseRead?.[0] || '0x0', 'reverse identity');
      if (chainStatus === 1) {
        if (chainAccount !== expectedAddress || reverseIdentity !== identityId) return jsonError('Chain identity binding conflicts with this reservation', 409, 'IDENTITY_BINDING_CONFLICT');
        await svc.entities.ChainIdentity.update(identity.id, { account_address: expectedAddress, status: 'DEPLOYED', failure_code: '' });
        return Response.json({ ok: true, action, account_address: expectedAddress, transaction_hash: '', idempotent: true, chain_authority_required: true });
      }
      if (chainStatus !== 0) return jsonError('Chain identity is not available for registration', 409, 'IDENTITY_NOT_AVAILABLE');
      if (reverseIdentity !== '0x0') return jsonError('SwapPulse account is already bound to another identity', 409, 'ACCOUNT_ALREADY_BOUND');

      const result = await forwardRegistration({ identity_id: identityId, public_key: publicKey, account_address: expectedAddress });
      const txHash = result.transaction_hash ? normalizeHex(result.transaction_hash, 'registration transaction hash') : '';
      await svc.entities.ChainIdentity.update(identity.id, {
        account_address: expectedAddress,
        registration_tx_hash: txHash || identity.registration_tx_hash || '',
        status: 'DEPLOYED',
        failure_code: '',
      });
      return Response.json({ ok: true, action, account_address: expectedAddress, transaction_hash: txHash, idempotent: result.idempotent === true, chain_authority_required: true });
    }

    return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_TX_SUBMIT_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('chain-tx-submit failed:', code);
    const clientError = code.includes('NOT_CONFIGURED') || code.includes('MUST_') || code.includes('NOT_ALLOWED') || code.includes('WRONG_') || code.includes('MISMATCH') || code.includes('REQUIRED');
    return jsonError(clientError ? code.replaceAll('_', ' ') : 'Signed testnet transaction submission failed', clientError ? 409 : 502, code);
  }
}
