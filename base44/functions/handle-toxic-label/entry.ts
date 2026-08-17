import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || !['admin', 'moderator'].includes(caller.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const body = await req.json();
    const { subject_uri, labeler_did, note, label_id } = body;

    if (!subject_uri || !label_id) {
      return Response.json({ error: 'subject_uri and label_id are required' }, { status: 400 });
    }

    // Verify the strike corresponds to a real toxic ModerationLabel record.
    // ModerationLabel creation is admin-only (RLS), so a public caller cannot
    // fabricate one — this ties the strike to a genuine moderation event and
    // prevents arbitrary strike increments from unauthenticated callers.
    let label = null;
    try { label = await base44.asServiceRole.entities.ModerationLabel.get(label_id); } catch { label = null; }
    if (!label || label.label_type !== 'toxic' || label.subject_uri !== subject_uri) {
      return Response.json({ error: 'Invalid or unverified moderation label' }, { status: 403 });
    }

    // 1. Resolve the flagged post by subject_uri (at:// URI or record id)
    let post = null;
    if (subject_uri.startsWith('at://')) {
      const posts = await base44.asServiceRole.entities.Post.filter({ at_uri: subject_uri });
      post = posts[0];
    } else {
      try { post = await base44.asServiceRole.entities.Post.get(subject_uri); } catch { /* not an id */ }
    }

    if (!post) {
      return Response.json({ error: 'Post not found', subject_uri }, { status: 404 });
    }

    const authorId = post.created_by_id;
    if (!authorId) {
      return Response.json({ error: 'Post author not found' }, { status: 404 });
    }

    // Idempotency: skip if this label was already processed. Prevents a public
    // caller from replaying a real label_id to increment strikes repeatedly.
    const priorLogs = await base44.asServiceRole.entities.ModerationLog.filter(
      { target_post_id: post.id, action: 'auto-escalate', auto_generated: true },
      '-created_date', 20
    ).catch(() => []);
    const alreadyProcessed = (priorLogs || []).some(
      (l) => Array.isArray(l.labels_affected) && l.labels_affected.includes(label_id)
    );
    if (alreadyProcessed) {
      return Response.json({ success: true, post_id: post.id, already_processed: true });
    }

    // 2. Trigger trade_assistant review via InvokeLLM — assess whether the toxic
    //    behaviour impacts the user's trustworthiness as a trader
    const reviewPrompt =
      'You are the SwapPulse Trade Assistant reviewing a flagged post for toxic behaviour. ' +
      'Assess whether this behaviour impacts the user\'s trustworthiness as a trader and recommend an action.\n\n' +
      'Post content: "' + (post.content || '') + '"\n' +
      'Moderation note: "' + (note || 'N/A') + '"\n' +
      'Author handle: ' + (post.author_handle || 'unknown') + '\n\n' +
      'Provide a brief assessment, whether it impacts trust, and a recommendation.';

    // Parallelize the LLM review and the user strike lookup (independent).
    const [reviewResponse, user] = await Promise.all([
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: reviewPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            assessment: { type: 'string', description: 'Brief assessment of the toxic behaviour' },
            impacts_trust: { type: 'boolean', description: 'Whether this impacts trade trustworthiness' },
            recommendation: { type: 'string', description: 'Recommended action for the trade assistant' }
          }
        }
      }),
      base44.asServiceRole.entities.User.get(authorId),
    ]);

    // 3. Add a strike to the user's trust profile
    const currentStrikes = (user.moderation_strikes || 0) + 1;
    const shouldRestrict = currentStrikes > 3;

    const updateData = { moderation_strikes: currentStrikes };
    if (shouldRestrict) {
      updateData.restricted = true;
    }

    await base44.asServiceRole.entities.User.update(authorId, updateData);

    // 4. Log to ModerationLog for audit trail
    await base44.asServiceRole.entities.ModerationLog.create({
      moderator_id: 'system',
      action: 'auto-escalate',
      target_post_id: post.id,
      target_author: post.author_handle || authorId,
      labels_affected: ['toxic', label_id],
      notes: 'Strike ' + currentStrikes + (shouldRestrict ? ', account restricted' : '') +
             '. Trade assistant review: ' + (reviewResponse.assessment || '').slice(0, 200),
      auto_generated: true
    });

    return Response.json({
      success: true,
      post_id: post.id,
      author_id: authorId,
      author_handle: post.author_handle,
      strikes: currentStrikes,
      restricted: shouldRestrict,
      review: reviewResponse
    });
  } catch (error) {
    console.error('handle-toxic-label error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}