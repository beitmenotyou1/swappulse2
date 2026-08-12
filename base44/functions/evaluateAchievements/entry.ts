// §2.4 On-demand achievement evaluation for the authenticated user.
// Re-evaluates all credentials (including TCGDex-backed set completion) and
// returns the full credential set for the /achievements UI.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { runEvaluationForUser, toDid } from '../../shared/achievementRunner.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const did = toDid(user);
    const { achievements } = await runEvaluationForUser(svc, did, {
      includeSetCompletion: true,
      notifyOnRevoke: false,
    });
    return Response.json({ actorDid: did, achievements, evaluatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[evaluateAchievements] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}