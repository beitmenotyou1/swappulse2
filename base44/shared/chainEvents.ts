// Shared appchain state-transition reconciler.
//
// The chain is the source of truth: this module reads the appchain for every
// locally-mirrored record that is still in flight, advances the mirror when the
// chain has moved on, and tells the collector through the normal notification
// pipeline. Notifications are deduplicated by group_key so a repeated poll can
// never notify twice for the same transition.

import { getVerifiedConfig, readContract, u256ToDecimal } from './chainRelay.ts';
import { dispatchNotification } from './notificationDispatcher.ts';

const PAGE = 100;

function u256Calldata(value: unknown): string[] {
  const raw = String(value ?? '0').trim();
  if (!/^[0-9]+$/.test(raw) || BigInt(raw) <= 0n) throw new Error('U256_VALUE_REQUIRED');
  const n = BigInt(raw);
  return [`0x${(n & ((1n << 128n) - 1n)).toString(16)}`, `0x${(n >> 128n).toString(16)}`];
}

function isZero(value: unknown): boolean {
  try { return BigInt(String(value || '0x0')) === 0n; } catch { return true; }
}

// One notification per transition. group_key is the idempotency key: if a row
// with the same key already exists, this transition was already announced.
export async function notifyChainEvent(svc: any, input: {
  did: string;
  actionType: string;
  groupKey: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  targetPath?: string;
}): Promise<boolean> {
  if (!String(input.did || '').trim()) return false;
  const existing = await svc.entities.Notification.filter({ did: input.did, group_key: input.groupKey }, '-created_date', 1).catch(() => []);
  if (existing?.length) return false;

  await svc.entities.Notification.create({
    did: input.did,
    action_type: input.actionType,
    target_type: 'chain',
    target_path: input.targetPath || '/wallet',
    target_label: input.title,
    is_read: false,
    group_key: input.groupKey,
    metadata: input.metadata || {},
    record_type: 'org.swappulse.notification',
  });

  await dispatchNotification(svc, {
    recipientDid: input.did,
    type: input.actionType,
    title: input.title,
    body: input.body,
    params: { ...(input.metadata || {}), did: input.did },
  }).catch(() => null);

  return true;
}

async function reconcileMintedCards(svc: any, config: any) {
  const cardNft = String(config.card_nft_address || '').trim();
  if (!cardNft) return 0;
  const rows = await svc.entities.ChainCardToken.filter({ status: 'SUBMITTED' }, '-created_date', PAGE).catch(() => []);
  let advanced = 0;

  for (const row of rows || []) {
    if (!String(row.token_id || '').trim()) continue;
    try {
      const values = await readContract(String(config.rpc_url), cardNft, 'get_card', u256Calldata(row.token_id));
      // CardRecord: [token_id lo, token_id hi, owner, card_id, level, attestation, minted_at, soulbound]
      const owner = values[2];
      if (isZero(owner)) continue;
      await svc.entities.ChainCardToken.update(row.id, {
        status: 'MINTED',
        owner_address: owner,
        confirmed_at: new Date().toISOString(),
        last_error: '',
      });
      advanced += 1;
      await notifyChainEvent(svc, {
        did: String(row.did || ''),
        actionType: 'chain_mint',
        groupKey: `chain_mint:${row.id}`,
        title: 'Card anchored on chain',
        body: `${row.card_name || 'Your card'} is now confirmed on the SwapPulse appchain.`,
        metadata: { recordId: row.id, tokenId: String(row.token_id), cardName: row.card_name || '', txHash: row.tx_hash || '' },
      });
    } catch (error: any) {
      console.warn('reconcileMintedCards skipped', row.id, String(error?.message || error).slice(0, 80));
    }
  }
  return advanced;
}

async function reconcileStakes(svc: any, config: any) {
  const pool = String(config.staking_pool_address || '').trim();
  if (!pool) return 0;
  const rows = await svc.entities.StakePosition.filter({ status: 'SUBMITTED' }, '-created_date', PAGE).catch(() => []);
  let advanced = 0;

  for (const row of rows || []) {
    if (!String(row.account_address || '').trim() || !String(row.validator_address || '').trim()) continue;
    try {
      const isValidator = String(row.role) === 'validator';
      const values = isValidator
        ? await readContract(String(config.rpc_url), pool, 'get_validator', [String(row.validator_address)])
        : await readContract(String(config.rpc_url), pool, 'get_delegation', [String(row.account_address), String(row.validator_address)]);
      // ValidatorInfo:  [account, identity_id, self_stake, delegated, commission_bps, status, registered_at]
      // DelegationInfo: [delegator, validator, amount, unlock_at, pending_withdrawal]
      const live = isValidator ? BigInt(values[5] || '0x0') === 1n : BigInt(values[2] || '0x0') > 0n;
      if (!live) continue;

      await svc.entities.StakePosition.update(row.id, {
        status: 'ACTIVE',
        security_weight: isValidator ? String(BigInt(values[2] || '0x0') + BigInt(values[3] || '0x0')) : String(BigInt(values[2] || '0x0')),
        last_synced_at: new Date().toISOString(),
        last_error: '',
      });
      advanced += 1;
      await notifyChainEvent(svc, {
        did: String(row.did || ''),
        actionType: 'chain_stake',
        groupKey: `chain_stake:${row.id}`,
        title: isValidator ? 'Your validator is active' : 'Your stake is active',
        body: isValidator
          ? 'Your validator registration is confirmed and now secures the network.'
          : 'Your delegation is confirmed and now secures the network.',
        metadata: { recordId: row.id, validatorAddress: String(row.validator_address), txHash: row.tx_hash || '' },
      });
    } catch (error: any) {
      console.warn('reconcileStakes skipped', row.id, String(error?.message || error).slice(0, 80));
    }
  }
  return advanced;
}

