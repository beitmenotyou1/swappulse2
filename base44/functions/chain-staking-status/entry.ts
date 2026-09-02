import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getVerifiedConfig,
  jsonError,
  normalizeHex,
  normalizeZeroableHex,
  readContract,
  verifiedContractConfigured,
} from '../../shared/chainRelay.ts';

const MAX_DELEGATIONS = 20;

async function activeIdentity(svc: any, userId: string) {
  const rows = await svc.entities.ChainIdentity.filter({ user_id: userId }, '-created_date', 10).catch(() => []);
  const authoritative = ['REGISTERED', 'MERGED', 'RECOVERED'];
  return (rows || []).find((row: any) => authoritative.includes(String(row.status || ''))) || null;
}

function statusName(code: number): 'NONE' | 'ACTIVE' | 'EXITING' | 'SLASHED' | 'UNKNOWN' {
  if (code === 0) return 'NONE';
  if (code === 1) return 'ACTIVE';
  if (code === 2) return 'EXITING';
  if (code === 3) return 'SLASHED';
  return 'UNKNOWN';
}

function delegationState(values: string[], accountAddress: string, validatorAddress: string) {
  if (values.length < 5) throw new Error('DELEGATION_STATE_UNREADABLE');
  const delegator = normalizeZeroableHex(values[0] || '0x0', 'delegation account');
  const validator = normalizeZeroableHex(values[1] || '0x0', 'delegation validator');
  const amount = BigInt(values[2] || '0x0');
  const unlockAt = Number(BigInt(values[3] || '0x0'));
  const pending = BigInt(values[4] || '0x0');

  // Empty mappings serialise the key values supplied to get_delegation on the
  // current contract, but validate any non-zero values before trusting them.
  if (delegator !== '0x0' && delegator !== accountAddress) throw new Error('DELEGATION_ACCOUNT_MISMATCH');
  if (validator !== '0x0' && validator !== validatorAddress) throw new Error('DELEGATION_VALIDATOR_MISMATCH');

  const now = Math.floor(Date.now() / 1000);
  return {
    delegator_address: accountAddress,
    validator_address: validatorAddress,
    amount: amount.toString(),
    pending_withdrawal: pending.toString(),
    unlock_at: unlockAt,
    unlock_at_iso: unlockAt > 0 ? new Date(unlockAt * 1000).toISOString() : '',
    can_request_undelegate: amount > 0n && pending === 0n,
    can_withdraw: pending > 0n && unlockAt > 0 && now >= unlockAt,
  };
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);

    const svc = base44.asServiceRole;
    const identity = await activeIdentity(svc, me.id);
    if (!identity?.account_address || !identity?.chain_identity_id) {
      return Response.json({ ok: true, operator: null, delegations: [], chain_authoritative: false });
    }

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    if (!verifiedContractConfigured(config, 'staking_pool')) {
      return jsonError('The staking pool is not independently verified yet', 409, 'STAKING_ECOSYSTEM_NOT_VERIFIED');
    }

    const accountAddress = normalizeHex(identity.account_address, 'account address');
    const identityId = normalizeHex(identity.chain_identity_id, 'chain identity id');
    const pool = String(config.staking_pool_address);
    const rpc = String(config.rpc_url);

    // The local mirror is used only to discover which external operator keys this
    // collector has interacted with. Every balance/status returned below is read
    // afresh from the verified public RPC and is therefore chain-authoritative.
    const positionRows = await svc.entities.StakePosition
      .filter({ user_id: me.id, network: 'SWAPPULSE_TESTNET' }, '-created_date', 100)
      .catch(() => []);
    const validators: string[] = [];
    const seen = new Set<string>();
    for (const row of positionRows || []) {
      const raw = String(row.validator_address || '').trim();
      if (!raw) continue;
      try {
        const normalized = normalizeHex(raw, 'mirrored validator address');
        if (normalized === accountAddress || seen.has(normalized)) continue;
        seen.add(normalized);
        validators.push(normalized);
        if (validators.length >= MAX_DELEGATIONS) break;
      } catch {
        // Ignore malformed historical mirror rows. They never become RPC input.
      }
    }

    const [operatorValues, selfWithdrawalValues, minValues, unbondValues, ...delegationValues] = await Promise.all([
      readContract(rpc, pool, 'get_validator', [accountAddress]),
      readContract(rpc, pool, 'get_delegation', [accountAddress, accountAddress]),
      readContract(rpc, pool, 'min_self_stake'),
      readContract(rpc, pool, 'unbonding_period'),
      ...validators.map((validatorAddress) => readContract(rpc, pool, 'get_delegation', [accountAddress, validatorAddress])),
    ]);

    if (operatorValues.length < 7) return jsonError('Operator state could not be read from the staking pool', 502, 'OPERATOR_STATE_UNREADABLE');

    const chainAccount = normalizeZeroableHex(operatorValues[0] || '0x0', 'operator account');
    const chainIdentityId = normalizeZeroableHex(operatorValues[1] || '0x0', 'operator identity');
    const selfStake = BigInt(operatorValues[2] || '0x0');
    const delegatedStake = BigInt(operatorValues[3] || '0x0');
    const commissionBps = Number(BigInt(operatorValues[4] || '0x0'));
    const statusCode = Number(BigInt(operatorValues[5] || '0x0'));
    const registeredAt = Number(BigInt(operatorValues[6] || '0x0'));

    if (![0, 1, 2, 3].includes(statusCode)) {
      return jsonError('Operator state returned an unknown status', 502, 'OPERATOR_STATUS_UNKNOWN');
    }
    if (statusCode !== 0) {
      if (chainAccount !== accountAddress) return jsonError('Operator account does not match the secured smart account', 409, 'OPERATOR_ACCOUNT_MISMATCH');
      if (chainIdentityId !== identityId) return jsonError('Operator identity does not match the secured chain identity', 409, 'OPERATOR_IDENTITY_MISMATCH');
    }

    const selfWithdrawal = delegationState(selfWithdrawalValues, accountAddress, accountAddress);
    const delegations = delegationValues
      .map((values, index) => delegationState(values, accountAddress, validators[index]))
      .filter((row) => BigInt(row.amount) > 0n || BigInt(row.pending_withdrawal) > 0n);

    return Response.json({
      ok: true,
      chain_authoritative: true,
      policy: {
        min_self_stake: BigInt(minValues?.[0] || '0x0').toString(),
        unbonding_period_seconds: Number(BigInt(unbondValues?.[0] || '0x0')),
      },
      operator: {
        account_address: accountAddress,
        chain_identity_id: statusCode === 0 ? '' : chainIdentityId,
        self_stake: selfStake.toString(),
        delegated_stake: delegatedStake.toString(),
        commission_bps: commissionBps,
        status_code: statusCode,
        status: statusName(statusCode),
        registered_at: registeredAt,
        registered: statusCode !== 0,
        active: statusCode === 1,
        can_increase_self_stake: statusCode === 1,
        can_exit: statusCode === 1,
        self_withdrawal: selfWithdrawal,
      },
      delegations,
    });
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_STAKING_STATUS_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('chain-staking-status failed:', code);
    return jsonError('Could not verify your on-chain staking state', 502, code);
  }
}
