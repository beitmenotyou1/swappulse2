// ai-moderation — LLM-powered content moderation analysis with tiered autonomy.
// Called by workflows on Post/TradeListing/TradeMessage create events, and by
// moderators via the conversational agent. Returns a structured classification
// and applies tiered actions: auto-hide (high confidence severe), warn (medium
// confidence), or surface_for_review (borderline/low confidence).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  MODERATION_AGENT_NAME,
  SEVERE_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  STRIKE_LIMIT_BEFORE_RESTRICTION,
  SEVERE_LABELS,
  LABEL_TYPE_MAP,
  SEVERITY_MAP,
  CONTENT_TYPE_CONTEXT,
  MODERATION_SYSTEM_PROMPT,
} from '../../shared/moderationConfig.ts';
import { getActiveInsights } from '../../shared/agentLearningLoop.ts';

const LABELER_DID = 'did:web:labeler.swappulse.org';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { content_type, content_id, text, author_id, author_handle } = body;

    if (!content_type || !content_id) {
      return Response.json({ error: 'content_type and content_id are required' }, { status: 400 });
    }

    // 1. Fetch the record and extract text + metadata based on content type
    let record: any = null;
    let contentText = text || '';
    let authorId = author_id || '';
    let authorHandle = author_handle || '';
    let subjectUri = '';
    let subjectCid = '';

    if (content_type === 'post') {
      record = await base44.asServiceRole.entities.Post.get(content_id);
      if (!record) return Response.json({ error: 'Post not found' }, { status: 404 });
      contentText = contentText || record.content || '';
      authorId = authorId || record.created_by_id || '';
      authorHandle = authorHandle || record.author_handle || '';
      subjectUri = record.at_uri || '';
      subjectCid = record.cid || '';
    } else if (content_type === 'trade_listing') {
      record = await base44.asServiceRole.entities.TradeListing.get(content_id);
      if (!record) return Response.json({ error: 'TradeListing not found' }, { status: 404 });
      contentText = contentText || [record.notes, ...(record.offer_card_names || []), ...(record.wanted_card_names || [])].filter(Boolean).join(' ');
      authorId = authorId || record.created_by_id || '';
      authorHandle = authorHandle || record.author_handle || '';
      subjectUri = record.at_uri || '';
      subjectCid = record.cid || '';
    } else if (content_type === 'trade_message') {
      record = await base44.asServiceRole.entities.TradeMessage.get(content_id);
      if (!record) return Response.json({ error: 'TradeMessage not found' }, { status: 404 });
      contentText = contentText || record.body || '';
      authorId = authorId || record.created_by_id || '';
      authorHandle = authorHandle || record.author_handle || '';
      subjectUri = record.at_uri || '';
      subjectCid = record.cid || '';
    } else if (content_type === 'profile') {
      record = await base44.asServiceRole.entities.User.get(content_id);
      if (!record) return Response.json({ error: 'User not found' }, { status: 404 });
      contentText = contentText || [record.description, record.username].filter(Boolean).join(' ');
      authorId = content_id;
      authorHandle = record.username || '';
      subjectUri = record.did ? `at://${record.did}/profile` : '';
    } else {
      return Response.json({ error: 'Unknown content_type' }, { status: 400 });
    }

    if (!contentText.trim()) {
      return Response.json({
        classification: { label: 'none', severity: 'none', confidence: 1, recommended_action: 'allow', reasoning: 'Empty content', warning_message: '' },
        action_taken: 'allow',
      });
    }

    // 2. Fetch author context (strikes, prior flags)
    let strikes = 0;
    let restricted = false;
    let priorLabelCount = 0;
    if (authorId) {
      try {
        const author = await base44.asServiceRole.entities.User.get(authorId);
        strikes = author.moderation_strikes || 0;
        restricted = author.restricted || false;
      } catch { /* author may not be fetchable */ }
      try {
        const priorPosts = await base44.asServiceRole.entities.Post.filter({ created_by_id: authorId }, '-created_date', 50);
        priorLabelCount = priorPosts.filter((p: any) => Array.isArray(p.moderation_labels) && p.moderation_labels.length > 0).length;
      } catch { /* ignore */ }
    }

    // 3. Fetch active AgentInsights for the moderation agent (learning loop)
    let insightsSummary = '';
    try {
      const insights = await getActiveInsights(base44.asServiceRole, MODERATION_AGENT_NAME);
      if (insights.length > 0) {
        insightsSummary = insights.map((i: any) => `- [${i.insight_type}] ${i.content}`).join('\n');
      }
    } catch { /* insights not available */ }

    // 4. Check existing labels to avoid duplicates
    let existingLabels: any[] = [];
    if (content_type === 'post' && Array.isArray(record.moderation_labels)) {
      existingLabels = record.moderation_labels;
    }

    // 5. Build the LLM prompt
    const contentTypeContext = CONTENT_TYPE_CONTEXT[content_type] || '';
    const authorContext = `Author history: ${priorLabelCount} prior flagged posts, ${strikes} moderation strikes${restricted ? ' (ACCOUNT RESTRICTED)' : ''}.`;
    const insightsContext = insightsSummary ? `\n\n## Learned Insights (apply these to improve your analysis)\n${insightsSummary}` : '';
    const existingLabelsContext = existingLabels.length > 0 ? `\n\n## Existing Labels (already applied by rule-based system)\n${existingLabels.map((l) => l.label + ' (' + l.severity + ')').join(', ')}` : '';

    const prompt = `${MODERATION_SYSTEM_PROMPT}

## Content to Analyze
**Content type**: ${content_type}
${contentTypeContext}

**Content text**: "${contentText.slice(0, 2000)}"
${authorContext}
${existingLabelsContext}${insightsContext}

## Classification
Analyze this content and return your classification as JSON.`;

    // 6. Call InvokeLLM with structured response schema
    const llmResponse: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Primary violation category or "none"' },
          severity: { type: 'string', enum: ['hide', 'warn', 'inform', 'none'] },
          confidence: { type: 'number', description: '0.0 to 1.0' },
          reasoning: { type: 'string', description: 'Brief explanation' },
          recommended_action: { type: 'string', enum: ['hide', 'warn', 'surface_for_review', 'allow'] },
          warning_message: { type: 'string', description: 'Draft user-facing warning if warranted' },
        },
      },
    });

    const classification = {
      label: llmResponse.label || 'none',
      severity: llmResponse.severity || 'none',
      confidence: Math.min(1, Math.max(0, llmResponse.confidence || 0)),
      reasoning: llmResponse.reasoning || '',
      recommended_action: llmResponse.recommended_action || 'allow',
      warning_message: llmResponse.warning_message || '',
    };

    // 7. Apply tiered actions
    let actionTaken = 'allow';
    const labelType = LABEL_TYPE_MAP[classification.label] || classification.label;
    const isSevere = SEVERE_LABELS.includes(classification.label);
    const confidence = classification.confidence;

    if (classification.label === 'none' || classification.recommended_action === 'allow') {
      actionTaken = 'allow';
    } else if (isSevere && confidence >= SEVERE_CONFIDENCE_THRESHOLD && classification.recommended_action === 'hide') {
      actionTaken = 'hide';
      await applyHideAction(base44, content_type, record, classification, labelType, authorId, authorHandle, subjectUri, subjectCid);
    } else if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD && (classification.recommended_action === 'warn' || classification.recommended_action === 'hide')) {
      actionTaken = 'warn';
      await applyWarnAction(base44, content_type, record, classification, labelType, authorId, authorHandle, subjectUri, subjectCid);
    } else {
      actionTaken = 'surface_for_review';
      await applySurfaceAction(base44, content_type, record, classification, labelType, authorId, authorHandle, subjectUri, subjectCid);
    }

    return Response.json({ classification, action_taken: actionTaken, content_type, content_id });
  } catch (error) {
    console.error('[ai-moderation] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Build the AI label object to append to Post.moderation_labels
function buildAiLabel(classification: any, labelType: string): any {
  return {
    label: labelType,
    severity: SEVERITY_MAP[classification.severity] || 'warn',
    confidence: classification.confidence,
    reason: classification.reasoning,
    ai_generated: true,
    recommended_action: classification.recommended_action,
  };
}

// Create a ModerationLabel record (AT Protocol label spec compliant)
async function createModerationLabelRecord(base44: any, subjectUri: string, subjectCid: string, labelType: string, note: string) {
  if (!subjectUri) return;
  try {
    await base44.asServiceRole.entities.ModerationLabel.create({
      labeler_did: LABELER_DID,
      labeler_name: 'SwapPulse AI Moderation',
      subject_uri: subjectUri,
      subject_cid: subjectCid || undefined,
      label_type: labelType,
      note: note.slice(0, 280),
    });
  } catch (e) {
    console.error('[ai-moderation] ModerationLabel create failed', e?.message);
  }
}

// Emit labels to the AT Protocol network via the labeler bridge (fire-and-forget)
function emitAtProtoLabels(base44: any, subjectUri: string, subjectCid: string, labelType: string) {
  if (!subjectUri) return;
  try {
    base44.functions.invoke('atproto-bridge', {
      action: 'emitLabels',
      labels: [{ src: LABELER_DID, uri: subjectUri, cid: subjectCid || undefined, val: labelType, neg: false }],
    }).catch((e: any) => console.error('[ai-moderation] label emission failed', e?.message));
  } catch { /* ignore */ }
}

// Log to ModerationLog
async function logAction(base44: any, action: string, targetPostId: string, targetAuthor: string, labelType: string, notes: string) {
  try {
    await base44.asServiceRole.entities.ModerationLog.create({
      moderator_id: 'system',
      moderator_name: 'AI Moderation Agent',
      action,
      target_post_id: targetPostId,
      target_author: targetAuthor,
      labels_affected: [labelType],
      notes,
      auto_generated: true,
    });
  } catch (e) {
    console.error('[ai-moderation] ModerationLog create failed', e?.message);
  }
}

// Notify the author via Notification
async function notifyAuthor(base44: any, authorId: string, authorHandle: string, classification: any) {
  if (!authorId) return;
  try {
    const author = await base44.asServiceRole.entities.User.get(authorId).catch(() => null);
    const authorDid = author?.did || '';
    if (!authorDid) return;
    const message = classification.warning_message || `Your content was flagged by automated moderation: ${classification.label}. Reason: ${classification.reasoning}`;
    await base44.asServiceRole.entities.Notification.create({
      did: authorDid,
      action_type: 'message',
      actor_name: 'AI Moderation Agent',
      target_type: 'post',
      target_label: classification.label,
      is_read: false,
      metadata: { ai_moderation: true, label: classification.label, action: classification.recommended_action },
    });
  } catch (e) {
    console.error('[ai-moderation] notify author failed', e?.message);
  }
}

// Increment author's moderation strikes and restrict if over limit
async function incrementStrikes(base44: any, authorId: string) {
  if (!authorId) return;
  try {
    const author = await base44.asServiceRole.entities.User.get(authorId);
    const currentStrikes = (author.moderation_strikes || 0) + 1;
    const shouldRestrict = currentStrikes > STRIKE_LIMIT_BEFORE_RESTRICTION;
    const updateData: any = { moderation_strikes: currentStrikes };
    if (shouldRestrict) updateData.restricted = true;
    await base44.asServiceRole.entities.User.update(authorId, updateData);
  } catch (e) {
    console.error('[ai-moderation] increment strikes failed', e?.message);
  }
}

// TIER 1: Auto-hide — high confidence severe violation
async function applyHideAction(base44: any, contentType: string, record: any, classification: any, labelType: string, authorId: string, authorHandle: string, subjectUri: string, subjectCid: string) {
  const aiLabel = buildAiLabel(classification, labelType);
  const targetId = record.id || '';

  if (contentType === 'post') {
    // Update Post: add AI label, set status to escalated (hidden from feed)
    const existingLabels = Array.isArray(record.moderation_labels) ? record.moderation_labels : [];
    await base44.asServiceRole.entities.Post.update(targetId, {
      moderation_labels: [...existingLabels, aiLabel],
      moderation_status: 'escalated',
    });
  }

  await createModerationLabelRecord(base44, subjectUri, subjectCid, labelType, classification.reasoning);
  emitAtProtoLabels(base44, subjectUri, subjectCid, labelType);
  await incrementStrikes(base44, authorId);
  await notifyAuthor(base44, authorId, authorHandle, classification);
  await logAction(base44, 'auto-escalate', targetId, authorHandle || authorId, labelType, `AI auto-hide: ${classification.reasoning}`);
}

// TIER 2: Warn — medium confidence, apply label and surface in queue
async function applyWarnAction(base44: any, contentType: string, record: any, classification: any, labelType: string, authorId: string, authorHandle: string, subjectUri: string, subjectCid: string) {
  const aiLabel = buildAiLabel(classification, labelType);
  const targetId = record.id || '';

  if (contentType === 'post') {
    const existingLabels = Array.isArray(record.moderation_labels) ? record.moderation_labels : [];
    await base44.asServiceRole.entities.Post.update(targetId, {
      moderation_labels: [...existingLabels, aiLabel],
      moderation_status: 'pending',
    });
  }

  await createModerationLabelRecord(base44, subjectUri, subjectCid, labelType, classification.reasoning);
  emitAtProtoLabels(base44, subjectUri, subjectCid, labelType);
  await logAction(base44, 'auto-resolve', targetId, authorHandle || authorId, labelType, `AI warn: ${classification.reasoning}`);
}

// TIER 3: Surface for review — borderline, no auto action
async function applySurfaceAction(base44: any, contentType: string, record: any, classification: any, labelType: string, authorId: string, authorHandle: string, subjectUri: string, subjectCid: string) {
  const aiLabel = buildAiLabel(classification, labelType);
  const targetId = record.id || '';

  if (contentType === 'post') {
    const existingLabels = Array.isArray(record.moderation_labels) ? record.moderation_labels : [];
    await base44.asServiceRole.entities.Post.update(targetId, {
      moderation_labels: [...existingLabels, aiLabel],
      moderation_status: 'pending',
    });
  }

  await createModerationLabelRecord(base44, subjectUri, subjectCid, labelType, classification.reasoning);
  await logAction(base44, 'auto-resolve', targetId, authorHandle || authorId, labelType, `AI surface for review: ${classification.reasoning}`);
}