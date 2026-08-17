// org.swappulse.leaderboard feed generator — multi-axis, opt-in leaderboard.
// Reads challenge entries, joins each author's SettingsConfig.config.challenges
// prefs, excludes opted-out users (default opt-OUT), scores by goal.metric, ranks.
// Collective challenges return aggregate progress only (no per-user ranking).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const CATEGORY_ENUM = [
  'helpful-trader', 'accuracy-champion', 'community-builder', 'set-completer',
  'shiny-hunter', 'journal-writer', 'meetup-organiser',
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const challengeId = body?.challengeId;
    const category = body?.category;
    const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 500);
    if (!challengeId) return Response.json({ error: 'challengeId required' }, { status: 400 });

    const challenge = await svc.entities.Challenge.get(challengeId).catch(() => null);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    const entries = await svc.entities.ChallengeEntry.filter({ challenge_id: challengeId }, '-submitted_at', 1000);

    // Only fetch settings for users who actually submitted entries (avoids scanning all 2000 SettingsConfig rows).
    const participantDids = [...new Set(entries.map((e: any) => e.participant_did || e.did).filter(Boolean))];
    const settingsRows = participantDids.length > 0
      ? await svc.entities.SettingsConfig.filter({ did: { $in: participantDids } }, '-updated_date', participantDids.length)
      : [];

    // did -> { optIn, categories }
    const prefsByDid = new Map();
    for (const s of settingsRows) {
      const ch = (s.config || {}).challenges || {};
      prefsByDid.set(s.did, {
        optIn: ch.leaderboardOptIn === true,
        categories: ch.leaderboardCategories || [],
      });
    }

    const mode = challenge.mode || 'collective';
    const target = challenge.goal?.target || 0;

    if (mode === 'collective') {
      const total = entries.reduce((sum: number, e: any) => sum + (e.contribution_count || 0), 0);
      const contributors = new Set(entries.map((e: any) => e.participant_did || e.did)).size;
      return Response.json({
        mode: 'collective',
        progress: {
          total,
          target,
          percent: target ? Math.min(100, Math.round((total / target) * 100)) : 0,
          contributors,
        },
        challengeComplete: target > 0 && total >= target,
      });
    }

    // competitive
    const filteredCategory =
      category && CATEGORY_ENUM.includes(category) ? category : (challenge.category || null);

    const eligible: any[] = [];
    for (const e of entries) {
      if (e.status === 'rejected') continue;
      if ((e.moderator_labels || []).includes('spam_suspected')) continue;
      const did = e.participant_did || e.did;
      const ov = e.override_profile_visibility || {};
      let allow: boolean;
      if (ov.allow_on_leaderboard === true || ov.allow_on_leaderboard === false) {
        allow = ov.allow_on_leaderboard;
      } else {
        const prefs = prefsByDid.get(did);
        allow = prefs ? prefs.optIn : false; // default exclude
      }
      if (!allow) continue;
      if (filteredCategory) {
        const entryCat = e.category || challenge.category;
        if (entryCat && entryCat !== filteredCategory) continue;
        const prefs = prefsByDid.get(did);
        if (prefs && prefs.categories.length && !prefs.categories.includes(filteredCategory)) continue;
      }
      eligible.push(e);
    }

    // aggregate per did
    const byDid = new Map();
    for (const e of eligible) {
      const did = e.participant_did || e.did;
      const cur = byDid.get(did) || {
        did,
        displayName: e.participant_name || 'Collector',
        score: 0,
        entriesCount: 0,
        verified: false,
        submittedAt: e.submitted_at,
      };
      cur.score += e.contribution_count || 0;
      cur.entriesCount += 1;
      if ((e.moderator_labels || []).includes('verified')) cur.verified = true;
      if (!cur.submittedAt || (e.submitted_at && e.submitted_at < cur.submittedAt)) cur.submittedAt = e.submitted_at;
      byDid.set(did, cur);
    }

    const ranked = [...byDid.values()]
      .sort((a: any, b: any) => b.score - a.score || (a.submittedAt < b.submittedAt ? -1 : 1))
      .slice(0, limit)
      .map((r: any, i: number) => ({
        rank: i + 1,
        userDid: r.did,
        displayName: r.displayName,
        score: r.score,
        progressPercent: target ? Math.min(100, Math.round((r.score / target) * 100)) : 0,
        entriesCount: r.entriesCount,
        verified: r.verified,
      }));

    return Response.json({
      mode: 'competitive',
      category: filteredCategory,
      feed: ranked,
      meta: {
        totalParticipants: new Set(entries.map((e: any) => e.participant_did || e.did)).size,
        optInParticipants: byDid.size,
        challengeComplete: target > 0 && ranked.some((r: any) => r.score >= target),
      },
    });
  } catch (error) {
    console.error('[getLeaderboard] error', error);
    return Response.json({ error: error?.message || 'Leaderboard error' }, { status: 500 });
  }
}