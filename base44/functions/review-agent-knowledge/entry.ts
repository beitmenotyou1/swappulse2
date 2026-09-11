import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_PUBLISHABLE_CHARS = 20000;
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(?:all\s+|any\s+)?(?:previous|prior|system|developer)\s+(?:instructions?|messages?|prompts?)/i,
  /(?:system|developer)\s+(?:message|prompt)\s*:/i,
  /(?:reveal|print|return|exfiltrate).{0,80}(?:secret|credential|private[_ -]?key|seed phrase|password|api[_ -]?key|access token)/i,
  /<script\b|javascript\s*:/i,
  /(?:tool|function)[_ -]?call\s*[:=]/i,
];

function cleanField(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normaliseContent(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const revisionId = cleanField(body.revision_id, 128);
    const decision = cleanField(body.decision, 16);
    const reviewNotes = cleanField(body.review_notes, 500);

    if (!ID_PATTERN.test(revisionId)) {
      return Response.json(
        { error: 'Invalid revision_id' },
        { status: 400 },
      );
    }
    if (decision !== 'approve' && decision !== 'reject') {
      return Response.json(
        { error: 'decision must be approve or reject' },
        { status: 400 },
      );
    }

    const svc = base44.asServiceRole;
    const revision =
      await svc.entities.AgentKnowledgeRevision.get(revisionId)
        .catch(() => null);

    if (!revision) {
      return Response.json(
        { error: 'Knowledge revision not found' },
        { status: 404 },
      );
    }
    if (revision.review_status !== 'pending_review') {
      return Response.json(
        { error: 'Knowledge revision has already been reviewed' },
        { status: 409 },
      );
    }

    const reviewedAt = new Date().toISOString();
    const content = normaliseContent(revision.content);
    const calculatedHash = await sha256(content);

    if (calculatedHash !== revision.content_hash) {
      return Response.json(
        { error: 'Knowledge revision content hash does not match' },
        { status: 409 },
      );
    }

    const generatedFlag =
      revision.safety_status === 'flagged' ||
      SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(content));

    if (decision === 'approve' && content.length > MAX_PUBLISHABLE_CHARS) {
      return Response.json(
        {
          error:
            'This source exceeds the approved knowledge size limit. Curate a shorter reviewed summary before publication.',
        },
        { status: 409 },
      );
    }

    if (decision === 'approve' && generatedFlag) {
      return Response.json(
        {
          error:
            'Safety-flagged knowledge cannot be published to an agent. Reject this revision and publish a clean, reviewed summary instead.',
          safety_status: 'flagged',
        },
        { status: 409 },
      );
    }

    if (decision === 'reject') {
      const rejected = await svc.entities.AgentKnowledgeRevision.update(
        revisionId,
        {
          review_status: 'rejected',
          safety_status: generatedFlag ? 'flagged' : 'passed',
          reviewed_by: user.id,
          reviewed_at: reviewedAt,
          review_notes: reviewNotes,
        },
      );

      return Response.json({
        ok: true,
        decision: 'rejected',
        revision_id: rejected.id,
        published_document_id: null,
        publication_changed: false,
      });
    }

    const existing =
      await svc.entities.AgentKnowledgeDocument.filter(
        { document_key: revision.document_key },
        '-reviewed_at',
        100,
      ).catch(() => []);

    const publishedRecord = {
      document_key: revision.document_key,
      title: revision.title,
      content,
      source_type: revision.source_type,
      source_url: revision.source_url,
      source_revision: revision.source_revision,
      content_hash: revision.content_hash,
      authority: revision.authority,
      locale: revision.locale || 'en',
      tags: Array.isArray(revision.tags) ? revision.tags : [],
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    };

    let published;
    if (existing[0]) {
      published = await svc.entities.AgentKnowledgeDocument.update(
        existing[0].id,
        publishedRecord,
      );

      for (const duplicate of existing.slice(1)) {
        await svc.entities.AgentKnowledgeDocument.update(
          duplicate.id,
          { status: 'retired' },
        );
      }
    } else {
      published =
        await svc.entities.AgentKnowledgeDocument.create(publishedRecord);
    }

    const approved = await svc.entities.AgentKnowledgeRevision.update(
      revisionId,
      {
        review_status: 'approved',
        safety_status: 'passed',
        reviewed_by: user.id,
        reviewed_at: reviewedAt,
        review_notes: reviewNotes,
        published_document_id: published.id,
      },
    );

    return Response.json({
      ok: true,
      decision: 'approved',
      revision_id: approved.id,
      published_document_id: published.id,
      document_key: published.document_key,
      source_revision: published.source_revision,
      publication_changed: true,
    });
  } catch (error: any) {
    console.error(
      'review-agent-knowledge error',
      error?.message || error,
    );
    return Response.json(
      { error: error?.message || 'Knowledge review failed' },
      { status: 500 },
    );
  }
}
