// Shared SwapPulse appchain relay + calldata helpers.
//
// Both the draft path (chain-action-draft) and the submit path
// (chain-action-submit) build their expected calldata through
// `buildActionCalls` here. That is the security property: submit recomputes the
// calldata from server-side stored parameters and compares it to what the client
// signed, so a client cannot smuggle extra calls into a signed transaction.

import { secrets } from 'base44:runtime';
import { hash, transaction } from 'npm:starknet@10.0.2';
import { assertSafeHost } from './ssrfGuard.ts';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from './agePolicy.ts';

export const NETWORK = 'SWAPPULSE_TESTNET';
const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const U128_MAX = (1n << 128n) - 1n;
const TIMEOUT_MS = 15_000;

export type ChainActionKind = 'stake' | 'bridge_out' | 'add_signer';

export function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

export function normalizeHex(value: unknown, field: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n <= 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

export function normalizeZeroableHex(value: unknown, field: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if (n < 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

export function feltArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.map((item, index) => normalizeZeroableHex(item, `${field}[${index}]`));
}

export function normalizeNumberish(value: unknown, field: string): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(raw) || /^[0-9]+$/.test(raw)) {
    const n = BigInt(raw);
    if (n < 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
    return `0x${n.toString(16)}`;
  }
  throw new Error(`${field} must be a hexadecimal or decimal felt`);
}

export function sameFelts(a: string[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => normalizeNumberish(value, `actual[${index}]`) === normalizeNumberish(b[index], `expected[${index}]`));
}

// Amounts are held as decimal strings in entities to avoid float precision loss.
// Split into the low/high felt pair a Cairo u256 argument expects.
export function u256Parts(value: unknown, field: string): [string, string] {
  const raw = String(value ?? '').trim();
  if (!/^[0-9]+$/.test(raw)) throw new Error(`${field} must be a decimal base-unit amount`);
  const n = BigInt(raw);
  if (n <= 0n) throw new Error(`${field} must be greater than zero`);
  if (n > U128_MAX) throw new Error(`${field} exceeds the supported u256 low-word range`);
  return [`0x${n.toString(16)}`, '0x0'];
}

export const CHAIN_CODES: Record<string, number> = { ethereum: 1, l2: 2, solana: 3 };

// Commitment to the destination-chain recipient. The raw address (which may be a
// Solana base58 key that does not fit a felt) stays off-chain; only this
// commitment is recorded, and the relay resolves it from the mirrored record.
export async function recipientCommitment(externalChain: string, recipient: string): Promise<string> {
  const data = new TextEncoder().encode(`swappulse-bridge-recipient:${externalChain}:${recipient}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  // Truncate to 248 bits so the commitment always lands inside the felt field.
  return `0x${(BigInt(`0x${hex}`) >> 8n).toString(16)}`;
}

export async function attestationCommitment(sessionId: string, cardId: string, level: number): Promise<string> {
  const data = new TextEncoder().encode(`swappulse-card-attestation:${sessionId}:${cardId}:${level}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${(BigInt(`0x${hex}`) >> 8n).toString(16)}`;
}

export async function ageEligible(svc: any, userId: string): Promise<boolean> {
  const rows = await svc.entities.AgeStatus.filter({ user_id: userId }, '-updated_date', 5).catch(() => []);
  const row = rows?.[0];
  if (!row || !isAgeBand(row.age_band)) return false;
  const band = row.age_band as AgeBand;
  const method = row.age_method === 'THIRD_PARTY_VERIFIED' ? 'THIRD_PARTY_VERIFIED' : 'SELF_DECLARED';
  return deriveAgeEligibility(band, method).testnet_identity_eligible;
}

// A configuration row is trusted only when every verified_* pin still matches
// the configured value byte-for-byte. Anything stale fails closed.
export async function getVerifiedConfig(svc: any) {
  const rows = await svc.entities.ChainNetworkConfig.filter({ network: NETWORK }, '-updated_date', 1).catch(() => []);
  const row = rows?.[0];
  if (!row || row.status !== 'CONFIGURED') return null;
  const required = [row.chain_id, row.account_class_hash, row.identity_registry_address, row.identity_registry_owner, row.rpc_url];
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

async function relayUrl(pathname: string): Promise<string> {
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

async function relayPost(pathname: string, body: unknown) {
  const token = String(secrets.get('SWAPPULSE_TX_RELAY_TOKEN') || '');
  if (token.length < 32) throw new Error('TX_RELAY_TOKEN_NOT_CONFIGURED');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(await relayUrl(pathname), {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(String(payload?.code || payload?.error || `TX_RELAY_HTTP_${response.status}`));
    if (payload?.error) throw new Error(`TX_RELAY_RPC_${payload.error?.code ?? 'ERROR'}`);
    return payload?.result || payload || {};
  } finally {
    clearTimeout(timer);
  }
}

export async function relayRpc(method: string, params: Record<string, unknown>) {
  return relayPost('/rpc', { jsonrpc: '2.0', id: crypto.randomUUID(), method, params });
}

export async function relayMintCard(payload: Record<string, unknown>) {
  return relayPost('/mint-card', payload);
}

export async function relaySubmitUsership(payload: Record<string, unknown>) {
  return relayPost('/submit-usership', payload);
}

// Recovery-controller actions. The relay signs as the account's configured
// recovery controller; the on-chain delay still gates execution.
export async function relayRecoveryAction(kind: 'propose' | 'execute' | 'cancel', payload: Record<string, unknown>) {
  return relayPost(`/recovery-${kind}`, payload);
}

// The relay owns the faucet treasury and always sends its own fixed drip amount,
// so this call carries only the recipient — never an amount.
export async function relayFaucetDrip(payload: Record<string, unknown>) {
  return relayPost('/faucet-drip', payload);
}

// Read-only chain access uses the PUBLIC verified rpc_url, never the relay —
// reads must never consume the relay's privileged path.
export async function publicRpc(rpcUrl: string, method: string, params: unknown) {
  const url = new URL(String(rpcUrl));
  if (url.protocol !== 'https:') throw new Error('RPC_URL_MUST_USE_HTTPS');
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
    if (!response.ok || payload?.error) throw new Error(`RPC_${method.toUpperCase()}_FAILED`);
    return payload?.result;
  } finally {
    clearTimeout(timer);
  }
}

// Read-only contract call over the PUBLIC rpc. Returns the raw felt array.
export async function readContract(
  rpcUrl: string,
  contractAddress: string,
  entrypoint: string,
  calldata: string[] = [],
): Promise<string[]> {
  const result = await publicRpc(rpcUrl, 'starknet_call', [
    {
      contract_address: normalizeHex(contractAddress, 'contract address'),
      entry_point_selector: selectorFor(entrypoint),
      calldata: calldata.map((value, index) => normalizeZeroableHex(value, `${entrypoint} calldata[${index}]`)),
    },
    'latest',
  ]);
  if (!Array.isArray(result)) throw new Error(`RPC_CALL_${entrypoint.toUpperCase()}_INVALID`);
  return result.map((value: unknown, index: number) => normalizeZeroableHex(value, `${entrypoint} result[${index}]`));
}

// A Cairo u256 comes back as [low, high]; recombine into a decimal string so
// entities and the UI never carry a lossy number.
export function u256ToDecimal(values: string[]): string {
  const low = BigInt(values?.[0] || '0x0');
  const high = BigInt(values?.[1] || '0x0');
  return ((high << 128n) + low).toString();
}

export function daModeName(value: unknown, field: string): 'L1' | 'L2' {
  if (value === 'L1' || value === 0 || value === '0x0') return 'L1';
  if (value === 'L2' || value === 1 || value === '0x1') return 'L2';
  throw new Error(`${field}_MUST_BE_L1_OR_L2`);
}

export function canonicalResourceBounds(tx: any) {
  const read = (name: string) => {
    const item = tx?.resource_bounds?.[name];
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('RESOURCE_BOUNDS_REQUIRED');
    return {
      max_amount: normalizeZeroableHex(item.max_amount, `resource_bounds.${name}.max_amount`),
      max_price_per_unit: normalizeZeroableHex(item.max_price_per_unit, `resource_bounds.${name}.max_price_per_unit`),
    };
  };
  return { l1_gas: read('l1_gas'), l2_gas: read('l2_gas'), l1_data_gas: read('l1_data_gas') };
}

// Rebuild the transaction from validated values only — never forward the
// caller's object, whose extra keys the signing hash would not cover.
export function canonicalV3Invoke(tx: any, senderAddress: string, calldata: string[]) {
  return {
    type: 'INVOKE',
    version: '0x3',
    signature: feltArray(tx.signature, 'signature'),
    nonce: normalizeZeroableHex(tx.nonce ?? '0x0', 'nonce'),
    resource_bounds: canonicalResourceBounds(tx),
    tip: '0x0',
    paymaster_data: [] as string[],
    nonce_data_availability_mode: daModeName(tx.nonce_data_availability_mode, 'NONCE_DATA_AVAILABILITY_MODE'),
    fee_data_availability_mode: daModeName(tx.fee_data_availability_mode, 'FEE_DATA_AVAILABILITY_MODE'),
    sender_address: senderAddress,
    calldata,
    account_deployment_data: [] as string[],
  };
}

export function validateInvokeShape(tx: any) {
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) throw new Error('TRANSACTION_REQUIRED');
  if (tx.type && String(tx.type) !== 'INVOKE') throw new Error('WRONG_TRANSACTION_TYPE');
  if (normalizeHex(tx.version, 'version') !== '0x3') throw new Error('ONLY_V3_TRANSACTIONS_ALLOWED');
  if (feltArray(tx.signature, 'signature').length !== 2) throw new Error('STARK_SIGNATURE_MUST_HAVE_TWO_FELTS');
  if (tx.paymaster_data && feltArray(tx.paymaster_data, 'paymaster_data').length !== 0) throw new Error('PAYMASTER_DATA_NOT_ALLOWED');
  if (tx.proof_facts && feltArray(tx.proof_facts, 'proof_facts').length !== 0) throw new Error('PROOF_FACTS_NOT_ALLOWED');
  if (tx.proof) throw new Error('PROOF_NOT_ALLOWED');
  if (normalizeZeroableHex(tx.tip ?? '0x0', 'tip') !== '0x0') throw new Error('NONZERO_TIP_NOT_ALLOWED');
  if (tx.account_deployment_data && feltArray(tx.account_deployment_data, 'account_deployment_data').length !== 0) {
    throw new Error('ACCOUNT_DEPLOYMENT_DATA_NOT_ALLOWED');
  }
}

// ---------------------------------------------------------------------------
// Calldata construction — the single source of truth for both draft and submit.
// ---------------------------------------------------------------------------

export type StakeIntent = {
  kind: 'register_validator' | 'increase_self_stake' | 'delegate' | 'request_undelegate' | 'withdraw' | 'exit_validator';
  amount?: string;
  validatorAddress?: string;
  chainIdentityId?: string;
  commissionBps?: number;
};

export type BridgeIntent = {
  assetKind: 'token' | 'card';
  externalChain: string;
  amount?: string;
  cardTokenId?: string;
  recipientHash: string;
};

function requireAddress(config: any, field: string, label: string): string {
  return normalizeHex(config?.[field], label);
}

export function buildStakeCalls(intent: StakeIntent, config: any) {
  const pool = requireAddress(config, 'staking_pool_address', 'configured staking pool');
  const token = requireAddress(config, 'native_token_address', 'configured native token');

  if (intent.kind === 'exit_validator') {
    return [{ contractAddress: pool, entrypoint: 'exit_validator', calldata: [] as string[] }];
  }
  if (intent.kind === 'withdraw') {
    const validator = normalizeHex(intent.validatorAddress, 'validator address');
    return [{ contractAddress: pool, entrypoint: 'withdraw', calldata: [validator] }];
  }
  if (intent.kind === 'request_undelegate') {
    const validator = normalizeHex(intent.validatorAddress, 'validator address');
    const amount = String(intent.amount ?? '');
    if (!/^[0-9]+$/.test(amount) || BigInt(amount) <= 0n) throw new Error('AMOUNT_REQUIRED');
    return [{ contractAddress: pool, entrypoint: 'request_undelegate', calldata: [validator, `0x${BigInt(amount).toString(16)}`] }];
  }

  // Staking inbound flows all need an allowance for the pool first. The approval
  // is scoped to exactly the amount being staked in this same transaction.
  const [low, high] = u256Parts(intent.amount, 'stake amount');
  const approve = { contractAddress: token, entrypoint: 'approve', calldata: [pool, low, high] };
  const amountFelt = `0x${BigInt(String(intent.amount)).toString(16)}`;

  if (intent.kind === 'register_validator') {
    const identityId = normalizeHex(intent.chainIdentityId, 'chain identity id');
    const commission = Number(intent.commissionBps ?? 0);
    if (!Number.isInteger(commission) || commission < 0 || commission > 3000) throw new Error('COMMISSION_BPS_NOT_ALLOWED');
    return [
      approve,
      { contractAddress: pool, entrypoint: 'register_validator', calldata: [identityId, amountFelt, String(commission)] },
    ];
  }
  if (intent.kind === 'increase_self_stake') {
    return [approve, { contractAddress: pool, entrypoint: 'increase_self_stake', calldata: [amountFelt] }];
  }
  const validator = normalizeHex(intent.validatorAddress, 'validator address');
  return [approve, { contractAddress: pool, entrypoint: 'delegate', calldata: [validator, amountFelt] }];
}

export function buildBridgeCalls(intent: BridgeIntent, config: any) {
  const bridge = requireAddress(config, 'bridge_adapter_address', 'configured bridge adapter');
  const chainCode = CHAIN_CODES[intent.externalChain];
  if (!chainCode) throw new Error('EXTERNAL_CHAIN_NOT_SUPPORTED');
  const recipientHash = normalizeHex(intent.recipientHash, 'recipient commitment');

  if (intent.assetKind === 'card') {
    const [low, high] = u256Parts(intent.cardTokenId, 'card token id');
    return [{ contractAddress: bridge, entrypoint: 'bridge_out_card', calldata: [String(chainCode), low, high, recipientHash] }];
  }

  const token = requireAddress(config, 'native_token_address', 'configured native token');
  const [low, high] = u256Parts(intent.amount, 'bridge amount');
  return [
    { contractAddress: token, entrypoint: 'approve', calldata: [bridge, low, high] },
    { contractAddress: bridge, entrypoint: 'bridge_out_token', calldata: [String(chainCode), low, high, recipientHash] },
  ];
}

export function buildAddSignerCalls(accountAddress: string, signerPublicKey: string) {
  return [{
    contractAddress: normalizeHex(accountAddress, 'account address'),
    entrypoint: 'add_signer',
    calldata: [normalizeHex(signerPublicKey, 'additional signer public key')],
  }];
}

export function executeCalldata(calls: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }>): string[] {
  return transaction.getExecuteCalldata(calls as any, '1').map((value: any, index: number) => normalizeNumberish(value, `calldata[${index}]`));
}

export function selectorFor(entrypoint: string): string {
  return normalizeHex(hash.getSelectorFromName(entrypoint), 'selector');
}