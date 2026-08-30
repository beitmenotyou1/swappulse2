import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ETransactionVersion, hash, stark, transaction } from 'npm:starknet@10.0.2';
import { assertSafeHost } from '../../shared/ssrfGuard.ts';
import { deriveAgeEligibility, isAgeBand, type AgeBand } from '../../shared/agePolicy.ts';
import {
  issueChainDraftToken,
  normalizeChainHex,
  signingHashForTransaction,
  type ChainDraftAction,
} from '../../shared/chainTxDraft.ts';

const NETWORK = 'SWAPPULSE_TESTNET';
const RPC_TIMEOUT_MS = 12_000;
const CONTRACT_NOT_FOUND = 20;
// Sanity ceiling on the maximum fee a drafted transaction may authorise, in FRI
// (1 STRK = 1e18 FRI). Provisioning transactions cost orders of magnitude less
// than this. The bounds are derived from the RPC's own fee estimate, so a
// misbehaving or hostile RPC could otherwise inflate the estimate and have the
// user sign a transaction authorising an arbitrarily large fee against whoever
// funds it. Defence in depth — the RPC is already pinned and verified.
const MAX_DRAFT_FEE_FRI = 10n ** 18n;

function jsonError(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code: code || undefined }, { status });
}

function zeroBoundsRpc() {
  return {
    l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    l1_data_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
  };
}

function boundsToRpc(bounds: any) {
  const hex = (value: unknown) => `0x${BigInt(value as any).toString(16)}`;
  return {
    l1_gas: { max_amount: hex(bounds.l1_gas.max_amount), max_price_per_unit: hex(bounds.l1_gas.max_price_per_unit) },
    l2_gas: { max_amount: hex(bounds.l2_gas.max_amount), max_price_per_unit: hex(bounds.l2_gas.max_price_per_unit) },
    l1_data_gas: { max_amount: hex(bounds.l1_data_gas.max_amount), max_price_per_unit: hex(bounds.l1_data_gas.max_price_per_unit) },
  };
}

