import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SUSPICIOUS_PATTERNS = [
  /ignore (?:all |any )?(?:previous|prior|system|developer) instructions/i,
  /(?:system|developer) (?:message|prompt)/i,
  /reveal|exfiltrate|bypass|override/i,
  /tool[_ -]?call|function[_ -]?call/i,
  /private[_ -]?key|seed phrase|password|api[_ -]?key|access token/i,
];

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const insightId = cleanText(body.insight_id, 128);
    const decision = cleanText(body.decision, 16);
    const reviewNotes = cleanText(body.review_notes, 500);
    const acknowledgeFlagged = body.acknowledge_flagged === true;

    if (!ID_PATTERN.test(insightId)) {
      return Response.json({ error: 'Invalid insight_id' }, { status: 400 });
    }
    if (decision !== 'approve' && decision !== 'reject') {
      return Response.json({ error: 'decision must be approve or reject' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const insight = await svc.entities.AgentInsight.get(insightId).catch(() => null);
    if (!insight) {
      return Response.json({ error: 'Insight not found' }, { status: 404 });
    }

    const content = cleanText(insight.content, 1000);
    const generatedFlag =
      insight.safety_status === 'flagged' ||
      SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(content));

    if (decision === 'approve' && generatedFlag && !acknowledgeFlagged) {
      return Response.json(
        {
          error: 'Insight is safety-flagged. Review it and explicitly acknowledge the flag before approval.',
          safety_status: 'flagged',
        },
        { status: 409 },
      );
    }

    const reviewedAt = new Date().toISOString();
    const approved = decision === 'approve';

    const updated = await svc.entities.AgentInsight.update(insightId, {
      content,
      review_status: approved ? 'approved' : 'rejected',
      safety_status: approved ? 'passed' : (generatedFlag ? 'flagged' : 'passed'),
      active: approved,
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
      review_notes: reviewNotes,
      source_feedback_ids: [],
    });

    return Response.json({
      ok: true,
      insight: {
        id: updated.id,
        agent_name: updated.agent_name,
        insight_type: updated.insight_type,
        content: updated.content,
        evidence_count: updated.evidence_count,
        confidence: updated.confidence,
        review_status: updated.review_status,
        safety_status: updated.safety_status,
        active: updated.active,
        reviewed_at: updated.reviewed_at,
      },
    });
  } catch (error) {
    console.error('review-agent-insight error', error?.message || error);
    return Response.json(
      { error: error?.message || 'Review failed' },
      { status: 500 },
    );
  }
});
