// §2.4 Achievement runner — shared fetch + reconciliation used by the on-demand
// (auth, per-user) and nightly (service-role, bulk) functions. Fetches proof
// data, runs the engine, and reconciles stored Achievement records with:
//  - Proof-capture snapshots: on every grant an immutable AchievementProofSnapshot
//    is stored with a SHA-256 integrity hash, so the credential stays verifiable
//    even if the underlying AT Protocol records are later deleted/modified.
//  - Revocation grace period (global_settings.revocation_grace_period_hours): a
//    failing proof enters pending-revocation first; full revocation + reasoning
//    notification only fires once the grace elapses (and clears if it recovers).
//  - Earned/revoked event stream returned to the caller for email dispatch.

import { evaluateAchievements, EngineInput } from './achievementEngine.ts';
import { ACHIEVEMENT_CONFIG, ACHIEVEMENT_KEYS, GLOBAL_SETTINGS } from './achievementConfig.ts';
import { buildRestorationPath } from './achievementNotifications.ts';
import { fetchTcgdex, normalizeSetId } from './tcgdexClient.ts';

export function toDid(user: any): string {
  return user.did || 'did:plc:' + String(user.id).replace(/-/g, '').slice(0, 24);
}

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchSetSizes(setIds: string[]): Promise<Record<string, number>> {
  const sizes: Record<string, number> = {};
  for (const id of setIds) {
    if (!id) continue;
    try {
      const data = await fetchTcgdex(`/sets/${encodeURIComponent(normalizeSetId(id))}`);
      const total = data && Array.isArray(data.cards) ? data.cards.length : (data?.cardCount ?? 0);
      if (total) sizes[id] = total;
    } catch {
      // skip — set completion won't evaluate for this set this cycle
    }
  }
  return sizes;
}

function buildParticipantMaps(
  spaceParticipants: any[],
  meetupRsvps: any[],
  userSpaceIds: Set<string>,
  userMeetupIds: Set<string>,
): { participantsBySpaceId: Record<string, number>; rsvpsByMeetupId: Record<string, number> } {
  const partMap = new Map<string, Set<string>>();
  for (const p of spaceParticipants) {
    if (!userSpaceIds.has(p.space_id)) continue;
    if (!partMap.has(p.space_id)) partMap.set(p.space_id, new Set());
    partMap.get(p.space_id)!.add(p.did);
  }
  const participantsBySpaceId: Record<string, number> = {};
  for (const [k, v] of partMap) participantsBySpaceId[k] = v.size;

  const rsvpMap = new Map<string, number>();
  for (const r of meetupRsvps) {
    if (!userMeetupIds.has(r.meetup_id) || r.attending !== 'yes') continue;
    rsvpMap.set(r.meetup_id, (rsvpMap.get(r.meetup_id) || 0) + 1);
  }
  const rsvpsByMeetupId: Record<string, number> = {};
  for (const [k, v] of rsvpMap) rsvpsByMeetupId[k] = v;
  return { participantsBySpaceId, rsvpsByMeetupId };
}

export interface ProofData extends EngineInput {}

