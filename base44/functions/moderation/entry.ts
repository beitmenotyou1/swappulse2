import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function computeSince(timeframe) {
  if (!timeframe || timeframe === 'all') return null;
  const ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[timeframe];
  if (!ms) return null;
  return new Date(Date.now() - ms);
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() === n.getUTCDate();
}

function mapRow(p, priorFlags) {
  return {
    id: p.id,
    timestamp: p.created_date,
    author: {
      did: p.did || p.created_by_id,
      displayName: p.author_name || p.author_handle || 'Unknown',
      handle: p.author_handle,
      avatarUrl: p.author_avatar,
      priorFlags: Math.max(0, priorFlags),
    },
    post: { text: p.content, hashtags: p.hashtags || [], canonical_tags: p.canonical_tags || [] },
    labels: (p.moderation_labels || []).map((l) => ({
      label: l.label,
      severity: l.severity,
      confidence: l.confidence,
      reason: l.reason,
      detectedAt: p.created_date,
    })),
    status: p.moderation_status || 'pending',
    assignedTo: p.moderated_by,
    resolvedAt: p.moderated_at,
    notes: p.moderation_notes,
  };
}

function computeStats(flagged) {
  const pending = flagged.filter((p) => !p.moderation_status || p.moderation_status === 'pending').length;
  const resolvedToday = flagged.filter(
    (p) => p.moderated_at && isToday(p.moderated_at) && ['reviewed', 'dismissed'].includes(p.moderation_status)
  ).length;
  const highSeverity = flagged.filter((p) => (p.moderation_labels || []).some((l) => l.severity === 'escalate')).length;
  const escalations = flagged.filter((p) => p.moderation_status === 'escalated').length;
  const resolved = flagged.filter((p) => p.moderated_at && p.created_date);
  let avgResponseMin = 0;
  if (resolved.length) {
    const total = resolved.reduce((s, p) => s + (new Date(p.moderated_at).getTime() - new Date(p.created_date).getTime()), 0);
    avgResponseMin = Math.round(total / resolved.length / 60000);
  }
  return { pending, resolvedToday, highSeverity, avgResponseMin, escalations, autoResolved: 0, total: flagged.length };
}

async function loadFlagged(base44, body) {
  const since = computeSince(body.timeframe || '7d');
  const posts = await base44.entities.Post.list('-created_date', 500);
  let flagged = posts.filter((p) => Array.isArray(p.moderation_labels) && p.moderation_labels.length > 0);
  if (since) flagged = flagged.filter((p) => new Date(p.created_date) >= since);
  if (body.severity && body.severity.length) flagged = flagged.filter((p) => (p.moderation_labels || []).some((l) => body.severity.includes(l.severity)));
  if (body.labelType && body.labelType.length) flagged = flagged.filter((p) => (p.moderation_labels || []).some((l) => body.labelType.includes(l.label)));
  if (body.status && body.status.length) flagged = flagged.filter((p) => body.status.includes(p.moderation_status || 'pending'));
  if (body.authorDid) {
    const q = String(body.authorDid).toLowerCase();
    flagged = flagged.filter((p) => [p.did, p.created_by_id, p.author_handle].filter(Boolean).map((s) => String(s).toLowerCase()).includes(q));
  }
  if (body.confidenceMin != null && body.confidenceMin > 0) {
    const min = body.confidenceMin / 100;
    flagged = flagged.filter((p) => (p.moderation_labels || []).some((l) => (l.confidence || 0) >= min));
  }
  return flagged;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const body = await req.json().catch(() => ({}));
    const op = body.op || 'list';

    if (op === 'list' || op === 'stats') {
      const flagged = await loadFlagged(base44, body);
      if (op === 'stats') return Response.json({ stats: computeStats(flagged) });
      const page = body.page || 1;
      const pageSize = body.pageSize || 20;
      const totalCount = flagged.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      const slice = flagged.slice((page - 1) * pageSize, page * pageSize);
      const authorCounts = {};
      flagged.forEach((p) => {
        const a = p.created_by_id || p.did;
        if (a) authorCounts[a] = (authorCounts[a] || 0) + 1;
      });
      const rows = slice.map((p) => mapRow(p, (authorCounts[p.created_by_id || p.did] || 1) - 1));
      return Response.json({ posts: rows, totalCount, totalPages, page });
    }

    if (op === 'resolve') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { post_id, decision, notes } = body;
      if (!['approve', 'dismiss', 'escalate'].includes(decision)) return Response.json({ error: 'Invalid decision' }, { status: 400 });
      const post = await base44.entities.Post.get(post_id);
      if (!post) return Response.json({ error: 'Not found' }, { status: 404 });
      const statusMap = { approve: 'reviewed', dismiss: 'dismissed', escalate: 'escalated' };
      await base44.entities.Post.update(post_id, {
        moderation_status: statusMap[decision],
        moderation_notes: notes || '',
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      });
      await base44.entities.ModerationLog.create({
        moderator_id: user.id,
        moderator_name: user.full_name || user.email || 'Moderator',
        action: decision,
        target_post_id: post_id,
        target_author: post.author_handle || post.created_by_id || '',
        labels_affected: (post.moderation_labels || []).map((l) => l.label),
        notes: notes || '',
        auto_generated: false,
      });
      return Response.json({ success: true });
    }

    if (op === 'bulk') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { post_ids, action, notes } = body;
      if (!Array.isArray(post_ids) || !post_ids.length) return Response.json({ error: 'post_ids required' }, { status: 400 });
      const statusMap = { approve_all: 'reviewed', dismiss_all: 'dismissed', escalate_all: 'escalated' };
      const newStatus = statusMap[action];
      if (!newStatus) return Response.json({ error: 'Invalid action' }, { status: 400 });

      // Batch-fetch all posts in one call (avoids per-post Post.get).
      const posts = await base44.entities.Post.filter({ id: { $in: post_ids } }, '-created_date', 500).catch(() => []);
      const foundIds = new Set(posts.map((p) => p.id));
      const missing = post_ids.filter((pid) => !foundIds.has(pid));
      const errors = missing.map((pid) => `${pid}: not found`);

      // Batch-update all found posts in one call (avoids per-post Post.update).
      const now = new Date().toISOString();
      if (foundIds.size > 0) {
        await base44.entities.Post.updateMany(
          { id: { $in: [...foundIds] } },
          { $set: {
            moderation_status: newStatus,
            moderation_notes: notes || '',
            moderated_by: user.id,
            moderated_at: now,
          } },
        ).catch((e) => { errors.push(`updateMany failed: ${e?.message || e}`); });
      }

      // Batch-create all ModerationLog records in one call.
      const logRecords = posts.map((p) => ({
        moderator_id: user.id,
        moderator_name: user.full_name || user.email || 'Moderator',
        action: action.replace('_all', ''),
        target_post_id: p.id,
        target_author: p.author_handle || p.created_by_id || '',
        labels_affected: (p.moderation_labels || []).map((l) => l.label),
        notes: notes || '',
        auto_generated: false,
      }));
      if (logRecords.length > 0) {
        await base44.entities.ModerationLog.bulkCreate(logRecords).catch((e) => {
          errors.push(`bulkCreate logs failed: ${e?.message || e}`);
        });
      }

      return Response.json({ processed: posts.length, errors });
    }

    if (op === 'activity') {
      const logs = await base44.entities.ModerationLog.list('-created_date', 50);
      return Response.json({ logs });
    }

    return Response.json({ error: 'Unknown op' }, { status: 400 });
  } catch (error) {
    console.error('moderation error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});