// processAgentFeedback — analyses unprocessed AgentFeedback for one or all agents
// and generates AgentInsight records via LLM. Admin-gated; runs on the daily
// Agent Learning Loop workflow. Uses the shared agentLearningLoop module.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processFeedback, processModerationDecisionFeedback } from '../../shared/agentLearningLoop.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const agentName = body.agent_name;

    const svc = base44.asServiceRole;

    // If a specific agent is requested, process just that one; otherwise process all known agents
    const agentNames = agentName
      ? [agentName]
      : ['moderation_agent', 'trade_assistant', 'market_watch', 'collection_advisor'];

    // Process all agents in parallel (independent LLM + entity work per agent).
    const entries = await Promise.all(
      agentNames.map(async (name) => {
        try {
          // Process both traditional AgentFeedback and ModerationDecisionLog feedback
          const [feedbackResult, decisionResult] = await Promise.all([
            processFeedback(svc, name),
            name === 'moderation_agent' ? processModerationDecisionFeedback(svc, name) : Promise.resolve({ processed: 0, insights_generated: 0 }),
          ]);
          return [name, { ...feedbackResult, decision_feedback: decisionResult }] as const;
        } catch (e) {
          console.error(`processAgentFeedback: failed for ${name}`, e?.message || e);
          return [name, { error: e?.message || 'failed' }] as const;
        }
      }),
    );
    const results: Record<string, any> = Object.fromEntries(entries);

    return Response.json({ ok: true, results });
  } catch (error) {
    console.error('processAgentFeedback error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});