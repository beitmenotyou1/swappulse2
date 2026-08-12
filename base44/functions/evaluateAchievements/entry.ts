// §2.4 evaluateAchievements — runs the proof-based achievement engine for the
// authenticated user, reconciles results with stored Achievement records
// (granting new ones, refreshing proof, revoking ones whose proof no longer
// holds), and returns the full credential set for the UI.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { evaluateAchievements, ACHIEVEMENT_KEYS } from '../../shared/achievementEngine.ts';
import { fetchTcgdex } from '../../shared/tcgdexClient.ts';

function toDid(user: any): string {
  return user.did || 'did:plc:' + String(user.id).replace(/-/g, '').slice(0, 24);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const actorDid = toDid(user);

    // 1. Fetch proof data
    const [collectionEntries, vouches, feedback, tradeChainsAll, corrections, binders, voiceSpaces] =
      await Promise.all([
        svc.entities.CollectionEntry.filter({ did: actorDid }, '-updated_date', 1000),
        svc.entities.Vouch.filter({ vouched_did: actorDid }, '-created_date', 1000),
        svc.entities.TradingFeedback.filter({ rated_user_did: actorDid }, '-created_date', 200),
        svc.entities.TradeChain.list('-created_date', 200),
        svc.entities.ScannerCorrection.filter({ did: actorDid }, '-created_date', 500),
        svc.entities.Binder.filter({ did: actorDid }, '-updated_date', 100),
        svc.entities.VoiceSpace.filter({ did: actorDid }, '-created_date', 100),
      ]);
    const tradeChains = tradeChainsAll.filter((c: any) =>
      (c.participant_dids || []).includes(actorDid),
    );

    // 2. TCGDex set sizes for the user's top 8 sets (for set-completion proof)
    const setCount = new Map<string, number>();
    for (const e of collectionEntries) {
      if (e.set_id) setCount.set(e.set_id, (setCount.get(e.set_id) || 0) + 1);
    }
    const topSets = [...setCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);
    const setSizes: Record<string, number> = {};
    for (const id of topSets) {
      try {
        const data = await fetchTcgdex(`/sets/${encodeURIComponent(id)}`);
        const total =
          data && Array.isArray(data.cards) ? data.cards.length : (data?.cardCount ?? 0);
        if (total) setSizes[id] = total;
      } catch {
        // skip — set completion won't evaluate for this set this cycle
      }
    }

    // 3. Run the engine
    const results = evaluateAchievements({
      userDid: actorDid,
      collectionEntries,
      vouches,
      feedback,
      tradeChains,
      corrections,
      binders,
      voiceSpaces,
      setSizes,
    });

    // 4. Reconcile with stored records
    const existing = await svc.entities.Achievement.filter({ did: actorDid }, '-unlocked_at', 100);
    const byKey = new Map(existing.map((a: any) => [a.achievement_type, a]));
    const now = new Date().toISOString();

    for (const key of ACHIEVEMENT_KEYS) {
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
            achievement_type: key,
            did: actorDid,
            status: 'granted',
            unlocked_at: now,
            related_uri: r.relatedUri || undefined,
            metadata: proofMeta,
          });
        } else if (ex.status === 'revoked' || ex.revoked_at) {
          // re-grant
          await svc.entities.Achievement.update(ex.id, {
            status: 'granted',
            revoked_at: null,
            unlocked_at: now,
            metadata: { ...(ex.metadata || {}), ...proofMeta },
          });
        } else {
          // refresh proof metadata
          await svc.entities.Achievement.update(ex.id, {
            metadata: { ...(ex.metadata || {}), ...proofMeta },
          });
        }
      } else if (ex && (!ex.status || ex.status === 'granted') && !ex.revoked_at) {
        // revoke — proof no longer holds
        await svc.entities.Achievement.update(ex.id, {
          status: 'revoked',
          revoked_at: now,
          metadata: { ...(ex.metadata || {}), lastEvaluatedAt: now },
        });
      }
    }

    // 5. Return full set
    const all = await svc.entities.Achievement.filter({ did: actorDid }, '-unlocked_at', 100);
    return Response.json({ actorDid, achievements: all, evaluatedAt: now });
  } catch (error) {
    console.error('[evaluateAchievements] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}