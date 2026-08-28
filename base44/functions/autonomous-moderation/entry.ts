// autonomous-moderation — the agent's autonomous decision entry point for
// escrow disputes. When a dispute is filed, this function:
//   1. Reads the dispute + escrow evidence.
//   2. Uses InvokeLLM to analyse the evidence and produce a confidence score
//      and recommended outcome (release / refund / escalate).
//   3. Calls assess-escrow-risk to compute the composite risk score from the
//      four triggers (value, confidence, evidence conflict, party risk).
//   4. If can_auto_resolve → executes the resolution via resolve-escrow-dispute
//      (service role) and logs a ModerationDecisionLog with auto_resolved=true.
//   5. If any trigger fired → sets the escrow to 'disputed' (manual review)
//      and logs a ModerationDecisionLog with auto_resolved=false, admin_decision='pending'.
//
// LEGACY / QUARANTINED: autonomous escrow resolution is disabled.
// This endpoint now performs strict admin/internal authentication and then
// returns 410 without reading or mutating escrow/trade/payment records.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getActiveInsights } from '../../shared/agentLearningLoop.ts';
import { MODERATION_AGENT_NAME } from '../../shared/moderationConfig.ts';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);

    // Strict auth gate. Never infer trust from the presence of a service-style
    // header or from a service-role query made by this function itself.
    const { secrets } = await import('base44:runtime');
    const sharedSecret = secrets.get('BACKEND_FUNCTION_SECRET');
    const provided = req.headers.get('x-backend-function-secret');
    const isInternalCall = Boolean(
      sharedSecret && provided && timingSafeEqual(provided, sharedSecret),
    );

    if ((!caller || caller.role !== 'admin') && !isInternalCall) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Escrow is outside the current SwapPulse architecture and its data model
    // is quarantined. Keeping this legacy resolver executable creates an
    // unnecessary financial-control surface, so fail closed even for admins.
    return Response.json({
      error: 'Legacy autonomous escrow moderation is disabled',
      code: 'LEGACY_ESCROW_DISABLED',
    }, { status: 410 });

    const body = await req.json().catch(() => ({}));
    const { escrow_id } = body;
    if (!escrow_id) return Response.json({ error: 'Missing escrow_id' }, { status: 400 });

    const svc = base44.asServiceRole;
    const escrow = await svc.entities.EscrowTrade.get(escrow_id).catch(() => null);
    if (!escrow) return Response.json({ error: 'Escrow not found' }, { status: 404 });
    if (escrow.status !== 'disputed') {
      return Response.json({ error: 'Escrow is not in dispute state', status: escrow.status }, { status: 400 });
    }

    // Fetch the dispute record
    let dispute: any = null;
    try {
      const disputes = await svc.entities.TradeDispute.filter({ trade_id: escrow_id }, '-created_date', 1);
      dispute = disputes[0] || null;
    } catch { /* ignore */ }

    // Fetch active AgentInsights for the moderation agent (learning loop)
    let insightsSummary = '';
    try {
      const insights = await getActiveInsights(svc, MODERATION_AGENT_NAME);
      if (insights.length > 0) {
        insightsSummary = insights.map((i: any) => `- [${i.insight_type}] ${i.content}`).join('\n');
      }
    } catch { /* ignore */ }

    // Build the LLM prompt for evidence analysis
    const evidenceText = [
      `Trade type: ${escrow.trade_type}`,
      `USDC amount (wei): ${escrow.usdc_amount_wei || '0'}`,
      `Buyer confirmed receipt: ${escrow.buyer_confirmed_at ? 'YES' : 'NO'}`,
      `Seller confirmed receipt: ${escrow.seller_confirmed_at ? 'YES' : 'NO'}`,
      `Buyer tracking code: ${escrow.buyer_tracking_code || 'none'}`,
      `Seller tracking code: ${escrow.seller_tracking_code || 'none'}`,
      `Buyer carrier: ${escrow.buyer_carrier || 'unknown'}`,
      `Seller carrier: ${escrow.seller_carrier || 'unknown'}`,
      `Dispute reason: ${dispute?.reason || 'unknown'}`,
      `Dispute description: ${(dispute?.description || '').slice(0, 500)}`,
      `Card names: ${(escrow.card_names || []).join(', ')}`,
    ].join('\n');

    const prompt = `You are the SwapPulse AI Moderation Agent analysing an escrow dispute on a Pokémon TCG trading platform.

## Your Role
Assess the evidence and determine whether funds should be released to the seller, refunded to the buyer, or escalated to manual review.

## Escalation Triggers (any one = escalate to human)
- High trade value (>= 100 USDC)
- Low confidence in the evidence
- Evidence conflict (e.g. buyer confirmed receipt but claims not-received, or carrier says delivered but buyer claims not received)
- New party involved (account < 30 days old or < 3 completed trades)
- Repeat dispute history (2+ prior disputes)

## Learned Insights (apply these to calibrate your judgment)
${insightsSummary || 'No insights yet.'}

## Evidence
${evidenceText}

## Output
Return a JSON object with:
- confidence: 0.0 to 1.0 — how confident you are in the evidence assessment
- recommended_outcome: "release" (to seller), "refund" (to buyer), or "escalate" (manual review needed)
- reasoning: 1-2 sentences explaining your assessment
- evidence_summary: brief summary of what the evidence shows`;

    const llmResponse: any = await svc.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          confidence: { type: 'number' },
          recommended_outcome: { type: 'string', enum: ['release', 'refund', 'escalate'] },
          reasoning: { type: 'string' },
          evidence_summary: { type: 'string' },
        },
      },
    });

    const agentConfidence = Math.min(1, Math.max(0, llmResponse.confidence || 0));
    const agentRecommendation = llmResponse.recommended_outcome || 'escalate';
    const agentReasoning = llmResponse.reasoning || '';
    const evidenceSummary = llmResponse.evidence_summary || '';

    // Call the risk assessment function to get the composite score + triggers
    const riskRes: any = await svc.functions.invoke('assess-escrow-risk', {
      escrow_id,
      agent_confidence: agentConfidence,
    });

    const assessment = riskRes?.assessment;
    if (!assessment) {
      return Response.json({ error: 'Risk assessment failed', agent_confidence: agentConfidence }, { status: 500 });
    }

    const canAutoResolve = assessment.can_auto_resolve && agentRecommendation !== 'escalate';
    const finalDecision = canAutoResolve ? agentRecommendation : 'escalate';

    // Log the decision to ModerationDecisionLog
    const decisionLog = await svc.entities.ModerationDecisionLog.create({
      case_id: escrow_id,
      case_type: 'escrow_dispute',
      agent_name: MODERATION_AGENT_NAME,
      agent_decision: finalDecision,
      agent_reasoning: `${agentReasoning} | Evidence: ${evidenceSummary}`.slice(0, 1000),
      risk_score: assessment.risk_score,
      triggers_fired: assessment.triggers_fired,
      auto_resolved: canAutoResolve,
      admin_decision: canAutoResolve ? 'n/a' : 'pending',
      trade_outcome: 'pending',
    });

    if (canAutoResolve) {
      // Auto-resolve: invoke resolve-escrow-dispute via service role
      try {
        const resolveRes: any = await svc.functions.invoke('resolve-escrow-dispute', {
          escrow_id,
          resolution: finalDecision,
          notes: `Auto-resolved by AI Moderation Agent. Reasoning: ${agentReasoning}`,
        });
        // Update the decision log with the outcome
        await svc.entities.ModerationDecisionLog.update(decisionLog.id, {
          resolved_at: new Date().toISOString(),
          trade_outcome: finalDecision === 'release' ? 'released' : finalDecision === 'refund' ? 'refunded' : 'cancelled',
          trade_outcome_settled_at: new Date().toISOString(),
        });
        return Response.json({
          ok: true,
          auto_resolved: true,
          decision: finalDecision,
          risk_score: assessment.risk_score,
          triggers_fired: assessment.triggers_fired,
          reasoning: agentReasoning,
          resolve_result: resolveRes,
        });
      } catch (e: any) {
        // Auto-resolve failed (e.g. blockchain error) → escalate to manual
        console.error('autonomous-moderation: auto-resolve failed, escalating', e?.message);
        await svc.entities.ModerationDecisionLog.update(decisionLog.id, {
          agent_decision: 'escalate',
          auto_resolved: false,
          admin_decision: 'pending',
          agent_reasoning: `${agentReasoning} | Auto-resolve failed: ${e?.message || 'unknown error'}`.slice(0, 1000),
        });
        return Response.json({
          ok: true,
          auto_resolved: false,
          decision: 'escalate',
          reason: 'auto-resolve execution failed',
          error: e?.message,
        });
      }
    } else {
      // Escalate: leave the escrow in 'disputed' state for manual review
      return Response.json({
        ok: true,
        auto_resolved: false,
        decision: 'escalate',
        risk_score: assessment.risk_score,
        triggers_fired: assessment.triggers_fired,
        trigger_details: assessment.trigger_details,
        reasoning: agentReasoning,
        evidence_summary: evidenceSummary,
        decision_log_id: decisionLog.id,
      });
    }
  } catch (error: any) {
    console.error('autonomous-moderation error:', error?.message || error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
});