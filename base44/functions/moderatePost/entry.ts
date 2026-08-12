import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { evaluateHashtagRules, severityFor } from '../../shared/hashtagRules.ts';

const FLOODING_WINDOW_MS = 30 * 60 * 1000;

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

    // Only the post author (or an admin) should trigger labeling.
    if (post.created_by_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Flooding context: the author's recent posts within the flooding window.
    const since = new Date(Date.now() - FLOODING_WINDOW_MS);
    const recent = await base44.entities.Post.filter(
      { created_by_id: post.created_by_id },
      '-created_date',
      20
    ).catch(() => []);
    const recentUserPosts = recent
      .filter((p) => p.id !== post.id && new Date(p.created_date) >= since)
      .map((p) => ({
        uri: p.id,
        hashtags: p.hashtags || [],
        createdAt: p.created_date,
      }));

    const { labels, reasons } = evaluateHashtagRules(
      { text: post.content, hashtags: post.hashtags || [] },
      { recentUserPosts }
    );

    const moderation_labels = labels.map((l) => ({
      label: l.label,
      severity: severityFor(l.label),
      reason: l.reason,
      confidence: l.confidence,
    }));

    await base44.entities.Post.update(postId, { moderation_labels });

    return Response.json({ labels: moderation_labels, reasons });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});