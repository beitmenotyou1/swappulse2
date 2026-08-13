// processAgentFeedback — analyzes unprocessed AgentFeedback for one or all agents
// and generates AgentInsight records via LLM. Admin-gated; runs on the daily
// Agent Learning Loop workflow. Uses the shared agentLearningLoop module.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { processFeedback } from '../../shared/agentLearningLoop.ts';

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
      : ['trade_assistant', 'market_watch'];

    const results: Record<string, any> = {};
    for (const name of agentNames) {
      try {
        results[name] = await processFeedback(svc, name);
      } catch (e) {
        console.error(`processAgentFeedback: failed for ${name}`, e?.message || e);
        results[name] = { error: e?.message || 'failed' };
      }
    }

    return Response.json({ ok: true, results });
  } catch (error) {
    console.error('processAgentFeedback error', error?.message || error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});