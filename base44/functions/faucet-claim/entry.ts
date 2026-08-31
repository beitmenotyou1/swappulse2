import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  ageEligible,
  getVerifiedConfig,
  jsonError,
  normalizeHex,
  readContract,
  relayFaucetDrip,
  u256ToDecimal,
} from '../../shared/chainRelay.ts';

// Testnet SWPX faucet. Two actions:
//   status — what the Wallet needs to render the card (eligibility, cooldown, balance)
//   claim  — issue one fixed drip to the collector's own smart account
//
// The drip AMOUNT is decided by the relay, not by this function and never by the
// client. The 24h cooldown is derived from the collector's own FaucetClaim history
// read with the service role, so it cannot be bypassed from the browser.

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const AUTHORITATIVE = ['REGISTERED', 'MERGED', 'RECOVERED'];

async function activeIdentity(svc: any, userId: string) {
  const rows = await svc.entities.ChainIdentity.filter({ user_id: userId }, '-created_date', 10).catch(() => []);
  return (rows || []).find((row: any) => AUTHORITATIVE.includes(String(row.status || ''))) || null;
}

async function lastClaim(svc: any, userId: string) {
  const rows = await svc.entities.FaucetClaim.filter({ created_by_id: userId }, '-created_date', 1).catch(() => []);
  return rows?.[0] || null;
}

function cooldownRemainingMs(claim: any): number {
  if (!claim || String(claim.status) === 'FAILED') return 0;
  const at = Date.parse(String(claim.created_date || ''));
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, at + COOLDOWN_MS - Date.now());
}

async function accountBalance(config: any, accountAddress: string): Promise<string> {
  if (!String(config.native_token_address || '').trim()) return '0';
  const values = await readContract(String(config.rpc_url), String(config.native_token_address), 'balance_of', [accountAddress]);
  return u256ToDecimal(values);
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status').trim();
    if (!['status', 'claim'].includes(action)) return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');

    const adult = await ageEligible(svc, me.id);
    const identity = await activeIdentity(svc, me.id);
    const config = await getVerifiedConfig(svc);
    const claim = await lastClaim(svc, me.id);
    const remaining = cooldownRemainingMs(claim);

    const blockedReason = !adult
      ? 'AGE_ELIGIBILITY_REQUIRED'
      : !identity?.account_address
        ? 'IDENTITY_NOT_SECURED'
        : !config
          ? 'CHAIN_VERIFICATION_REQUIRED'
          : remaining > 0
            ? 'COOLDOWN_ACTIVE'
            : '';

    let balance = '0';
    if (config && identity?.account_address) {
      balance = await accountBalance(config, normalizeHex(identity.account_address, 'account address')).catch(() => '0');
    }

    if (action === 'status') {
      return Response.json({
        ok: true,
        eligible: !blockedReason,
        reason: blockedReason || undefined,
        cooldown_ms_remaining: remaining,
        cooldown_hours: 24,
        balance,
        last_claim: claim
          ? { id: claim.id, status: claim.status, amount: claim.amount, tx_hash: claim.tx_hash, created_date: claim.created_date }
          : null,
      });
    }

    if (blockedReason) {
      const status = blockedReason === 'AGE_ELIGIBILITY_REQUIRED' ? 403 : 409;
      return jsonError(blockedReason.replaceAll('_', ' '), status, blockedReason);
    }

    const accountAddress = normalizeHex(identity.account_address, 'account address');
    // The claim row is written BEFORE the relay call so a crash mid-drip still
    // consumes the cooldown rather than allowing an unbounded retry loop.
    const created = await svc.entities.FaucetClaim.create({
      did: String(me.did || ''),
      network: 'SWAPPULSE_TESTNET',
      account_address: accountAddress,
      chain_identity_id: String(identity.chain_identity_id || ''),
      status: 'SUBMITTED',
    });

    try {
      const result = await relayFaucetDrip( { to: accountAddress });
      const txHash = normalizeHex(result?.transaction_hash, 'faucet transaction hash');
      const amount = String(result?.amount || '0');
      await svc.entities.FaucetClaim.update(created.id, {
        status: 'CONFIRMED',
        tx_hash: txHash,
        amount,
        confirmed_at: new Date().toISOString(),
        last_error: '',
      });
      const newBalance = await accountBalance(config, accountAddress).catch(() => balance);
      return Response.json({
        ok: true,
        claim_id: created.id,
        transaction_hash: txHash,
        amount,
        balance: newBalance,
        cooldown_ms_remaining: COOLDOWN_MS,
      });
    } catch (relayError: any) {
      const code = String(relayError?.message || 'FAUCET_RELAY_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
      await svc.entities.FaucetClaim.update(created.id, { status: 'FAILED', last_error: code });
      return jsonError('The faucet could not send testnet SWPX right now', 502, code);
    }
  } catch (error: any) {
    const code = String(error?.message || 'FAUCET_CLAIM_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('faucet-claim failed:', code);
    return jsonError('The faucet request could not be completed', 502, code);
  }
}