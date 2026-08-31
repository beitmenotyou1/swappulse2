import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getVerifiedConfig,
  jsonError,
  normalizeHex,
  readContract,
  relayRecoveryAction,
} from '../../shared/chainRelay.ts';
import { verifyActionToken } from '../../shared/appPasswordCrypto.ts';
import { notifyChainEvent } from '../../shared/chainEvents.ts';

// Device recovery for a self-custodial smart account.
//
// A collector who lost their device still has their SwapPulse login, so the
// session proves who they are — but rotating an account signing key is
// safety-critical, so propose/execute additionally require a fresh MFA step-up
// token. The real protection is on-chain: propose_recovery only schedules the
// rotation, and execute_recovery reverts until the account's configured delay has
// elapsed, giving the true owner a window to cancel a hostile attempt.

const RECOVERABLE = ['REGISTERED', 'MERGED', 'RECOVERED', 'RECOVERY_PENDING'];

async function recoverableIdentity(svc: any, userId: string) {
  const rows = await svc.entities.ChainIdentity.filter({ user_id: userId }, '-created_date', 10).catch(() => []);
  return (rows || []).find((row: any) => RECOVERABLE.includes(String(row.status || ''))) || null;
}

async function requireStepUp(token: string, userId: string) {
  if (!token) throw new Error('STEP_UP_REQUIRED');
  const result = await verifyActionToken(token, 'security_manage', userId).catch(() => ({ valid: false }));
  if (!result?.valid) throw new Error('STEP_UP_INVALID');
}

async function chainRecoveryState(config: any, accountAddress: string) {
  const [pending, delay, nonce] = await Promise.all([
    readContract(String(config.rpc_url), accountAddress, 'get_pending_recovery', []),
    readContract(String(config.rpc_url), accountAddress, 'get_recovery_delay', []),
    readContract(String(config.rpc_url), accountAddress, 'get_recovery_nonce', []),
  ]);
  const pendingKey = String(pending?.[0] || '0x0');
  const executeAfter = Number(BigInt(pending?.[1] || '0x0'));
  return {
    pending: BigInt(pendingKey) !== 0n,
    pending_public_key: pendingKey,
    execute_after: executeAfter,
    execute_after_iso: executeAfter > 0 ? new Date(executeAfter * 1000).toISOString() : null,
    ready: executeAfter > 0 && Math.floor(Date.now() / 1000) >= executeAfter,
    recovery_delay_seconds: Number(BigInt(delay?.[0] || '0x0')),
    recovery_nonce: Number(BigInt(nonce?.[0] || '0x0')),
  };
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
    if (!['status', 'propose', 'execute', 'cancel'].includes(action)) return jsonError('Unknown action', 400, 'UNKNOWN_ACTION');

    const identity = await recoverableIdentity(svc, me.id);
    if (!identity?.account_address) return jsonError('No recoverable on-chain identity was found', 409, 'IDENTITY_NOT_RECOVERABLE');

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');

    const accountAddress = normalizeHex(identity.account_address, 'account address');
    const state = await chainRecoveryState(config, accountAddress);

    if (action === 'status') {
      return Response.json({
        ok: true,
        identity: {
          id: identity.id,
          status: identity.status,
          account_address: accountAddress,
          chain_identity_id: identity.chain_identity_id,
          current_signer_public_key: identity.signer_public_key || '',
          recovery_count: Number(identity.recovery_count || 0),
        },
        recovery: state,
      });
    }

    await requireStepUp(String(body.step_up_token || '').trim(), me.id);

    if (action === 'propose') {
      if (state.pending) return jsonError('A recovery is already scheduled for this account', 409, 'RECOVERY_ALREADY_PENDING');
      const newPublicKey = normalizeHex(body.new_public_key, 'new signer public key');
      if (newPublicKey === normalizeHex(identity.signer_public_key || '0x1', 'current signer public key')) {
        return jsonError('The new signer must differ from the current one', 409, 'SIGNER_UNCHANGED');
      }

      const result = await relayRecoveryAction('propose', { account_address: accountAddress, new_public_key: newPublicKey });
      await svc.entities.ChainIdentity.update(identity.id, {
        status: 'RECOVERY_PENDING',
        recovery_config_tx_hash: String(result?.transaction_hash || ''),
        last_reconciled_at: new Date().toISOString(),
        failure_code: '',
      });

      return Response.json({
        ok: true,
        action,
        transaction_hash: String(result?.transaction_hash || ''),
        recovery: await chainRecoveryState(config, accountAddress),
      });
    }

    if (action === 'cancel') {
      if (!state.pending) return jsonError('There is no scheduled recovery to cancel', 409, 'NO_PENDING_RECOVERY');
      const result = await relayRecoveryAction('cancel', { account_address: accountAddress });
      // Cancelling returns the identity to its previously authoritative state.
      await svc.entities.ChainIdentity.update(identity.id, {
        status: Number(identity.recovery_count || 0) > 0 ? 'RECOVERED' : 'REGISTERED',
        last_reconciled_at: new Date().toISOString(),
      });
      return Response.json({
        ok: true,
        action,
        transaction_hash: String(result?.transaction_hash || ''),
        recovery: await chainRecoveryState(config, accountAddress),
      });
    }

    // execute
    if (!state.pending) return jsonError('There is no scheduled recovery to complete', 409, 'NO_PENDING_RECOVERY');
    if (!state.ready) return jsonError('The recovery waiting period has not finished yet', 409, 'RECOVERY_NOT_READY');

    const result = await relayRecoveryAction('execute', { account_address: accountAddress });
    const rotatedKey = state.pending_public_key;
    await svc.entities.ChainIdentity.update(identity.id, {
      status: 'RECOVERED',
      signer_public_key: rotatedKey,
      recovery_count: Number(identity.recovery_count || 0) + 1,
      last_reconciled_at: new Date().toISOString(),
      failure_code: '',
    });

    await notifyChainEvent(svc, {
      did: String(me.did || ''),
      actionType: 'chain_recovery',
      groupKey: `chain_recovery:${identity.id}:${state.recovery_nonce}`,
      title: 'Account recovery completed',
      body: 'Your smart account is now controlled by your new device key.',
      metadata: { recordId: identity.id, txHash: String(result?.transaction_hash || '') },
    }).catch(() => null);

    return Response.json({
      ok: true,
      action,
      transaction_hash: String(result?.transaction_hash || ''),
      signer_public_key: rotatedKey,
      recovery: await chainRecoveryState(config, accountAddress),
    });
  } catch (error: any) {
    const code = String(error?.message || 'CHAIN_RECOVERY_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('chain-recovery failed:', code);
    const clientError = code.includes('REQUIRED') || code.includes('INVALID') || code.includes('MISMATCH') || code.includes('NOT_READY');
    return jsonError(clientError ? code.replaceAll('_', ' ') : 'The recovery request could not be completed', clientError ? 409 : 502, code);
  }
}