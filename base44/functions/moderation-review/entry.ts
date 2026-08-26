// moderation-review — handles two flows for the autonomous moderation system:
//
// 1. Admin review of escalated cases (op: 'review'):
//    An admin confirms or overrides the agent's decision on an escalated case.
//    The override (agreement or reversal) is logged to ModerationDecisionLog
//    with the admin's rationale, so the learning loop can learn from the
//    correction. If the case is an escrow dispute, the resolution is executed
//    via resolve-escrow-dispute.
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

      // Update the decision log with the admin's decision
      await svc.entities.ModerationDecisionLog.update(decision_log_id, {
        admin_decision,
        admin_id: user.id,
        admin_override_direction: admin_override_direction || '',
        admin_rationale: (admin_rationale || '').slice(0, 1000),
        resolved_at: new Date().toISOString(),
      });

      // If this is an escrow dispute and the admin overrode the agent, execute the override
      if (log.case_type === 'escrow_dispute' && admin_decision === 'overridden') {
        try {
          const resolveRes: any = await svc.functions.invoke('resolve-escrow-dispute', {
            escrow_id: log.case_id,
            resolution: admin_override_direction,
            notes: `Admin override of agent decision. Rationale: ${admin_rationale}`,
          });
          // Update the decision log with the outcome
          await svc.entities.ModerationDecisionLog.update(decision_log_id, {
            trade_outcome: admin_override_direction === 'release' ? 'released' : admin_override_direction === 'refund' ? 'refunded' : 'cancelled',
            trade_outcome_settled_at: new Date().toISOString(),
          });
          return Response.json({ ok: true, admin_decision, resolved: true, resolve_result: resolveRes });
        } catch (e: any) {
          return Response.json({ ok: true, admin_decision, resolved: false, error: e?.message }, { status: 500 });
        }
      }

      return Response.json({ ok: true, admin_decision, resolved: true });
    }

    // ── User fairness rating ──
    if (op === 'fairness') {
      const { decision_log_id, rating, comment } = body;
      if (!decision_log_id) return Response.json({ error: 'Missing decision_log_id' }, { status: 400 });
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return Response.json({ error: 'rating must be 1-5' }, { status: 400 });
      }

      const log = await svc.entities.ModerationDecisionLog.get(decision_log_id).catch(() => null);
      if (!log) return Response.json({ error: 'Decision log not found' }, { status: 404 });

      // If both parties have rated, average the ratings; otherwise set the first one
      const updateData: any = {
        fairness_rating_submitted_at: new Date().toISOString(),
      };
      if (log.user_fairness_rating) {
        // Average with existing rating
        updateData.user_fairness_rating = Math.round((log.user_fairness_rating + rating) / 2);
        updateData.user_fairness_comment = (log.user_fairness_comment || '') + ' | ' + (comment || '').slice(0, 200);
      } else {
        updateData.user_fairness_rating = rating;
        updateData.user_fairness_comment = (comment || '').slice(0, 500);
      }

      await svc.entities.ModerationDecisionLog.update(decision_log_id, updateData);

      return Response.json({ ok: true, rating: updateData.user_fairness_rating });
    }

    return Response.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error: any) {
    console.error('moderation-review error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});