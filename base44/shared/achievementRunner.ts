// §2.4 Achievement runner — shared fetch + reconciliation used by the on-demand
// (auth, per-user) and nightly (service-role, bulk) functions. Fetches proof
// data, runs the engine, and reconciles stored Achievement records with a
// revocation grace period (global_settings.revocation_grace_period_hours):
// when a proof stops holding, the credential enters a pending-revocation
// state and is only revoked (with a reasoning notification) once the grace
// period elapses, so transient dips don't yank badges.

import { evaluateAchievements, EngineInput } from './achievementEngine.ts';
import { ACHIEVEMENT_CONFIG, ACHIEVEMENT_KEYS, GLOBAL_SETTINGS } from './achievementConfig.ts';
import { fetchTcgdex } from './tcgdexClient.ts';

export function toDid(user: any): string {
  return user.did || 'did:plc:' + String(user.id).replace(/-/g, '').slice(0, 24);
}

async function fetchSetSizes(setIds: string[]): Promise<Record<string, number>> {
  const sizes: Record<string, number> = {};
  for (const id of setIds) {
    if (!id) continue;
    try {
      const data = await fetchTcgdex(`/sets/${encodeURIComponent(id)}`);
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
    svc.entities.ScannerCorrection.filter({ did }, '-created_date', 500),
    svc.entities.Binder.filter({ did }, '-updated_date', 100),
    svc.entities.VoiceSpace.filter({ did }, '-created_date', 100),
    svc.entities.CardReview.filter({ did }, '-created_date', 500),
    svc.entities.Meetup.filter({ did }, '-created_date', 100),
    svc.entities.SpaceParticipant.list('-created_date', 1000),
    svc.entities.MeetupRsvp.list('-created_date', 1000),
  ]);
  const tradeChains = tradeChainsAll.filter((c: any) => (c.participant_dids || []).includes(did));

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
  };
}

export function buildRevocationReason(key: string): string {
  const name = ACHIEVEMENT_CONFIG[key]?.name || key;
  return `Your ${name} achievement was revoked — the eligibility proof no longer holds. (Revocation finalized after the ${GLOBAL_SETTINGS.revocation_grace_period_hours}h grace period.)`;
}

export interface ReconcileOptions {
  notifyOnRevoke?: boolean;
  keysToReconcile?: string[];
}

export async function reconcileAchievements(
  svc: any,
  did: string,
  results: Record<string, any>,
  opts: ReconcileOptions = {},
): Promise<{ revokedCount: number; pendingCount: number }> {
  const { notifyOnRevoke = false, keysToReconcile = ACHIEVEMENT_KEYS } = opts;
  const graceHours = GLOBAL_SETTINGS.revocation_grace_period_hours || 0;
  const existing = await svc.entities.Achievement.filter({ did }, '-unlocked_at', 100);
  const byKey = new Map(existing.map((a: any) => [a.achievement_type, a]));
  const now = new Date().toISOString();
  let revokedCount = 0;
  let pendingCount = 0;

  for (const key of keysToReconcile) {
    const r = results[key];
    if (!r) continue;
    const ex: any = byKey.get(key);
    const proofMeta = {
      metricValue: r.metricValue,
      proofSummary: r.proofSummary,
      proofRecords: r.proofRecords,
      lastEvaluatedAt: now,
    };

    if (r.qualified) {
      if (!ex) {
        await svc.entities.Achievement.create({
          achievement_type: key, did, status: 'granted', unlocked_at: now,
          related_uri: r.relatedUri || undefined, metadata: proofMeta,
        });
      } else if (ex.status === 'revoked' || ex.revoked_at) {
        await svc.entities.Achievement.update(ex.id, {
          status: 'granted', revoked_at: null, pending_revocation_at: null, unlocked_at: now,
          metadata: { ...(ex.metadata || {}), ...proofMeta },
        });
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
          await svc.entities.Achievement.update(ex.id, {
            status: 'revoked', revoked_at: now, pending_revocation_at: null,
            metadata: { ...(ex.metadata || {}), lastEvaluatedAt: now },
          });
          revokedCount++;
          if (notifyOnRevoke) {
            try {
              await svc.entities.Notification.create({
                did, action_type: 'reputation', actor_name: 'SwapPulse', actor_handle: 'swappulse',
                target_type: 'profile', target_path: '/achievements',
                target_label: buildRevocationReason(key), is_read: false,
              });
            } catch (e) {
              console.error('[reconcileAchievements] notify failed', e);
            }
          }
        } else {
          await svc.entities.Achievement.update(ex.id, {
            metadata: { ...(ex.metadata || {}), lastEvaluatedAt: now },
          });
        }
      } else {
        await svc.entities.Achievement.update(ex.id, {
          status: 'revoked', revoked_at: now,
          metadata: { ...(ex.metadata || {}), lastEvaluatedAt: now },
        });
        revokedCount++;
        if (notifyOnRevoke) {
          try {
            await svc.entities.Notification.create({
              did, action_type: 'reputation', actor_name: 'SwapPulse', actor_handle: 'swappulse',
              target_type: 'profile', target_path: '/achievements',
              target_label: buildRevocationReason(key), is_read: false,
            });
          } catch (e) {
            console.error('[reconcileAchievements] notify failed', e);
          }
        }
      }
    }
  }
  return { revokedCount, pendingCount };
}

export async function runEvaluationForUser(
  svc: any,
  did: string,
  opts: { includeSetCompletion?: boolean; notifyOnRevoke?: boolean; keysToReconcile?: string[] } = {},
): Promise<{ achievements: any[]; revokedCount: number; pendingCount: number }> {
  const { includeSetCompletion = true, notifyOnRevoke = false, keysToReconcile } = opts;
  const data = await fetchProofDataForUser(svc, did, { includeSetCompletion });
  const results = evaluateAchievements(data);
  const { revokedCount, pendingCount } = await reconcileAchievements(svc, did, results, {
    notifyOnRevoke,
    keysToReconcile: keysToReconcile || ACHIEVEMENT_KEYS,
  });
  const all = await svc.entities.Achievement.filter({ did }, '-unlocked_at', 100);
  return { achievements: all, revokedCount, pendingCount };
}