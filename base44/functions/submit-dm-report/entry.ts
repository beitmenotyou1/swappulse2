import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { decryptPassword } from '../../shared/appPasswordCrypto.ts';

// Submits a report for a direct message. Verifies the caller is a participant
// of the reported conversation, creates a ContentReport with content_type
// 'direct_message', then decrypts the message's escrow ciphertext (service
// role) and stores the plaintext in reported_message_plaintext so moderators
// can review the reported content. Non-DM reports use the client-side flow.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const messageId = String(body.messageId || '').trim();
    const reason = String(body.reason || '').trim();
    if (!messageId || !reason) return Response.json({ error: 'messageId and reason required' }, { status: 400 });

    const msg = await base44.asServiceRole.entities.DirectMessage.get(messageId).catch(() => null);
    if (!msg) return Response.json({ error: 'message not found' }, { status: 404 });
    const myDid = user.data?.did || '';
    if (msg.did !== myDid && msg.recipient_did !== myDid) {
      return Response.json({ error: 'forbidden — not a participant' }, { status: 403 });
    }

    let plaintext = '';
    if (msg.escrow_key_cipher) {
      try { plaintext = await decryptPassword(msg.escrow_key_cipher); } catch {}
    }

    const report = await base44.asServiceRole.entities.ContentReport.create({
      content_type: 'direct_message',
      content_id: messageId,
      content_preview: plaintext.slice(0, 500) || '[encrypted]',
      author_handle: msg.author_handle || '',
      reason,
      details: String(body.details || '').slice(0, 1000),
      evidence_urls: Array.isArray(body.evidenceUrls) ? body.evidenceUrls.slice(0, 5) : [],
      reported_message_plaintext: plaintext.slice(0, 4000),
      status: 'pending',
    });

    return Response.json({ ok: true, reportId: report.id });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}