export async function fetchProofDataForUser(
  svc: any,
  did: string,
  opts: { includeSetCompletion: boolean },
): Promise<ProofData> {
  const [
    collectionEntries, vouches, feedback, tradeChainsAll, corrections, binders,
    voiceSpaces, cardReviews, meetups, spaceParticipants, meetupRsvps,
  ] = await Promise.all([
    svc.entities.CollectionEntry.filter({ did }, '-updated_date', 1000),
    svc.entities.Vouch.filter({ vouched_did: did }, '-created_date', 1000),
    svc.entities.TradingFeedback.filter({ rated_user_did: did }, '-created_date', 200),
    svc.entities.TradeChain.list('-created_date', 200),
    svc.entities.ScannerCorrection.filter({ did }, '-created_date', 500).catch(() => []),
    svc.entities.Binder.filter({ did }, '-updated_date', 100),
    svc.entities.VoiceSpace.filter({ did }, '-created_date', 100),
    svc.entities.CardReview.filter({ did }, '-created_date', 500),
    svc.entities.Meetup.filter({ did }, '-created_date', 100),
    svc.entities.SpaceParticipant.list('-created_date', 1000),
    svc.entities.MeetupRsvp.list('-created_date', 1000),
  ]);
  const tradeChains = tradeChainsAll.filter((c: any) => (c.participant_dids || []).includes(did));

  // Compute per-voucher trust scores for the Trusted Trader gate.
  // Batch-fetch incoming vouches for all distinct voucher DIDs in a single query.
  const RELATIONSHIP_WEIGHT: Record<string, number> = {
    repeat_trader: 3, trade_partner: 2, personal_acquaintance: 2, community_member: 1,
  };
  const voucherDids = [...new Set(
    vouches.filter((v: any) => !v.revoked_at && v.did && v.did !== did).map((v: any) => v.did),
  )];
  const allVoucherVouches = voucherDids.length > 0
    ? await svc.entities.Vouch.filter({ vouched_did: { $in: voucherDids } }, '-created_date', 2000).catch(() => [])
    : [];
  const vouchesByVouched = new Map<string, any[]>();
  for (const v of allVoucherVouches) {
    if (!vouchesByVouched.has(v.vouched_did)) vouchesByVouched.set(v.vouched_did, []);
    vouchesByVouched.get(v.vouched_did)!.push(v);
  }
  const voucherTrustScores: Record<string, number> = {};
  for (const d of voucherDids) {
    const incoming = vouchesByVouched.get(d) || [];
    const active = incoming.filter((v: any) => !v.revoked_at);
    const seen = new Map<string, any>();
    for (const v of active) if (!seen.has(v.did)) seen.set(v.did, v);
    const rawScore = [...seen.values()].reduce((s, v) => s + (RELATIONSHIP_WEIGHT[v.relationship] || 1), 0);
    voucherTrustScores[d] = Math.min(100, Math.round(rawScore * 8));
  }

  let setSizes: Record<string, number> = {};
  if (opts.includeSetCompletion) {
    const setCount = new Map<string, number>();
    for (const e of collectionEntries) {
      if (e.set_id) setCount.set(e.set_id, (setCount.get(e.set_id) || 0) + 1);
    }
    const topSets = [...setCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
    setSizes = await fetchSetSizes(topSets);
  }

  const userSpaceIds = new Set(voiceSpaces.map((s: any) => s.id));
  const userMeetupIds = new Set(meetups.map((m: any) => m.id));
  const { participantsBySpaceId, rsvpsByMeetupId } = buildParticipantMaps(
    spaceParticipants, meetupRsvps, userSpaceIds, userMeetupIds,
  );

  return {
    userDid: did, collectionEntries, vouches, feedback, tradeChains, corrections, binders,
    voiceSpaces, cardReviews, meetups, setSizes, participantsBySpaceId, rsvpsByMeetupId,
    voucherTrustScores,
  };
}

export function buildRevocationReason(key: string): string {
  const name = ACHIEVEMENT_CONFIG[key]?.name || key;
  return `Your ${name} achievement was revoked, the eligibility proof no longer holds. (Revocation finalized after the ${GLOBAL_SETTINGS.revocation_grace_period_hours}h grace period.)`;
}

// Captures an immutable proof snapshot for a freshly granted achievement and
// returns the integrity hash (also stored on the achievement metadata).
async function captureProofSnapshot(
  svc: any,
  did: string,
  key: string,
  result: any,
  achievementRecordId: string,
): Promise<string> {
  const cfg = ACHIEVEMENT_CONFIG[key];
  const proofRequirementHash = await sha256Hex(JSON.stringify(cfg?.proof_requirements || {}));
  const records = await Promise.all((result.proofRecords || []).map(async (r: any) => ({
    uri: r.uri,
    cid: r.cid,
    recordType: r.recordType,
    verifiedAt: r.verifiedAt,
    recordDigest: await sha256Hex(`${r.uri}|${r.cid}|${r.recordType}|${r.verifiedAt}`),
  })));
  const capturedAt = new Date().toISOString();
  const snapshot: any = { version: '1.0', userDid: did, achievementId: key, capturedAt, proofRequirementHash, records };
  const integrityHash = await sha256Hex(JSON.stringify(snapshot)); // hash over snapshot WITHOUT integrityHash
  snapshot.integrityHash = integrityHash;
  try {
    await svc.entities.AchievementProofSnapshot.create({
      achievement_record_id: achievementRecordId, did, achievement_id: key,
      snapshot_data: snapshot, snapshot_hash: integrityHash, captured_at: capturedAt,
    });
  } catch (e) {
    console.error('[captureProofSnapshot] failed', key, e);
  }
  return integrityHash;
}

async function createAchievementNotification(
  svc: any,
  did: string,
  kind: 'earned' | 'revoked',
  key: string,
  reason?: string,
  restorationPath?: string,
): Promise<void> {
  const cfg = ACHIEVEMENT_CONFIG[key];
  try {
    await svc.entities.Notification.create({
      did, action_type: 'reputation', actor_name: 'SwapPulse', actor_handle: 'swappulse',
      target_type: 'profile', target_path: '/achievements',
      target_label: kind === 'earned' ? `${cfg?.name || key} unlocked` : buildRevocationReason(key),
      is_read: false,
      metadata: { kind, achievementId: key, achievementName: cfg?.name, tier: cfg?.tier, reason, restorationPath },
    });
  } catch (e) {
    console.error('[createAchievementNotification] failed', key, e);
  }
}

export interface AchievementEvent {
  key: string;
  kind: 'earned' | 'revoked';
  name: string;
  tier?: string;
  reason?: string;
  restorationPath?: string;
}

export interface ReconcileOptions {
  notifyOnRevoke?: boolean;
  notifyOnEarn?: boolean;
  keysToReconcile?: string[];
}

export async function reconcileAchievements(
  svc: any,
  did: string,
  results: Record<string, any>,
  opts: ReconcileOptions = {},
): Promise<{ revokedCount: number; pendingCount: number; earnedCount: number; events: AchievementEvent[] }> {
  const { notifyOnRevoke = false, notifyOnEarn = false, keysToReconcile = ACHIEVEMENT_KEYS } = opts;
  const graceHours = GLOBAL_SETTINGS.revocation_grace_period_hours || 0;
  const existing = await svc.entities.Achievement.filter({ did }, '-unlocked_at', 100);
  const byKey = new Map(existing.map((a: any) => [a.achievement_type, a]));
  const now = new Date().toISOString();
  let revokedCount = 0, pendingCount = 0, earnedCount = 0;
  const events: AchievementEvent[] = [];

  for (const key of keysToReconcile) {
    const r = results[key];
    if (!r) continue;
    const cfg = ACHIEVEMENT_CONFIG[key];
    const ex: any = byKey.get(key);
    const proofMeta: any = {
      metricValue: r.metricValue,
      proofSummary: r.proofSummary,
      proofRecords: r.proofRecords,
      lastEvaluatedAt: now,
    };

    if (r.qualified) {
      if (!ex) {
        const created = await svc.entities.Achievement.create({
          achievement_type: key, did, status: 'granted', unlocked_at: now,
          related_uri: r.relatedUri || undefined, metadata: proofMeta,
        });
        const integrityHash = await captureProofSnapshot(svc, did, key, r, created.id);
        await svc.entities.Achievement.update(created.id, { metadata: { ...proofMeta, integrityHash } });
        earnedCount++;
        events.push({ key, kind: 'earned', name: cfg?.name || key, tier: cfg?.tier });
        if (notifyOnEarn) await createAchievementNotification(svc, did, 'earned', key);
      } else if (ex.status === 'revoked' || ex.revoked_at) {
        const integrityHash = await captureProofSnapshot(svc, did, key, r, ex.id);
        await svc.entities.Achievement.update(ex.id, {
          status: 'granted', revoked_at: null, pending_revocation_at: null, unlocked_at: now,
          metadata: { ...(ex.metadata || {}), ...proofMeta, integrityHash },
        });
        earnedCount++;
        events.push({ key, kind: 'earned', name: cfg?.name || key, tier: cfg?.tier });
        if (notifyOnEarn) await createAchievementNotification(svc, did, 'earned', key);
      } else {
        const update: any = { metadata: { ...(ex.metadata || {}), ...proofMeta } };
        if (ex.pending_revocation_at) update.pending_revocation_at = null;
        await svc.entities.Achievement.update(ex.id, update);
      }
    } else if (ex && (!ex.status || ex.status === 'granted') && !ex.revoked_at) {
      if (graceHours > 0 && !ex.pending_revocation_at) {
        await svc.entities.Achievement.update(ex.id, {
          pending_revocation_at: now, metadata: { ...(ex.metadata || {}), lastEvaluatedAt: now },
        });
        pendingCount++;
      } else if (graceHours > 0 && ex.pending_revocation_at) {
        const elapsedHours = (Date.now() - new Date(ex.pending_revocation_at).getTime()) / 3600000;
        if (elapsedHours >= graceHours) {
          const reason = buildRevocationReason(key);
          const restorationPath = buildRestorationPath(cfg);
          await svc.entities.Achievement.update(ex.id, {
            status: 'revoked', revoked_at: now, pending_revocation_at: null,
            metadata: { ...(ex.metadata || {}), lastEvaluatedAt: now },
          });
          revokedCount++;
          events.push({ key, kind: 'revoked', name: cfg?.name || key, tier: cfg?.tier, reason, restorationPath });
          if (notifyOnRevoke) await createAchievementNotification(svc, did, 'revoked', key, reason, restorationPath);
        } else {
          await svc.entities.Achievement.update(ex.id, {
            metadata: { ...(ex.metadata || {}), lastEvaluatedAt: now },
          });
        }
      } else {
        const reason = buildRevocationReason(key);
        const restorationPath = buildRestorationPath(cfg);
        await svc.entities.Achievement.update(ex.id, {
          status: 'revoked', revoked_at: now,
          metadata: { ...(ex.metadata || {}), lastEvaluatedAt: now },
        });
        revokedCount++;
        events.push({ key, kind: 'revoked', name: cfg?.name || key, tier: cfg?.tier, reason, restorationPath });
        if (notifyOnRevoke) await createAchievementNotification(svc, did, 'revoked', key, reason, restorationPath);
      }
    }
  }
  return { revokedCount, pendingCount, earnedCount, events };
}

export async function runEvaluationForUser(
  svc: any,
  did: string,
  opts: { includeSetCompletion?: boolean; notifyOnRevoke?: boolean; notifyOnEarn?: boolean; keysToReconcile?: string[] } = {},
): Promise<{ achievements: any[]; revokedCount: number; pendingCount: number; earnedCount: number; events: AchievementEvent[] }> {
  const { includeSetCompletion = true, notifyOnRevoke = false, notifyOnEarn = false, keysToReconcile } = opts;
  const data = await fetchProofDataForUser(svc, did, { includeSetCompletion });
  const results = evaluateAchievements(data);
  const { revokedCount, pendingCount, earnedCount, events } = await reconcileAchievements(svc, did, results, {
    notifyOnRevoke,
    notifyOnEarn,
    keysToReconcile: keysToReconcile || ACHIEVEMENT_KEYS,
  });
  const all = await svc.entities.Achievement.filter({ did }, '-unlocked_at', 100);
  return { achievements: all, revokedCount, pendingCount, earnedCount, events };
}