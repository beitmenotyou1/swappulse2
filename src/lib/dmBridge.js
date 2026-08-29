// Shared direct-message helpers. Direct messages are intentionally local-only:
// AT Protocol repositories are public, so Conversation and DirectMessage must
// never cross the PDS boundary. Message bodies are stored only as E2EE ciphertext.

import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import { encryptMessage, publishPublicKey } from '@/lib/e2ee';

// Find an existing conversation between two DIDs (either direction), or null.
async function findConversation(myDid, theirDid) {
  const [asCreator, asRecipient] = await Promise.all([
    base44.entities.Conversation.filter({ did: myDid, recipient_did: theirDid }, '-created_date', 1).catch(() => []),
    base44.entities.Conversation.filter({ did: theirDid, recipient_did: myDid }, '-created_date', 1).catch(() => []),
  ]);
  return asCreator[0] || asRecipient[0] || null;
}

export async function startOrFindConversation(targetDid, targetName, targetHandle, targetAvatar) {
  const { did } = await ensureUserDid();
  const me = await base44.auth.me().catch(() => null);

  // Reuse an existing conversation if one already exists between this pair.
  const existing = await findConversation(did, targetDid);
  if (existing) return existing;

  const participantDids = [did, targetDid].sort();
  return base44.entities.Conversation.create({
    did,
    recipient_did: targetDid,
    participant_dids: participantDids,
    recipient_name: targetName || '',
    recipient_handle: targetHandle || '',
    recipient_avatar: targetAvatar || '',
    last_message_at: new Date().toISOString(),
    last_message_preview: '',
    last_message_did: '',
    bridged: false,
  });
}

export async function sendDirectMessage(conversation, text, user) {
  const { did } = await ensureUserDid();
  const recipientDid = conversation.did === did ? conversation.recipient_did : conversation.did;
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return null;

  // Ensure my ECDH public key is published so the recipient can decrypt.
  await publishPublicKey().catch(() => {});

  // End-to-end encryption is mandatory. encryptMessage throws before any
  // record is created if the recipient has no usable public key.
  const { body: storedBody } = await encryptMessage(trimmed, did, recipientDid);

  const created = await base44.entities.DirectMessage.create({
    conversation_id: conversation.id,
    conversation_ref: '',
    did,
    recipient_did: recipientDid,
    body: storedBody,
    author_name: user?.display_name || user?.full_name || 'Collector',
    author_handle: user?.bsky_handle || user?.username || user?.custom_handle || '',
    author_avatar: user?.avatar || '',
    read: false,
    bridged: false,
  });

  // Update the conversation's last-message metadata. The preview is masked
  // when encrypted so the list view never leaks plaintext.
  const preview = '🔒 Encrypted message';
  base44.entities.Conversation.update(conversation.id, {
    last_message_at: new Date().toISOString(),
    last_message_preview: preview,
    last_message_did: did,
  }).catch(() => {});

  // Notify the recipient — never leak plaintext in the notification payload.
  if (recipientDid && recipientDid !== did) {
    base44.functions.invoke('notify-interaction', {
      recipientDid,
      actionType: 'message',
      actorDid: did,
      actorName: user?.display_name || user?.full_name || '',
      actorHandle: user?.bsky_handle || user?.username || '',
      actorAvatar: user?.avatar || '',
      post: { id: conversation.id, content: '🔒 Encrypted message' },
      postUri: '',
      origin: 'local',
      commentText: preview,
    }).catch(() => {});
  }

  return created;
}

// Mark recipient messages as read through a backend membership check. Direct
// entity updates are intentionally blocked so recipients cannot rewrite bodies.
export async function markConversationRead(conversationId) {
  if (!conversationId) return;
  await base44.functions.invoke('mark-dm-read', { conversationId }).catch(() => {});
}