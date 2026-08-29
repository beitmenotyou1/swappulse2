import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Submits a report for a direct message without decrypting or escrowing the
// message body. The caller must be one of the two DM participants. Moderators
// receive metadata, the reporter's explanation and any explicitly uploaded
// evidence, while the E2EE body remains ciphertext.
export default async function (req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const messageId = String(body.messageId || '').trim();
    const reason = String(body.reason || '').trim();
    const allowedReasons = new Set(['spam', 'scam', 'harassment', 'nsfw', 'off_topic', 'misgraded', 'impersonation', 'other']);
    if (!messageId || !allowedReasons.has(reason)) {
      return Response.json({ error: 'Valid messageId and reason are required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const msg = await svc.entities.DirectMessage.get(messageId).catch(() => null);
    if (!msg) return Response.json({ error: 'Message not found' }, { status: 404 });

    const myDid = String(user.data?.did || user.did || '').trim();
    if (!myDid || (String(msg.did || '') !== myDid && String(msg.recipient_did || '') !== myDid)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const evidenceUrls = Array.isArray(body.evidenceUrls)
      ? body.evidenceUrls.map((value: unknown) => String(value || '').trim()).filter(Boolean).slice(0, 5)
      : [];

    const report = await svc.entities.ContentReport.create({
      content_type: 'direct_message',
      content_id: messageId,
      content_preview: '[End-to-end encrypted message]',
      author_handle: String(msg.author_handle || '').slice(0, 200),
      reason,
      details: String(body.details || '').trim().slice(0, 1000),
      evidence_urls: evidenceUrls,
      status: 'pending',
    });

    return Response.json({ ok: true, reportId: report.id });
  } catch (error: any) {
    console.error('submit-dm-report error:', error?.message || error);
    return Response.json({ error: 'Could not submit report' }, { status: 500 });
  }
}
