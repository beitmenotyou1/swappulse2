import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const AGENTS = new Set([
  'collector_copilot',
  'moderation_agent',
  'trade_assistant',
  'market_watch',
  'collection_advisor',
  'sentiment_conversationalist',
  'achievement_goal_tracker',
  'networking_concierge',
]);

const USER_FEEDBACK_TYPES = new Set(['thumbs_up', 'thumbs_down', 'correction']);
const MAX_FEEDBACK_PER_HOUR = 60;

function clean(value: unknown, max: number): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch(() => null);
    if (!me?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const agentName = clean(body.agent_name, 80);
    const feedbackType = clean(body.feedback_type, 40);
    if (!AGENTS.has(agentName)) {
      return Response.json({ error: 'Unknown agent' }, { status: 400 });
    }
    if (!USER_FEEDBACK_TYPES.has(feedbackType)) {
      return Response.json({ error: 'Unsupported collector feedback type' }, { status: 400 });
    }

    const correctedContent = clean(body.corrected_content, 2000);
    if (feedbackType === 'correction' && !correctedContent) {
      return Response.json({ error: 'Correction text is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await svc.entities.AgentFeedback.filter(
      {
        submitted_by_user_id: String(me.id),
        created_date: { $gte: hourAgo },
      },
      '-created_date',
      MAX_FEEDBACK_PER_HOUR + 1,
    ).catch(() => []);

    if ((recent || []).length >= MAX_FEEDBACK_PER_HOUR) {
      return Response.json({ error: 'Too much feedback submitted. Please try again later.', code: 'RATE_LIMITED' }, { status: 429 });
    }

    const feedback = await svc.entities.AgentFeedback.create({
      agent_name: agentName,
      submitted_by_user_id: String(me.id),
      conversation_id: clean(body.conversation_id, 200),
      message_id: clean(body.message_id, 200),
      feedback_type: feedbackType,
      original_content: clean(body.original_content, 2000),
      corrected_content: correctedContent,
      user_comment: clean(body.user_comment, 1000),
      context_summary: clean(body.context_summary, 500),
      processed: false,
    });

    return Response.json({ ok: true, feedback_id: feedback?.id || null });
  } catch (error: any) {
    console.error('submit-agent-feedback error:', error?.message || error);
    return Response.json({ error: 'Could not submit feedback' }, { status: 500 });
  }
}
