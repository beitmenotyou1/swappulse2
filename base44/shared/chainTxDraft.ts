import { EDAMode, ETransactionVersion, hash } from 'npm:starknet@10.0.2';
import { signActionToken, verifyActionToken } from './appPasswordCrypto.ts';

const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const MAX_U64 = (1n << 64n) - 1n;
const MAX_U128 = (1n << 128n) - 1n;
const TOKEN_TTL_MS = 5 * 60 * 1000;

export type ChainDraftAction = 'deploy_account' | 'configure_recovery';

export function normalizeChainHex(value: unknown, field = 'felt', allowZero = true): string {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) throw new Error(`${field} must be 0x-prefixed hex`);
  const n = BigInt(raw);
  if ((!allowZero && n === 0n) || n < 0n || n >= STARK_FIELD_PRIME) throw new Error(`${field} is outside the Starknet felt252 field`);
  return `0x${n.toString(16)}`;
}

function feltArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value.map((item, index) => normalizeChainHex(item, `${field}[${index}]`, true));
}

function daMode(value: unknown, field: string): number {
  if (value === 'L1' || value === 0 || value === '0x0') return EDAMode.L1;
  if (value === 'L2' || value === 1 || value === '0x1') return EDAMode.L2;
  throw new Error(`${field} must be L1 or L2`);
}

function bound(value: unknown, field: string, max: bigint): bigint {
  const hex = normalizeChainHex(value, field, true);
  const n = BigInt(hex);
  if (n > max) throw new Error(`${field} exceeds protocol bounds`);
  return n;
}

export function resourceBoundsFromTransaction(tx: any) {
  const source = tx?.resource_bounds;
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('resource_bounds is required');
  const read = (name: string) => {
    const item = source[name];
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`resource_bounds.${name} is required`);
    return {
      max_amount: bound(item.max_amount, `resource_bounds.${name}.max_amount`, MAX_U64),
      max_price_per_unit: bound(item.max_price_per_unit, `resource_bounds.${name}.max_price_per_unit`, MAX_U128),
    };
  };
  return {
    l1_gas: read('l1_gas'),
    l2_gas: read('l2_gas'),
    l1_data_gas: read('l1_data_gas'),
  };
}

export function signingHashForTransaction(
  action: ChainDraftAction,
  tx: any,
  chainId: string,
  expectedAccountAddress: string,
  accountClassHash: string,
): string {
  const version = normalizeChainHex(tx?.version, 'version', false);
  if (version !== ETransactionVersion.V3) throw new Error('Only Starknet V3 transactions are supported');
  const nonce = normalizeChainHex(tx?.nonce ?? '0x0', 'nonce', true);
  const tip = normalizeChainHex(tx?.tip ?? '0x0', 'tip', true);
  const paymasterData = feltArray(tx?.paymaster_data ?? [], 'paymaster_data');
  const resourceBounds = resourceBoundsFromTransaction(tx);
  const nonceDa = daMode(tx?.nonce_data_availability_mode, 'nonce_data_availability_mode');
  const feeDa = daMode(tx?.fee_data_availability_mode, 'fee_data_availability_mode');

  if (action === 'deploy_account') {
    const constructor = feltArray(tx?.constructor_calldata, 'constructor_calldata');
    return normalizeChainHex(hash.calculateDeployAccountTransactionHash({
      contractAddress: normalizeChainHex(expectedAccountAddress, 'account address', false),
      classHash: normalizeChainHex(accountClassHash, 'account class hash', false),
      compiledConstructorCalldata: constructor,
      salt: normalizeChainHex(tx?.contract_address_salt, 'contract_address_salt', false),
      version: ETransactionVersion.V3,
      chainId: normalizeChainHex(chainId, 'chain id', false) as any,
      nonce,
      nonceDataAvailabilityMode: nonceDa as any,
      feeDataAvailabilityMode: feeDa as any,
      resourceBounds,
      tip,
      paymasterData,
    }), 'deploy-account signing hash', false);
  }

  const calldata = feltArray(tx?.calldata, 'calldata');
  const accountDeploymentData = feltArray(tx?.account_deployment_data ?? [], 'account_deployment_data');
  return normalizeChainHex(hash.calculateInvokeTransactionHash({
    senderAddress: normalizeChainHex(expectedAccountAddress, 'account address', false),
    version: ETransactionVersion.V3,
    compiledCalldata: calldata,
    chainId: normalizeChainHex(chainId, 'chain id', false) as any,
    nonce,
    accountDeploymentData,
    nonceDataAvailabilityMode: nonceDa as any,
    feeDataAvailabilityMode: feeDa as any,
    resourceBounds,
    tip,
    paymasterData,
  }), 'invoke signing hash', false);
}

export async function issueChainDraftToken(userId: string, recordId: string, action: ChainDraftAction, signingHash: string) {
  return signActionToken({
    userId,
    action: `swappulse-chain-draft:${action}`,
    targetId: `${recordId}|${normalizeChainHex(signingHash, 'signing hash', false)}`,
    ttlMs: TOKEN_TTL_MS,
  });
}

export async function verifyChainDraftToken(
  token: string,
  userId: string,
  recordId: string,
  action: ChainDraftAction,
  signingHash: string,
): Promise<boolean> {
  const result = await verifyActionToken(token, `swappulse-chain-draft:${action}`, userId);
  if (!result.valid) return false;
  return result.targetId === `${recordId}|${normalizeChainHex(signingHash, 'signing hash', false)}`;
}
