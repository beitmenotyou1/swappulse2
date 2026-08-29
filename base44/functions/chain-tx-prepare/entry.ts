import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  Account,
  EDAMode,
  EDataAvailabilityMode,
  RpcProvider,
  hash,
  transaction,
} from 'npm:starknet@10.0.2';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';

const NETWORK = 'SWAPPULSE_TESTNET';
const STARK_FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

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

function toRpcHex(value: unknown): string {
  return `0x${BigInt(value as any).toString(16)}`;
}

function serializeResourceBounds(bounds: any) {
  const keys = ['l1_gas', 'l2_gas', 'l1_data_gas'];
  const out: Record<string, { max_amount: string; max_price_per_unit: string }> = {};
  for (const key of keys) {
    const source = bounds?.[key] || { max_amount: 0n, max_price_per_unit: 0n };
    const maxAmount = BigInt(source.max_amount ?? 0);
    const maxPrice = BigInt(source.max_price_per_unit ?? 0);
    if (maxAmount < 0n || maxPrice < 0n) throw new Error(`Invalid ${key} resource bounds`);
    out[key] = { max_amount: toRpcHex(maxAmount), max_price_per_unit: toRpcHex(maxPrice) };
  }
  return out;
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

function estimateDetails(nonce: string) {
  return {
    nonce,
    tip: 0n,
    paymasterData: [],
    accountDeploymentData: [],
    nonceDataAvailabilityMode: EDataAvailabilityMode.L1,
    feeDataAvailabilityMode: EDataAvailabilityMode.L1,
    skipValidate: true,
  };
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
    const recordId = String(body.record_id || '').trim();
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');

    const rows = await svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []);
    const identity = rows?.[0];
    if (!identity || String(identity.user_id || '') !== String(me.id)) return jsonError('Chain identity not found', 404, 'IDENTITY_NOT_FOUND');
    if (!['PENDING', 'FAILED'].includes(String(identity.status || ''))) return jsonError('Identity is not awaiting signed provisioning', 409, 'INVALID_STATE');
    if (!identity.signer_public_key) return jsonError('Reserved identity has no public signer key', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');

    const rpcUrl = await safePublicRpc(String(config.rpc_url || ''));
    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    const chainId = normalizeHex(await provider.getChainId(), 'RPC chain id');
    if (chainId !== normalizeHex(config.chain_id, 'configured chain id')) return jsonError('Public RPC chain ID no longer matches verified configuration', 409, 'CHAIN_ID_MISMATCH');

    const publicKey = normalizeHex(identity.signer_public_key, 'reserved public key');
    const accountClassHash = normalizeHex(config.account_class_hash, 'configured account class hash');
    const accountAddress = normalizeHex(
      hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0),
      'derived account address',
    );
    if (identity.account_address && normalizeHex(identity.account_address, 'recorded account address') !== accountAddress) {
      return jsonError('Recorded account address does not match the reserved signer', 409, 'ACCOUNT_ADDRESS_MISMATCH');
    }

    // skipValidate=true means Starknet.js does not call this signer during fee
    // estimation. It exists only because Account requires a Signer at construction.
    const estimator = new Account({
      provider,
      address: accountAddress,
      signer: '0x1',
      cairoVersion: '1',
    });

    if (action === 'deploy_account') {
      const nonce = '0x0';
      const estimate = await estimator.estimateAccountDeployFee({
        classHash: accountClassHash,
        constructorCalldata: [publicKey],
        addressSalt: publicKey,
        contractAddress: accountAddress,
      }, estimateDetails(nonce));
      const resourceBounds = estimate.resourceBounds;
      if (!resourceBounds) throw new Error('FEE_ESTIMATE_MISSING_RESOURCE_BOUNDS');
      const transactionHash = normalizeHex(hash.calculateDeployAccountTransactionHash({
        contractAddress: accountAddress,
        classHash: accountClassHash,
        compiledConstructorCalldata: [publicKey],
        salt: publicKey,
        version: '0x3',
        chainId,
        nonce,
        nonceDataAvailabilityMode: EDAMode.L1,
        feeDataAvailabilityMode: EDAMode.L1,
        resourceBounds,
        tip: 0n,
        paymasterData: [],
      }), 'deploy transaction hash');

      return Response.json({
        ok: true,
        schema_version: 1,
        action,
        record_id: identity.id,
        account_address: accountAddress,
        transaction_hash: transactionHash,
        transaction: {
          type: 'DEPLOY_ACCOUNT',
          version: '0x3',
          signature: [],
          nonce,
          contract_address_salt: publicKey,
          constructor_calldata: [publicKey],
          class_hash: accountClassHash,
          resource_bounds: serializeResourceBounds(resourceBounds),
          tip: '0x0',
          paymaster_data: [],
          nonce_data_availability_mode: 'L1',
          fee_data_availability_mode: 'L1',
        },
        estimated_fee: estimate.overall_fee !== undefined ? toRpcHex(estimate.overall_fee) : '',
        note: 'Unsigned V3 deploy-account transaction. Sign transaction_hash only with the device-local reserved signer.',
      });
    }

    if (action === 'configure_recovery') {
      let deployedClass: string;
      try {
        deployedClass = normalizeHex(await provider.getClassHashAt(accountAddress), 'deployed account class hash');
      } catch {
        return jsonError('SwapPulseAccount is not deployed yet', 409, 'ACCOUNT_NOT_DEPLOYED');
      }
      if (deployedClass !== accountClassHash) return jsonError('Deployed account class does not match SwapPulseAccount', 409, 'ACCOUNT_CLASS_MISMATCH');

      const nonce = normalizeZeroableHex(await provider.getNonceForAddress(accountAddress), 'account nonce');
      const recoveryController = normalizeZeroableHex(config.recovery_controller || '0x0', 'recovery controller');
      const recoveryDelay = Number(config.recovery_delay_seconds ?? 172800);
      if (!Number.isInteger(recoveryDelay) || recoveryDelay < 0 || recoveryDelay > 2_592_000) throw new Error('INVALID_RECOVERY_DELAY');
      const calls = [
        { contractAddress: accountAddress, entrypoint: 'set_recovery_controller', calldata: [recoveryController] },
        { contractAddress: accountAddress, entrypoint: 'set_recovery_delay', calldata: [String(recoveryDelay)] },
      ];
      const estimate = await estimator.estimateInvokeFee(calls, estimateDetails(nonce));
      const resourceBounds = estimate.resourceBounds;
      if (!resourceBounds) throw new Error('FEE_ESTIMATE_MISSING_RESOURCE_BOUNDS');
      const compiledCalldata = transaction.getExecuteCalldata(calls, '1');
      const transactionHash = normalizeHex(hash.calculateInvokeTransactionHash({
        senderAddress: accountAddress,
        version: '0x3',
        compiledCalldata,
        chainId,
        nonce,
        accountDeploymentData: [],
        nonceDataAvailabilityMode: EDAMode.L1,
        feeDataAvailabilityMode: EDAMode.L1,
        resourceBounds,
        tip: 0n,
        paymasterData: [],
      }), 'invoke transaction hash');

      return Response.json({
        ok: true,
        schema_version: 1,
        action,
        record_id: identity.id,
        account_address: accountAddress,
        transaction_hash: transactionHash,
        transaction: {
          type: 'INVOKE',
          version: '0x3',
          signature: [],
          nonce,
          sender_address: accountAddress,
          calldata: compiledCalldata.map((value) => toRpcHex(value)),
          resource_bounds: serializeResourceBounds(resourceBounds),
          tip: '0x0',
          paymaster_data: [],
          account_deployment_data: [],
          nonce_data_availability_mode: 'L1',
          fee_data_availability_mode: 'L1',
        },
        estimated_fee: estimate.overall_fee !== undefined ? toRpcHex(estimate.overall_fee) : '',
        note: 'Unsigned V3 recovery-configuration transaction. Sign transaction_hash only with the device-local reserved signer.',
      });
    }

    return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_TX_PREPARE_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 140);
    console.error('chain-tx-prepare failed:', code);
    const clientError = code.includes('NOT_CONFIGURED') || code.includes('MUST_') || code.includes('MISMATCH') || code.includes('REQUIRED') || code.includes('INVALID_') || code.includes('NOT_DEPLOYED');
    return jsonError(clientError ? code.replaceAll('_', ' ') : 'Unable to prepare signed testnet transaction', clientError ? 409 : 502, code);
  }
}
