import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  getVerifiedConfig,
  jsonError,
  normalizeHex,
  relaySubmitUsership,
  verifiedContractConfigured,
} from '../../shared/chainRelay.ts';

// Proof-of-Usership aggregation. Verified platform activity already recorded in
// PointsLedger is summed per collector for the current epoch, committed to, and
// submitted on chain where it scales that collector's own staked weight.
//
// Reputation never substitutes for stake: the contract multiplies existing stake,
// so a collector with no stake has no security weight however active they are.

const MAX_SCORE = 1_000_000;
const BATCH_LIMIT = 400;

// Only activity that represents real, verifiable platform participation counts.
const SCORED_ACTIONS = new Set([
  'TRADE_COMPLETED',
  'VOUCH_GIVEN',
  'JOURNAL_PUBLISHED',
  'PACK_OPENING',
  'BINDER_SHOWCASED',
  'CARD_REVIEW_POSTED',
]);

async function commitment(entries: string[]): Promise<string> {
  const canonical = `swappulse-usership:${[...entries].sort().join(',')}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `0x${(BigInt(`0x${hex}`) >> 8n).toString(16)}`;
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return jsonError('Method not allowed', 405);
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return jsonError('Unauthorized', 401);
    if (me.role !== 'admin') return jsonError('Forbidden', 403);
    const svc = base44.asServiceRole;

    const config = await getVerifiedConfig(svc);
    if (!config) return jsonError('SwapPulse Testnet verification pins are stale or incomplete', 409, 'CHAIN_VERIFICATION_REQUIRED');
    if (!verifiedContractConfigured(config, 'usership')) {
      return jsonError('Proof-of-Usership is not independently verified on this network yet', 409, 'USERSHIP_NOT_VERIFIED');
    }

    const epoch = Number(config.usership_epoch || 1);
    if (!Number.isInteger(epoch) || epoch < 1) return jsonError('Invalid usership epoch', 409, 'INVALID_EPOCH');

    const ledger = await svc.entities.PointsLedger.filter({ processed: false }, 'created_date', BATCH_LIMIT).catch(() => []);
    if (!ledger?.length) {
      return Response.json({ ok: true, epoch, collectors_scored: 0, message: 'No unprocessed activity to aggregate' });
    }

    // Group the activity per collector wallet.
    const byWallet = new Map<string, { points: number; ids: string[]; breakdown: Record<string, number>; did: string }>();
    for (const entry of ledger) {
      const action = String(entry.action || '');
      if (!SCORED_ACTIONS.has(action)) continue;
      const wallet = String(entry.user_wallet || '').trim().toLowerCase();
      if (!wallet) continue;
      const points = Number(entry.points || 0);
      if (!Number.isFinite(points) || points <= 0) continue;

      const bucket = byWallet.get(wallet) || { points: 0, ids: [], breakdown: {}, did: String(entry.user_did || '') };
      bucket.points += points;
      bucket.ids.push(String(entry.id));
      bucket.breakdown[action] = (bucket.breakdown[action] || 0) + points;
      byWallet.set(wallet, bucket);
    }

    const results: Array<Record<string, unknown>> = [];
    for (const [wallet, bucket] of byWallet.entries()) {
      // Only a collector with a secured on-chain identity can hold a score.
      const identities = await svc.entities.ChainIdentity.filter({ account_address: wallet }, '-created_date', 1).catch(() => []);
      const identity = identities?.[0];
      if (!identity?.chain_identity_id || !['REGISTERED', 'MERGED', 'RECOVERED'].includes(String(identity.status || ''))) {
        results.push({ wallet, skipped: 'NO_SECURED_IDENTITY' });
        continue;
      }

      const score = Math.min(MAX_SCORE, Math.floor(bucket.points));
      const activityRoot = await commitment(bucket.ids);

      const existing = await svc.entities.UsershipScore
        .filter({ chain_identity_id: identity.chain_identity_id, epoch }, '-created_date', 1)
        .catch(() => []);
      if (existing?.[0] && existing[0].status === 'CONFIRMED') {
        results.push({ wallet, skipped: 'EPOCH_ALREADY_CONFIRMED' });
        continue;
      }

      const record = existing?.[0] || await svc.entities.UsershipScore.create({
        did: bucket.did,
        network: 'SWAPPULSE_TESTNET',
        chain_identity_id: String(identity.chain_identity_id),
        account_address: wallet,
        epoch,
        score,
        activity_root: activityRoot,
        breakdown: bucket.breakdown,
        points_considered: bucket.ids.length,
        status: 'AGGREGATED',
      });

      try {
        const submitted = await relaySubmitUsership({
          identity_id: normalizeHex(identity.chain_identity_id, 'chain identity id'),
          account: normalizeHex(wallet, 'account address'),
          score,
          activity_root: activityRoot,
          epoch,
        });
        const txHash = normalizeHex(submitted?.transaction_hash, 'usership transaction hash');
        await svc.entities.UsershipScore.update(record.id, {
          status: 'CONFIRMED',
          score,
          activity_root: activityRoot,
          breakdown: bucket.breakdown,
          points_considered: bucket.ids.length,
          tx_hash: txHash,
          submitted_at: new Date().toISOString(),
          last_error: '',
        });
        // Mark the source activity consumed only after the chain accepted it, so
        // a failed submission is retried on the next run rather than lost.
        await svc.entities.PointsLedger.bulkUpdate(
          bucket.ids.map((id) => ({ id, processed: true, processed_epoch: epoch, processed_at: new Date().toISOString() })),
        );
        results.push({ wallet, score, transaction_hash: txHash });
      } catch (submitError: any) {
        const code = String(submitError?.message || 'USERSHIP_SUBMIT_FAILED').slice(0, 200);
        await svc.entities.UsershipScore.update(record.id, { status: 'FAILED', last_error: code });
        results.push({ wallet, error: code });
      }
    }

    return Response.json({
      ok: true,
      epoch,
      collectors_scored: results.filter((r) => r.score !== undefined).length,
      results,
    });
  } catch (error: any) {
    const code = String(error?.message || 'USERSHIP_AGGREGATE_FAILED').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 120);
    console.error('usership-aggregate failed:', code);
    return jsonError('Proof-of-Usership aggregation failed', 502, code);
  }
}