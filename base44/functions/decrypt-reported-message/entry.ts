import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { decryptPassword } from '../../shared/appPasswordCrypto.ts';

// Moderator/admin only. Decrypts a reported DM's escrow ciphertext and returns
// the plaintext so it can be reviewed and stored on the ContentReport. Used by
// the report flow when content_type is 'direct_message'.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const messageId = String(body.messageId || '').trim();
    if (!messageId) return Response.json({ error: 'messageId required' }, { status: 400 });

    const msg = await base44.asServiceRole.entities.DirectMessage.get(messageId).catch(() => null);
    if (!msg) return Response.json({ error: 'not found' }, { status: 404 });
    if (!msg.escrow_key_cipher) return Response.json({ error: 'no escrow available for this message' }, { status: 404 });

    const plaintext = await decryptPassword(msg.escrow_key_cipher);
    return Response.json({ plaintext, messageId, conversationId: msg.conversation_id });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}