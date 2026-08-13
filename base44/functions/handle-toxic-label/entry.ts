import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { subject_uri, labeler_did, note, label_id } = body;

    if (!subject_uri) {
      return Response.json({ error: 'subject_uri is required' }, { status: 400 });
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

    // 2. Trigger trade_assistant review via InvokeLLM — assess whether the toxic
    //    behavior impacts the user's trustworthiness as a trader
    const reviewPrompt =
      'You are the SwapPulse Trade Assistant reviewing a flagged post for toxic behavior. ' +
      'Assess whether this behavior impacts the user\'s trustworthiness as a trader and recommend an action.\n\n' +
      'Post content: "' + (post.content || '') + '"\n' +
      'Moderation note: "' + (note || 'N/A') + '"\n' +
      'Author handle: ' + (post.author_handle || 'unknown') + '\n\n' +
      'Provide a brief assessment, whether it impacts trust, and a recommendation.';

    const reviewResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: reviewPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          assessment: { type: 'string', description: 'Brief assessment of the toxic behavior' },
          impacts_trust: { type: 'boolean', description: 'Whether this impacts trade trustworthiness' },
          recommendation: { type: 'string', description: 'Recommended action for the trade assistant' }
        }
      }
    });

    // 3. Add a strike to the user's trust profile
    const user = await base44.asServiceRole.entities.User.get(authorId);
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
      labels_affected: ['toxic'],
      notes: 'Strike ' + currentStrikes + (shouldRestrict ? ' — account restricted' : '') +
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