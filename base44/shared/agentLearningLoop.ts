// Agent learning loop — shared module for logging feedback, retrieving insights,
// and processing feedback into insights via LLM analysis. Used by the
// processAgentFeedback backend function and the daily Agent Learning Loop workflow.
// Agents read their active AgentInsight records before responding to improve over time.

export interface FeedbackInput {
  agent_name: string;
  conversation_id?: string;
  message_id?: string;
  feedback_type: 'thumbs_up' | 'thumbs_down' | 'correction' | 'suggestion_accepted' | 'suggestion_rejected';
  rating?: number;
  user_comment?: string;
  original_content?: string;
  corrected_content?: string;
  context_summary?: string;
}

export async function logFeedback(svc: any, input: FeedbackInput): Promise<any> {
  return await svc.entities.AgentFeedback.create({
    ...input,
    processed: false,
  });
}

export async function getActiveInsights(svc: any, agentName: string): Promise<any[]> {
  const insights = await svc.entities.AgentInsight.filter(
    { agent_name: agentName, active: true },
    '-generated_at',
    20
  );
  const now = new Date();
  return insights.filter((i: any) => !i.valid_until || new Date(i.valid_until) > now);
}

export async function processFeedback(svc: any, agentName: string): Promise<{ processed: number; insights_generated: number }> {
  // Fetch unprocessed feedback for this agent
  const feedback = await svc.entities.AgentFeedback.filter(
    { agent_name: agentName, processed: false },
    '-created_date',
    100
  );

  if (feedback.length === 0) return { processed: 0, insights_generated: 0 };

  // Fetch existing active insights for context
  const existingInsights = await svc.entities.AgentInsight.filter(
    { agent_name: agentName, active: true },
    '-generated_at',
    20
  );

  // Summarise feedback for LLM analysis
  const feedbackSummary = feedback.map((f: any) => ({
    type: f.feedback_type,
    rating: f.rating,
    comment: f.user_comment || '',
    original: (f.original_content || '').slice(0, 200),
    corrected: (f.corrected_content || '').slice(0, 200),
  }));

  const prompt = `You are analysing user feedback for an AI agent named "${agentName}" on a Pokémon TCG collector platform called SwapPulse.

Existing insights about this agent:
${JSON.stringify(existingInsights.map((i: any) => ({ type: i.insight_type, content: i.content, evidence: i.evidence_count })))}

Recent unprocessed feedback (${feedback.length} items):
${JSON.stringify(feedbackSummary)}

Analyse this feedback and generate actionable insights to improve the agent's performance. Focus on:
1. Common corrections, what users frequently correct
2. Strengths, what users appreciate (thumbs up patterns)
3. Weaknesses, recurring complaints or thumbs down patterns
4. Improvement notes, specific actionable guidance

Return a JSON object with an "insights" array. Only include insights supported by at least 2 feedback items. Each item needs:
- insight_type: one of "improvement_note", "common_correction", "strength", "weakness", "pattern"
- content: concise actionable text (max 200 chars)
- confidence: 0-1 based on evidence strength`;

  const response: any = await svc.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              insight_type: { type: 'string' },
              content: { type: 'string' },
              confidence: { type: 'number' },
            },
          },
        },
      },
    },
  });

  const newInsights = response.insights || [];
  const now = new Date().toISOString();
  const feedbackIds = feedback.map((f: any) => f.id);
  let insightsGenerated = 0;

  for (const insight of newInsights) {
    // Check if a similar insight already exists (same type, overlapping content)
    const existing = existingInsights.find(
      (i: any) =>
        i.insight_type === insight.insight_type &&
        i.content.toLowerCase().slice(0, 50) === (insight.content || '').toLowerCase().slice(0, 50)
    );

    if (existing) {
      // Reinforce existing insight
      await svc.entities.AgentInsight.update(existing.id, {
        evidence_count: (existing.evidence_count || 1) + feedback.length,
        confidence: Math.min(1, (existing.confidence || 0.5) + 0.1),
        generated_at: now,
        source_feedback_ids: [...(existing.source_feedback_ids || []), ...feedbackIds],
      });
    } else {
      // Create new insight
      await svc.entities.AgentInsight.create({
        agent_name: agentName,
        insight_type: insight.insight_type,
        content: insight.content,
        evidence_count: feedback.length,
        confidence: insight.confidence || 0.5,
        generated_at: now,
        active: true,
        source_feedback_ids: feedbackIds,
      });
      insightsGenerated++;
    }
  }

  // Mark all processed feedback as done
  await svc.entities.AgentFeedback.updateMany(
    { agent_name: agentName, processed: false },
    { $set: { processed: true, processed_at: now } }
  );

  return { processed: feedback.length, insights_generated: insightsGenerated };
}

