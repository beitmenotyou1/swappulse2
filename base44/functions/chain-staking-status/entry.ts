import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getVerifiedConfig,
  jsonError,
  normalizeHex,
  normalizeZeroableHex,
  readContract,
  verifiedContractConfigured,
} from '../../shared/chainRelay.ts';

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

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);

    const svc = base44.asServiceRole;
    const identity = await activeIdentity(svc, me.id);
    if (!identity?.account_address || !identity?.chain_identity_id) {
      return Response.json({ ok: true, operator: null, chain_authoritative: false });
    }

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    if (!verifiedContractConfigured(config, 'staking_pool')) {
      return jsonError('The staking pool is not independently verified yet', 409, 'STAKING_ECOSYSTEM_NOT_VERIFIED');
    }

    const accountAddress = normalizeHex(identity.account_address, 'account address');
    const identityId = normalizeHex(identity.chain_identity_id, 'chain identity id');
    const values = await readContract(
      String(config.rpc_url),
      String(config.staking_pool_address),
      'get_validator',
      [accountAddress],
    );
    if (values.length < 7) return jsonError('Operator state could not be read from the staking pool', 502, 'OPERATOR_STATE_UNREADABLE');

    const chainAccount = normalizeZeroableHex(values[0] || '0x0', 'operator account');
    const chainIdentityId = normalizeZeroableHex(values[1] || '0x0', 'operator identity');
    const selfStake = BigInt(values[2] || '0x0');
    const delegatedStake = BigInt(values[3] || '0x0');
    const commissionBps = Number(BigInt(values[4] || '0x0'));
    const statusCode = Number(BigInt(values[5] || '0x0'));
    const registeredAt = Number(BigInt(values[6] || '0x0'));

    if (![0, 1, 2, 3].includes(statusCode)) {
      return jsonError('Operator state returned an unknown status', 502, 'OPERATOR_STATUS_UNKNOWN');
    }
    if (statusCode !== 0) {
      if (chainAccount !== accountAddress) return jsonError('Operator account does not match the secured smart account', 409, 'OPERATOR_ACCOUNT_MISMATCH');
      if (chainIdentityId !== identityId) return jsonError('Operator identity does not match the secured chain identity', 409, 'OPERATOR_IDENTITY_MISMATCH');
    }

    return Response.json({
      ok: true,
      chain_authoritative: true,
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
      },
    });
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_STAKING_STATUS_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('chain-staking-status failed:', code);
    return jsonError('Could not verify your on-chain operator state', 502, code);
  }
}
