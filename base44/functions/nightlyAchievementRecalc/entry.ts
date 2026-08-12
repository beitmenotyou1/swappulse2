// §2.4 Nightly achievement recalculation (trust graph service).
// Bulk-fetches trust/community proof data once, partitions by holder DID, and
// re-evaluates the credentials that can change due to other users' actions
// (vouches revoked, feedback, chains, corrections, binders, voice spaces).
// Set completion + shiny hunter are intentionally left untouched (they depend
// on the user's own collection and TCGDex, re-evaluated on-demand).
// On revocation, emits a reasoning notification to the holder.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { evaluateAchievements } from '../../shared/achievementEngine.ts';
import { reconcileAchievements, toDid } from '../../shared/achievementRunner.ts';
import { NIGHTLY_KEYS } from '../../shared/achievementConfig.ts';

const MAX_USERS = 200;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const [vouches, feedback, chains, corrections, binders, voiceSpaces, users] = await Promise.all([
      svc.entities.Vouch.list('-created_date', 2000),
      svc.entities.TradingFeedback.list('-created_date', 2000),
      svc.entities.TradeChain.list('-created_date', 1000),
      svc.entities.ScannerCorrection.list('-created_date', 2000),
      svc.entities.Binder.list('-updated_date', 2000),
      svc.entities.VoiceSpace.list('-created_date', 2000),
      svc.entities.User.list('-created_date', 500),
    ]);

    const dids = new Set<string>();
    for (const u of users) dids.add(toDid(u));
    for (const v of vouches) if (v.vouched_did) dids.add(v.vouched_did);
    for (const f of feedback) if (f.rated_user_did) dids.add(f.rated_user_did);
    for (const c of chains) for (const d of (c.participant_dids || [])) dids.add(d);
    for (const c of corrections) if (c.did) dids.add(c.did);
    for (const b of binders) if (b.did) dids.add(b.did);
    for (const s of voiceSpaces) if (s.did) dids.add(s.did);

    const didList = [...dids].slice(0, MAX_USERS);
    let processed = 0;
    let revoked = 0;
    const errors: string[] = [];

    for (const did of didList) {
      try {
        const slice = {
          userDid: did,
          collectionEntries: [],
          vouches: vouches.filter((v: any) => v.vouched_did === did),
          feedback: feedback.filter((f: any) => f.rated_user_did === did),
          tradeChains: chains.filter((c: any) => (c.participant_dids || []).includes(did)),
          corrections: corrections.filter((c: any) => c.did === did),
          binders: binders.filter((b: any) => b.did === did),
          voiceSpaces: voiceSpaces.filter((s: any) => s.did === did),
          setSizes: {} as Record<string, number>,
        };
        const results = evaluateAchievements(slice);
        const { revokedCount } = await reconcileAchievements(svc, did, results, {
          notifyOnRevoke: true,
          keysToReconcile: NIGHTLY_KEYS,
        });
        processed++;
        revoked += revokedCount;
      } catch (e: any) {
        errors.push(`${did}: ${e.message}`);
        console.error('[nightlyAchievementRecalc] did', did, e);
      }
    }

    return Response.json({
      processed,
      revoked,
      candidates: didList.length,
      skippedSetCompletion: true,
      errors: errors.slice(0, 10),
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[nightlyAchievementRecalc] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}