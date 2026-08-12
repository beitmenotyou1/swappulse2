// §2.4 Achievement runner — shared evaluation + reconciliation logic used by
// both the on-demand (auth, per-user) and the nightly (service-role, bulk)
// functions. Fetches proof data, runs the engine, and reconciles stored
// Achievement records (grant / refresh / revoke), optionally emitting a
// reasoning notification on revocation.

import { evaluateAchievements } from './achievementEngine.ts';
import { ACHIEVEMENT_CONFIG, ACHIEVEMENT_KEYS } from './achievementConfig.ts';
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

export interface ProofData {
  collectionEntries: any[];
  vouches: any[];
  feedback: any[];
  tradeChains: any[];
  corrections: any[];
  binders: any[];
  voiceSpaces: any[];
  setSizes: Record<string, number>;
}

export async function fetchProofDataForUser(
  svc: any,
  did: string,
  opts: { includeSetCompletion: boolean },
): Promise<ProofData> {
  const [collectionEntries, vouches, feedback, tradeChainsAll, corrections, binders, voiceSpaces] =
    await Promise.all([
      svc.entities.CollectionEntry.filter({ did }, '-updated_date', 1000),
      svc.entities.Vouch.filter({ vouched_did: did }, '-created_date', 1000),
      svc.entities.TradingFeedback.filter({ rated_user_did: did }, '-created_date', 200),
      svc.entities.TradeChain.list('-created_date', 200),
      svc.entities.ScannerCorrection.filter({ did }, '-created_date', 500),
      svc.entities.Binder.filter({ did }, '-updated_date', 100),
      svc.entities.VoiceSpace.filter({ did }, '-created_date', 100),
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

  return { collectionEntries, vouches, feedback, tradeChains, corrections, binders, voiceSpaces, setSizes };
}

export function buildRevocationReason(key: string, result: any): string {
  const label = ACHIEVEMENT_CONFIG[key]?.label || key;
  const m = result.metricValue;
  switch (key) {
    case 'trusted_trader':
      return `Your ${label} badge was revoked — distinct vouches dropped to ${m} (minimum 50), trust fell below 40, or a vouch was revoked in the last 6 months.`;
    case 'first_trade':
      return `Your ${label} badge was revoked — no completed trade feedback was found.`;
    case 'chain_weaver':
      return `Your ${label} badge was revoked — no completed multi-party trade chains.`;
    case 'scanner_sage':
      return `Your ${label} badge was revoked — scanner corrections dropped to ${m} (minimum 100).`;
    case 'binder_curator':
      return `Your ${label} badge was revoked — no 5-page binder with 10+ likes.`;
    case 'community_voice':
      return `Your ${label} badge was revoked — no completed voice spaces.`;
    case 'shiny_hunter':
      return `Your ${label} badge was revoked — high-tier cards dropped below 50.`;
    default:
      if (key.startsWith('set_completion_'))
        return `Your ${label} badge was revoked — set completion dropped below the tier threshold.`;
      return `Your ${label} badge was revoked because the proof no longer holds.`;
  }
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
): Promise<{ revokedCount: number }> {
  const { notifyOnRevoke = false, keysToReconcile = ACHIEVEMENT_KEYS } = opts;
  const existing = await svc.entities.Achievement.filter({ did }, '-unlocked_at', 100);
  const byKey = new Map(existing.map((a: any) => [a.achievement_type, a]));
  const now = new Date().toISOString();
  let revokedCount = 0;

  for (const key of keysToReconcile) {
    const r = results[key];
    if (!r) continue;
    const ex: any = byKey.get(key);
    const proofMeta = {
      metricValue: r.metricValue,
      proofSummary: r.proofSummary,
      proofUris: r.proofUris,
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
          status: 'granted', revoked_at: null, unlocked_at: now,
          metadata: { ...(ex.metadata || {}), ...proofMeta },
        });
      } else {
        await svc.entities.Achievement.update(ex.id, {
          metadata: { ...(ex.metadata || {}), ...proofMeta },
        });
      }
    } else if (ex && (!ex.status || ex.status === 'granted') && !ex.revoked_at) {
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
            target_label: buildRevocationReason(key, r), is_read: false,
          });
        } catch (e) {
          console.error('[reconcileAchievements] notify failed', e);
        }
      }
    }
  }
  return { revokedCount };
}

export async function runEvaluationForUser(
  svc: any,
  did: string,
  opts: { includeSetCompletion?: boolean; notifyOnRevoke?: boolean; keysToReconcile?: string[] } = {},
): Promise<{ achievements: any[]; revokedCount: number }> {
  const { includeSetCompletion = true, notifyOnRevoke = false, keysToReconcile } = opts;
  const data = await fetchProofDataForUser(svc, did, { includeSetCompletion });
  const results = evaluateAchievements({ userDid: did, ...data });
  const { revokedCount } = await reconcileAchievements(svc, did, results, {
    notifyOnRevoke,
    keysToReconcile: keysToReconcile || ACHIEVEMENT_KEYS,
  });
  const all = await svc.entities.Achievement.filter({ did }, '-unlocked_at', 100);
  return { achievements: all, revokedCount };
}