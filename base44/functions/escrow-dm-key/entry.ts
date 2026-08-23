import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { encryptPassword } from '../../shared/appPasswordCrypto.ts';

// Stores an admin-encrypted copy of a DM's plaintext in DirectMessage.escrow_key_cipher,
// enabling moderator review of reported messages and user history recovery on a
// new device. Called fire-and-forget by the client right after creating a DM.
// The plaintext is encrypted with the APP_PASSWORD_ENCRYPTION_KEY secret (AES-GCM)
// and only the ciphertext is persisted — the server never stores plaintext.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const messageId = String(body.messageId || '').trim();
    const plaintext = String(body.plaintext || '');
    if (!messageId || !plaintext) return Response.json({ error: 'messageId and plaintext required' }, { status: 400 });

    // Verify the caller is a participant of the message before escrowing.
    const msg = await base44.asServiceRole.entities.DirectMessage.get(messageId).catch(() => null);
    if (!msg) return Response.json({ error: 'not found' }, { status: 404 });
    const myDid = user.data?.did || '';
    if (msg.did !== myDid && msg.recipient_did !== myDid) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const escrowCipher = await encryptPassword(plaintext.slice(0, 4000));
    await base44.asServiceRole.entities.DirectMessage.update(messageId, { escrow_key_cipher: escrowCipher });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}