async function reconcileUnbonding(svc: any, config: any) {
  const pool = String(config.staking_pool_address || '').trim();
  if (!pool) return 0;
  const rows = await svc.entities.StakePosition.filter({ status: 'UNBONDING' }, '-created_date', PAGE).catch(() => []);
  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  let advanced = 0;

  for (const row of rows || []) {
    if (!String(row.account_address || '').trim() || !String(row.validator_address || '').trim()) continue;
    try {
      const values = await readContract(String(config.rpc_url), pool, 'get_delegation', [String(row.account_address), String(row.validator_address)]);
      const unlockAt = BigInt(values[3] || '0x0');
      const pending = BigInt(values[4] || '0x0');
      if (pending <= 0n || unlockAt === 0n || unlockAt > nowSeconds) continue;

      await svc.entities.StakePosition.update(row.id, {
        pending_withdrawal: pending.toString(),
        unlock_at: new Date(Number(unlockAt) * 1000).toISOString(),
        last_synced_at: new Date().toISOString(),
      });
      advanced += 1;
      await notifyChainEvent(svc, {
        did: String(row.did || ''),
        actionType: 'chain_unlock',
        groupKey: `chain_unlock:${row.id}:${unlockAt}`,
        title: 'Your unstaked SWPX is claimable',
        body: 'The unbonding period has finished — you can now withdraw your SWPX.',
        metadata: { recordId: row.id, validatorAddress: String(row.validator_address), amount: pending.toString() },
      });
    } catch (error: any) {
      console.warn('reconcileUnbonding skipped', row.id, String(error?.message || error).slice(0, 80));
    }
  }
  return advanced;
}

async function reconcileBridges(svc: any, config: any) {
  const bridge = String(config.bridge_adapter_address || '').trim();
  if (!bridge) return 0;
  const rows = await svc.entities.BridgeTransfer.filter({ status: 'PENDING_RELAY' }, '-created_date', PAGE).catch(() => []);
  let advanced = 0;

  for (const row of rows || []) {
    // The nonce is assigned on chain; without it there is nothing to read yet.
    if (!Number.isInteger(Number(row.nonce)) || Number(row.nonce) <= 0) continue;
    try {
      const values = await readContract(String(config.rpc_url), bridge, 'get_outbound', [`0x${Number(row.nonce).toString(16)}`]);
      // OutboundTransfer: [nonce, sender, asset_kind, destination_chain, amount lo, amount hi, recipient_hash, status, created_at]
      const status = BigInt(values[7] || '0x0');
      if (status === 0n) continue;

      const relayed = status === 1n;
      await svc.entities.BridgeTransfer.update(row.id, {
        status: relayed ? 'COMPLETED' : 'REFUNDED',
        completed_at: new Date().toISOString(),
        last_error: '',
      });
      advanced += 1;
      await notifyChainEvent(svc, {
        did: String(row.did || ''),
        actionType: 'chain_bridge',
        groupKey: `chain_bridge:${row.id}:${relayed ? 'completed' : 'refunded'}`,
        title: relayed ? 'Bridge transfer completed' : 'Bridge transfer refunded',
        body: relayed
          ? `Your ${row.asset_kind === 'card' ? 'card' : 'SWPX'} arrived on ${row.external_chain}.`
          : 'The transfer could not be relayed, so it has been refunded to your account.',
        metadata: {
          recordId: row.id,
          amount: String(row.amount || '0'),
          tokenId: String(row.card_token_id || ''),
          externalChain: String(row.external_chain || ''),
        },
      });
    } catch (error: any) {
      console.warn('reconcileBridges skipped', row.id, String(error?.message || error).slice(0, 80));
    }
  }
  return advanced;
}

async function reconcileUsership(svc: any) {
  const rows = await svc.entities.UsershipScore.filter({ status: 'CONFIRMED' }, '-created_date', PAGE).catch(() => []);
  let notified = 0;
  for (const row of rows || []) {
    const sent = await notifyChainEvent(svc, {
      did: String(row.did || ''),
      actionType: 'chain_usership',
      groupKey: `chain_usership:${row.did}:${row.epoch}`,
      title: 'Your usership score was published',
      body: `Epoch ${row.epoch}: your Proof-of-Usership score is ${row.score}.`,
      metadata: { epoch: row.epoch, score: row.score, did: String(row.did || '') },
      targetPath: `/profile/${String(row.did || '')}`,
    }).catch(() => false);
    if (sent) notified += 1;
  }
  return notified;
}

export async function reconcileChainEvents(svc: any) {
  const config = await getVerifiedConfig(svc);
  if (!config) return { ok: false, reason: 'CHAIN_VERIFICATION_REQUIRED' };

  const [mints, stakes, unlocks, bridges, usership] = [
    await reconcileMintedCards(svc, config),
    await reconcileStakes(svc, config),
    await reconcileUnbonding(svc, config),
    await reconcileBridges(svc, config),
    await reconcileUsership(svc),
  ];

  return { ok: true, mints, stakes, unlocks, bridges, usership };
}

export { u256Calldata, u256ToDecimal };