// ── ModerationDecisionLog feedback processing ──
// Processes unprocessed ModerationDecisionLog records (admin overrides, trade
// outcomes, and user fairness ratings) into AgentInsight records. This is the
// three-signal learning loop: admin override decisions, trade outcome data,
// and user resolution-fairness ratings. Called by processAgentFeedback.
export async function processModerationDecisionFeedback(svc: any, agentName: string): Promise<{ processed: number; insights_generated: number }> {
  // Fetch unprocessed ModerationDecisionLog records for this agent
  const decisions = await svc.entities.ModerationDecisionLog.filter(
    { agent_name: agentName, feedback_processed: false },
    '-created_date',
    100
  ).catch(() => []);

  if (decisions.length === 0) return { processed: 0, insights_generated: 0 };

  // Only process records that have at least one feedback signal (admin override,
  // trade outcome, or fairness rating)
  const withFeedback = decisions.filter((d: any) =>
    d.admin_decision === 'confirmed' ||
    d.admin_decision === 'overridden' ||
    (d.trade_outcome && d.trade_outcome !== 'pending' && d.trade_outcome !== 'n/a') ||
    d.user_fairness_rating
  );

  if (withFeedback.length === 0) {
    // Mark the rest as processed (no feedback signal yet)
    const ids = decisions.filter((d: any) => !withFeedback.includes(d)).map((d: any) => d.id);
    // We can't bulk update by IDs directly, so skip — they'll be picked up later
    return { processed: 0, insights_generated: 0 };
  }

  // Fetch existing active insights for context
  const existingInsights = await svc.entities.AgentInsight.filter(
    { agent_name: agentName, active: true },
    '-generated_at',
    20
  ).catch(() => []);

  // Summarise the three feedback streams for LLM analysis
  const overrideSummary = withFeedback
    .filter((d: any) => d.admin_decision === 'confirmed' || d.admin_decision === 'overridden')
    .map((d: any) => ({
      case_type: d.case_type,
      agent_decision: d.agent_decision,
      admin_decision: d.admin_decision,
      override_direction: d.admin_override_direction || '',
      admin_rationale: (d.admin_rationale || '').slice(0, 200),
      triggers_fired: d.triggers_fired || [],
      risk_score: d.risk_score,
    }));

  const outcomeSummary = withFeedback
    .filter((d: any) => d.trade_outcome && d.trade_outcome !== 'pending' && d.trade_outcome !== 'n/a')
    .map((d: any) => ({
      case_type: d.case_type,
      agent_decision: d.agent_decision,
      trade_outcome: d.trade_outcome,
      auto_resolved: d.auto_resolved,
      triggers_fired: d.triggers_fired || [],
    }));

  const fairnessSummary = withFeedback
    .filter((d: any) => d.user_fairness_rating)
    .map((d: any) => ({
      case_type: d.case_type,
      agent_decision: d.agent_decision,
      fairness_rating: d.user_fairness_rating,
      fairness_comment: (d.user_fairness_comment || '').slice(0, 200),
      auto_resolved: d.auto_resolved,
    }));

  const prompt = `You are analysing moderation decision feedback for an AI agent named "${agentName}" on a Pokémon TCG collector platform called SwapPulse.

This feedback comes from three signals:
1. Admin override decisions (when human moderators confirmed or reversed the agent's call)
2. Trade outcome data (whether the trade completed, was disputed, or refunded)
3. User fairness ratings (1-5 stars from affected users after resolution)

Existing insights about this agent:
${JSON.stringify(existingInsights.map((i: any) => ({ type: i.insight_type, content: i.content, evidence: i.evidence_count })))}

## Admin Override Decisions (${overrideSummary.length} items)
${JSON.stringify(overrideSummary)}

## Trade Outcome Data (${outcomeSummary.length} items)
${JSON.stringify(outcomeSummary)}

## User Fairness Ratings (${fairnessSummary.length} items)
${JSON.stringify(fairnessSummary)}

Analyse these three feedback streams and generate actionable insights to improve the agent's autonomous moderation. Focus on:
1. Override patterns — what cases does the agent get wrong that admins frequently reverse? Adjust escalation thresholds accordingly.
2. Outcome correlation — which agent decisions correlate with successful trades vs disputes/refunds? Reinforce decisions that lead to good outcomes.
3. Fairness signals — which decision types get low fairness ratings? The agent should be more cautious or escalate those.
4. Trigger calibration — are certain triggers firing too often (over-escalation) or too rarely (under-escalation)?

Return a JSON object with an "insights" array. Only include insights supported by at least 2 feedback items. Each item needs:
- insight_type: one of "improvement_note", "common_correction", "strength", "weakness", "pattern"
- content: concise actionable text (max 200 chars) — be specific about what to adjust
- confidence: 0-1 based on evidence strength`;

  const response: any = await svc.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        insights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              insight_type: { type: 'string' },
              content: { type: 'string' },
              confidence: { type: 'number' },
            },
          },
        },
      },
    },
  });

  const newInsights = response.insights || [];
  const now = new Date().toISOString();
  const decisionIds = withFeedback.map((d: any) => d.id);
  let insightsGenerated = 0;

  for (const insight of newInsights) {
    const existing = existingInsights.find(
      (i: any) =>
        i.insight_type === insight.insight_type &&
        i.content.toLowerCase().slice(0, 50) === (insight.content || '').toLowerCase().slice(0, 50)
    );

    if (existing) {
      await svc.entities.AgentInsight.update(existing.id, {
        evidence_count: (existing.evidence_count || 1) + withFeedback.length,
        confidence: Math.min(1, (existing.confidence || 0.5) + 0.1),
        generated_at: now,
      });
    } else {
      await svc.entities.AgentInsight.create({
        agent_name: agentName,
        insight_type: insight.insight_type,
        content: insight.content,
        evidence_count: withFeedback.length,
        confidence: insight.confidence || 0.5,
        generated_at: now,
        active: true,
      });
      insightsGenerated++;
    }
  }

  // Mark the processed decisions as done
  for (const id of decisionIds) {
    try {
      await svc.entities.ModerationDecisionLog.update(id, { feedback_processed: true });
    } catch { /* ignore individual update failures */ }
  }

  return { processed: withFeedback.length, insights_generated: insightsGenerated };
}