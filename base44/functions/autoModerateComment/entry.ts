// autoModerateComment — runs keyword/regex/rate-limit checks on a comment
// (a Post record used as a comment) and writes moderation_labels.
// Called from the UI after a comment is created: base44.functions.invoke('autoModerateComment', { post_id })
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  evaluateCommentRules,
  severityForLabel,
  hasHideLabel,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
} from '../../shared/commentModeration.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const postId = body.post_id;
    if (!postId) return Response.json({ error: 'post_id required' }, { status: 400 });

    const post = await base44.entities.Post.get(postId);
    if (!post) return Response.json({ error: 'Post not found' }, { status: 404 });

    // Only the author (or admin) triggers auto-mod on their own comment
    if (post.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Run text-based rules
    let results = evaluateCommentRules(post.content || '');

    // Rate limit: check author's recent comments
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recent = await base44.entities.Post.filter(
      { created_by_id: post.created_by_id },
      '-created_date',
      RATE_LIMIT_MAX + 1
    ).catch(() => []);
    const recentCount = recent.filter(
      (p) => p.id !== post.id && new Date(p.created_date) >= since
    ).length;

    if (recentCount >= RATE_LIMIT_MAX) {
      results.push({
        label: 'rate-limited',
        severity: 'warn',
        reason: `Rate limit: ${recentCount} comments in the last minute`,
        confidence: 1,
        ruleName: 'rate-limit',
      });
    }

    // Build moderation_labels array
    const moderation_labels = results.map((r) => ({
      label: r.label,
      severity: r.severity,
      reason: r.reason,
      confidence: r.confidence,
    }));

    const update: any = { moderation_labels };
    if (moderation_labels.length > 0) {
      // Escalate if any hide-severity label, otherwise pending for warn
      if (hasHideLabel(moderation_labels)) {
        update.moderation_status = 'escalated';
      } else {
        update.moderation_status = 'pending';
      }
    }

    await base44.entities.Post.update(postId, update);

    return Response.json({
      labels: moderation_labels,
      rules: results.map((r) => r.ruleName),
      status: update.moderation_status || 'reviewed',
    });
  } catch (error) {
    console.error('[autoModerateComment] error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});