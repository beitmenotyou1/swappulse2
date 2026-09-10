// moderation-review — handles two flows for the autonomous moderation system:
//
// 1. Admin review of escalated cases (op: 'review'):
//    An admin confirms or overrides the agent's decision on an escalated case.
//    The override (agreement or reversal) is logged to ModerationDecisionLog
//    with the admin's rationale, so the learning loop can learn from the
//    correction. Legacy escrow disputes are quarantined and cannot execute a
//    release/refund through this endpoint.
//
// 2. User fairness rating (op: 'fairness'):
//    After a case is resolved, the affected user submits a 1-5 star fairness
//    rating + optional comment. Logged to ModerationDecisionLog so the
//    learning loop has a ground-truth satisfaction signal.
//
// 3. List escalated cases (op: 'list'):
//    Returns ModerationDecisionLog records pending admin review
//    (admin_decision='pending', auto_resolved=false), sorted by risk score.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

async function isAffectedUser(svc: any, userId: string, log: any): Promise<boolean> {
  const caseId = String(log?.case_id || '').trim();
  if (!caseId || !userId) return false;

  try {
    if (log.case_type === 'post') {
      const record = await svc.entities.Post.get(caseId);
      return String(record?.created_by_id || '') === userId;
    }
    if (log.case_type === 'trade_listing') {
      const record = await svc.entities.TradeListing.get(caseId);
      return String(record?.created_by_id || '') === userId;
    }
    if (log.case_type === 'trade_message') {
      const record = await svc.entities.TradeMessage.get(caseId);
      return String(record?.created_by_id || '') === userId || String(record?.listing_author_id || '') === userId;
    }
    if (log.case_type === 'profile') {
      return caseId === userId;
    }
    if (log.case_type === 'user_report') {
      const record = await svc.entities.ContentReport.get(caseId);
      return String(record?.created_by_id || '') === userId;
    }
  } catch {
    return false;
  }

  // Legacy escrow cases are quarantined and cannot collect actionable learning
  // feedback through this endpoint.
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const op = body.op || 'list';
    const svc = base44.asServiceRole;

    // ── List escalated cases pending manual review ──
    if (op === 'list') {
      if (user.role !== 'admin' && user.role !== 'moderator') {
        return Response.json({ error: 'Staff only' }, { status: 403 });
      }
      const cases = await svc.entities.ModerationDecisionLog.filter(
        { admin_decision: 'pending', auto_resolved: false },
        '-created_date',
        100
      ).catch(() => []);

      // Sort by risk score descending (highest risk first)
      const sorted = cases.sort((a: any, b: any) => (b.risk_score || 0) - (a.risk_score || 0));

      return Response.json({ ok: true, cases: sorted, count: sorted.length });
    }

    // ── Admin review (confirm or override) ──
    if (op === 'review') {
      if (user.role !== 'admin' && user.role !== 'moderator') {
        return Response.json({ error: 'Staff only' }, { status: 403 });
      }
      const { decision_log_id, admin_decision, admin_override_direction, admin_rationale } = body;
      if (!decision_log_id) return Response.json({ error: 'Missing decision_log_id' }, { status: 400 });
      if (!['confirmed', 'overridden'].includes(admin_decision)) {
        return Response.json({ error: 'admin_decision must be confirmed or overridden' }, { status: 400 });
      }
      if (admin_decision === 'overridden' && !admin_override_direction) {
        return Response.json({ error: 'admin_override_direction required when overriding' }, { status: 400 });
      }
      if (admin_decision === 'overridden' && !admin_rationale?.trim()) {
        return Response.json({ error: 'admin_rationale required when overriding (becomes learning data)' }, { status: 400 });
      }

      const log = await svc.entities.ModerationDecisionLog.get(decision_log_id).catch(() => null);
      if (!log) return Response.json({ error: 'Decision log not found' }, { status: 404 });

      // Escrow is intentionally disabled in SwapPulse V1. Fail before mutating
      // the review log so an old case cannot look resolved when no financial
      // action was actually possible.
      if (log.case_type === 'escrow_dispute' && admin_decision === 'overridden') {
        return Response.json({
          error: 'Legacy escrow resolution is disabled',
          code: 'LEGACY_ESCROW_DISABLED',
        }, { status: 410 });
      }

      // Update the decision log with the admin's decision
      await svc.entities.ModerationDecisionLog.update(decision_log_id, {
        admin_decision,
        admin_id: user.id,
        admin_override_direction: admin_override_direction || '',
        admin_rationale: (admin_rationale || '').slice(0, 1000),
        resolved_at: new Date().toISOString(),
      });

      return Response.json({ ok: true, admin_decision, resolved: true });
    }

    // ── User fairness rating ──
    if (op === 'fairness') {
      const { decision_log_id, rating, comment } = body;
      if (!decision_log_id) return Response.json({ error: 'Missing decision_log_id' }, { status: 400 });
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return Response.json({ error: 'rating must be an integer from 1-5' }, { status: 400 });
      }

      const log = await svc.entities.ModerationDecisionLog.get(decision_log_id).catch(() => null);
      if (!log) return Response.json({ error: 'Decision log not found' }, { status: 404 });
      if (log.admin_decision === 'pending' && !log.auto_resolved) {
        return Response.json({ error: 'This moderation case has not been resolved yet' }, { status: 409 });
      }
      if (!(await isAffectedUser(svc, String(user.id), log))) {
        return Response.json({ error: 'You are not an affected user for this moderation case' }, { status: 403 });
      }

      const priorRaters = Array.isArray(log.fairness_rater_ids)
        ? log.fairness_rater_ids.map((value: unknown) => String(value))
        : [];
      if (priorRaters.includes(String(user.id))) {
        return Response.json({ error: 'You have already rated this resolution', code: 'FAIRNESS_ALREADY_SUBMITTED' }, { status: 409 });
      }

      // Maintain a sum/count rather than repeatedly averaging an average. For
      // legacy rows that have one aggregate rating but no counters, seed the
      // counters conservatively as one prior rating.
      const legacyRating = Number(log.user_fairness_rating || 0);
      const currentSum = Number.isInteger(log.fairness_rating_sum)
        ? Number(log.fairness_rating_sum)
        : (legacyRating >= 1 && legacyRating <= 5 ? legacyRating : 0);
      const currentCount = Number.isInteger(log.fairness_rating_count)
        ? Number(log.fairness_rating_count)
        : (legacyRating >= 1 && legacyRating <= 5 ? 1 : 0);
      const nextSum = currentSum + rating;
      const nextCount = currentCount + 1;
      const cleanedComment = String(comment || '').trim().slice(0, 500);
      const existingComment = String(log.user_fairness_comment || '').trim();

      const updateData: any = {
        user_fairness_rating: Math.round(nextSum / nextCount),
        user_fairness_comment: [existingComment, cleanedComment].filter(Boolean).join(' | ').slice(0, 500),
        fairness_rating_submitted_at: new Date().toISOString(),
        fairness_rater_ids: [...priorRaters, String(user.id)].slice(-10),
        fairness_rating_sum: nextSum,
        fairness_rating_count: nextCount,
        feedback_processed: false,
      };

      await svc.entities.ModerationDecisionLog.update(decision_log_id, updateData);

      return Response.json({ ok: true, rating: updateData.user_fairness_rating });
    }

    return Response.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: any) {
    console.error('moderation-review error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});