function normaliseFeeEstimate(raw: any) {
  if (!raw || typeof raw !== 'object') throw new Error('RPC fee estimate is invalid');
  return {
    l1_gas_consumed: raw.l1_gas_consumed ?? '0x0',
    l1_gas_price: raw.l1_gas_price ?? '0x0',
    l1_data_gas_consumed: raw.l1_data_gas_consumed ?? '0x0',
    l1_data_gas_price: raw.l1_data_gas_price ?? '0x0',
    l2_gas_consumed: raw.l2_gas_consumed ?? '0x0',
    l2_gas_price: raw.l2_gas_price ?? '0x0',
    overall_fee: raw.overall_fee ?? '0x0',
    unit: raw.unit || 'FRI',
  };
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

async function safeRpcUrl(raw: unknown): Promise<string> {
  const url = new URL(String(raw || '').trim());
  if (url.protocol !== 'https:') throw new Error('RPC URL must use HTTPS');
  if (url.username || url.password) throw new Error('RPC URL must not contain credentials');
  await assertSafeHost(url.hostname);
  return url.toString();
}

async function rpcRaw(rpcUrl: string, method: string, params: unknown): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function rpcCall(rpcUrl: string, method: string, params: unknown): Promise<any> {
  const payload = await rpcRaw(rpcUrl, method, params);
  if (payload?.error) throw new Error(`RPC ${method} error ${payload.error?.code ?? 'unknown'}`);
  return payload?.result;
}

async function classHashAt(rpcUrl: string, address: string): Promise<string | null> {
  const payload = await rpcRaw(rpcUrl, 'starknet_getClassHashAt', ['latest', address]);
  if (payload?.error) {
    if (Number(payload.error?.code) === CONTRACT_NOT_FOUND) return null;
    throw new Error(`RPC starknet_getClassHashAt error ${payload.error?.code ?? 'unknown'}`);
  }
  return normalizeChainHex(payload?.result, 'deployed class hash', false);
}

async function starknetCall(rpcUrl: string, address: string, entrypoint: string, calldata: string[] = []): Promise<string[]> {
  const result = await rpcCall(rpcUrl, 'starknet_call', [
    {
      contract_address: address,
      entry_point_selector: hash.getSelectorFromName(entrypoint),
      calldata,
    },
    'latest',
  ]);
  if (!Array.isArray(result)) throw new Error(`${entrypoint} returned an invalid result`);
  return result.map((value, index) => normalizeChainHex(value, `${entrypoint} result[${index}]`, true));
}

async function estimateBounds(rpcUrl: string, estimateTransaction: any) {
  const result = await rpcCall(rpcUrl, 'starknet_estimateFee', {
    request: [estimateTransaction],
    simulation_flags: ['SKIP_VALIDATE'],
    block_id: 'latest',
  });
  if (!Array.isArray(result) || !result[0]) throw new Error('RPC fee estimation returned no result');
  const bounds = stark.toOverheadResourceBounds(normaliseFeeEstimate(result[0]) as any);
  const maxFee = (['l1_gas', 'l2_gas', 'l1_data_gas'] as const).reduce((total, name) => {
    const item = (bounds as any)[name];
    return total + BigInt(item.max_amount) * BigInt(item.max_price_per_unit);
  }, 0n);
  if (maxFee > MAX_DRAFT_FEE_FRI) throw new Error('FEE_ESTIMATE_EXCEEDS_CEILING');
  return bounds;
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
    const action = String(body.action || '') as ChainDraftAction;
    if (action !== 'deploy_account' && action !== 'configure_recovery') return jsonError('Unknown draft action', 400, 'UNKNOWN_ACTION');
    const recordId = String(body.record_id || '').trim();
    if (!recordId) return jsonError('record_id is required', 400, 'RECORD_ID_REQUIRED');

    const [config, rows] = await Promise.all([
      verifiedNetwork(svc),
      svc.entities.ChainIdentity.filter({ id: recordId }, '-created_date', 1).catch(() => []),
    ]);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    const identity = rows?.[0];
    if (!identity || String(identity.user_id || '') !== String(me.id)) return jsonError('Chain identity not found', 404, 'IDENTITY_NOT_FOUND');
    if (!['PENDING', 'FAILED'].includes(String(identity.status || ''))) return jsonError('Identity is not awaiting provisioning', 409, 'INVALID_STATE');
    if (!identity.signer_public_key) return jsonError('Reserved identity has no public signer key', 409, 'SIGNER_PUBLIC_KEY_NOT_BOUND');

    const rpcUrl = await safeRpcUrl(config.rpc_url);
    const publicKey = normalizeChainHex(identity.signer_public_key, 'reserved public key', false);
    const accountClassHash = normalizeChainHex(config.account_class_hash, 'configured account class hash', false);
    const chainId = normalizeChainHex(config.chain_id, 'configured chain id', false);
    const accountAddress = normalizeChainHex(
      hash.calculateContractAddressFromHash(publicKey, accountClassHash, [publicKey], 0),
      'derived account address',
      false,
    );
    if (identity.account_address && normalizeChainHex(identity.account_address, 'recorded account address', false) !== accountAddress) {
      return jsonError('Recorded account address does not match the reserved signer', 409, 'ACCOUNT_ADDRESS_MISMATCH');
    }

    const deployedHash = await classHashAt(rpcUrl, accountAddress);
    if (deployedHash && deployedHash !== accountClassHash) {
      return jsonError('Derived account address is occupied by an unexpected contract class', 409, 'ACCOUNT_CLASS_MISMATCH');
    }

    if (action === 'deploy_account') {
      if (deployedHash === accountClassHash) {
        await svc.entities.ChainIdentity.update(identity.id, { account_address: accountAddress, failure_code: '' });
        return Response.json({ ok: true, action, already_complete: true, account_address: accountAddress, next_action: 'configure_recovery' });
      }

      const estimateTx = {
        type: 'DEPLOY_ACCOUNT',
        version: ETransactionVersion.F3,
        signature: [],
        nonce: '0x0',
        resource_bounds: zeroBoundsRpc(),
        tip: '0x0',
        paymaster_data: [],
        nonce_data_availability_mode: 'L1',
        fee_data_availability_mode: 'L1',
        constructor_calldata: [publicKey],
        class_hash: accountClassHash,
        contract_address_salt: publicKey,
      };
      const resourceBounds = await estimateBounds(rpcUrl, estimateTx);
      const tx = {
        ...estimateTx,
        version: ETransactionVersion.V3,
        resource_bounds: boundsToRpc(resourceBounds),
      };
      const signingHash = signingHashForTransaction(action, tx, chainId, accountAddress, accountClassHash);
      const draftToken = await issueChainDraftToken(me.id, identity.id, action, signingHash);
      return Response.json({
        ok: true,
        action,
        account_address: accountAddress,
        signing_hash: signingHash,
        transaction: tx,
        draft_token: draftToken,
        expires_in_seconds: 300,
      });
    }

    if (!deployedHash) return jsonError('The account deployment is not visible on the public RPC yet', 409, 'ACCOUNT_NOT_READY');
    const recoveryController = normalizeChainHex(config.recovery_controller || '0x0', 'configured recovery controller', true);
    const recoveryDelay = Number(config.recovery_delay_seconds ?? 172800);
    if (!Number.isInteger(recoveryDelay) || recoveryDelay < 0 || recoveryDelay > 2_592_000) {
      return jsonError('Configured recovery delay is invalid', 409, 'RECOVERY_POLICY_INVALID');
    }
    const [controllerRead, delayRead] = await Promise.all([
      starknetCall(rpcUrl, accountAddress, 'get_recovery_controller'),
      starknetCall(rpcUrl, accountAddress, 'get_recovery_delay'),
    ]);
    const currentController = normalizeChainHex(controllerRead[0] || '0x0', 'current recovery controller', true);
    const currentDelay = Number(BigInt(normalizeChainHex(delayRead[0] || '0x0', 'current recovery delay', true)));
    if (currentController === recoveryController && currentDelay === recoveryDelay) {
      await svc.entities.ChainIdentity.update(identity.id, { account_address: accountAddress, failure_code: '' });
      return Response.json({ ok: true, action, already_complete: true, account_address: accountAddress, next_action: 'register_identity' });
    }

    const nonce = normalizeChainHex(
      await rpcCall(rpcUrl, 'starknet_getNonce', ['latest', accountAddress]),
      'account nonce',
      true,
    );
    const calls = [
      { contractAddress: accountAddress, entrypoint: 'set_recovery_controller', calldata: [recoveryController] },
      { contractAddress: accountAddress, entrypoint: 'set_recovery_delay', calldata: [String(recoveryDelay)] },
    ];
    const calldata = transaction.getExecuteCalldata(calls, '1').map((value) => `0x${BigInt(value).toString(16)}`);
    const estimateTx = {
      type: 'INVOKE',
      version: ETransactionVersion.F3,
      signature: [],
      nonce,
      resource_bounds: zeroBoundsRpc(),
      tip: '0x0',
      paymaster_data: [],
      nonce_data_availability_mode: 'L1',
      fee_data_availability_mode: 'L1',
      account_deployment_data: [],
      sender_address: accountAddress,
      calldata,
    };
    const resourceBounds = await estimateBounds(rpcUrl, estimateTx);
    const tx = {
      ...estimateTx,
      version: ETransactionVersion.V3,
      resource_bounds: boundsToRpc(resourceBounds),
    };
    const signingHash = signingHashForTransaction(action, tx, chainId, accountAddress, accountClassHash);
    const draftToken = await issueChainDraftToken(me.id, identity.id, action, signingHash);
    return Response.json({
      ok: true,
      action,
      account_address: accountAddress,
      signing_hash: signingHash,
      transaction: tx,
      draft_token: draftToken,
      expires_in_seconds: 300,
    });
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_TX_DRAFT_FAILED').replace(/[^A-Za-z0-9_ .:-]/g, '').slice(0, 180);
    console.error('chain-tx-draft failed:', code);
    return jsonError('Unable to prepare the testnet transaction', 502, code || 'CHAIN_TX_DRAFT_FAILED');
  }
}