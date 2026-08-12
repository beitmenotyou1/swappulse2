// §2.4 On-demand achievement evaluation for the authenticated user.
// Re-evaluates all credentials (including TCGDex-backed set completion) and
// returns the full credential set + the versioned config for the UI. Emits an
// in-app + email notification when a credential is newly earned.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { runEvaluationForUser, toDid } from '../../shared/achievementRunner.ts';
import { ACHIEVEMENT_CONFIG_RAW } from '../../shared/achievementConfig.ts';
import { buildAchievementEmailHtml, buildAchievementEmailSubject } from '../../shared/achievementNotifications.ts';

const APP_URL = 'https://swappulse.org';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const did = toDid(user);
    const { achievements, events } = await runEvaluationForUser(svc, did, {
      includeSetCompletion: true,
      notifyOnRevoke: false,
      notifyOnEarn: true,
    });

    // Email newly-earned achievements to the registered user (SendEmail reaches
    // registered app users). Best-effort — never blocks the response.
    const earned = events.filter((e: any) => e.kind === 'earned');
    if (earned.length > 0 && user.email) {
      for (const e of earned) {
        try {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: buildAchievementEmailSubject('earned', e.name),
            body: buildAchievementEmailHtml('earned', {
              achievementName: e.name, tier: e.tier, timestamp: new Date().toISOString(),
              viewUrl: `${APP_URL}/achievements`,
            }),
          });
        } catch (err) {
          console.error('[evaluateAchievements] earned email failed', e.key, err);
        }
      }
    }

    return Response.json({
      actorDid: did,
      achievements,
      config: ACHIEVEMENT_CONFIG_RAW,
      earnedCount: earned.length,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[evaluateAchievements] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}