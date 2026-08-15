// Shared direct-message helpers that bridge to the AT Protocol PDS.
//
// startOrFindConversation: finds an existing Conversation between the current
//   user and a target DID (checking both directions), or creates a new one and
//   bridges it to the PDS. Returns the Conversation record.
// sendDirectMessage: stamps + creates a DirectMessage entity, updates the
//   Conversation's last_message_at/preview, bridges the message to the PDS, and
//   fires notify-interaction so the recipient gets a 'message' notification.

import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

// Find an existing conversation between two DIDs (either direction), or null.
async function findConversation(myDid, theirDid) {
  const [asCreator, asRecipient] = await Promise.all([
    base44.entities.Conversation.filter({ did: myDid, recipient_did: theirDid }, '-created_date', 1).catch(() => []),
    base44.entities.Conversation.filter({ did: theirDid, recipient_did: myDid }, '-created_date', 1).catch(() => []),
  ]);
  return asCreator[0] || asRecipient[0] || null;
}

export async function startOrFindConversation(targetDid, targetName, targetHandle, targetAvatar) {
  const { did, signingKey } = await ensureUserDid();
  const me = await base44.auth.me().catch(() => null);

  // Reuse an existing conversation if one already exists between this pair.
  const existing = await findConversation(did, targetDid);
  if (existing) return existing;

  const participantDids = [did, targetDid].sort();
  const stamped = await stampRecord({
    recipient_did: targetDid,
    participant_dids: participantDids,
    recipient_name: targetName || '',
    recipient_handle: targetHandle || '',
    recipient_avatar: targetAvatar || '',
    last_message_at: new Date().toISOString(),
    last_message_preview: '',
    last_message_did: '',
  }, NSID.CONVERSATION, did, signingKey);

  const created = await base44.entities.Conversation.create(stamped);

  // Bridge the conversation record to the PDS (fire-and-forget, non-fatal).
  base44.functions.invoke('atproto-bridge', {
    collection: NSID.CONVERSATION,
    record: {
      participantDids,
      createdAt: new Date().toISOString(),
    },
  }).then((res) => {
    const uri = res?.uri;
    const cid = res?.cid;
    if (uri) base44.entities.Conversation.update(created.id, { at_uri: uri, cid: cid || '', bridged: true }).catch(() => {});
  }).catch(() => {});

  return created;
}

export async function sendDirectMessage(conversation, text, user) {
  const { did, signingKey } = await ensureUserDid();
  const recipientDid = conversation.did === did ? conversation.recipient_did : conversation.did;
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return null;

  const stamped = await stampRecord({
    conversation_id: conversation.id,
    conversation_ref: conversation.at_uri || '',
    did,
    recipient_did: recipientDid,
    body: trimmed,
    author_name: user?.display_name || user?.full_name || 'Collector',
    author_handle: user?.bsky_handle || user?.username || (user?.email ? user.email.split('@')[0] : ''),
    author_avatar: user?.avatar || '',
    read: false,
  }, NSID.DIRECT_MESSAGE, did, signingKey);

  const created = await base44.entities.DirectMessage.create(stamped);

  // Update the conversation's last-message metadata.
  base44.entities.Conversation.update(conversation.id, {
    last_message_at: new Date().toISOString(),
    last_message_preview: trimmed.slice(0, 200),
    last_message_did: did,
  }).catch(() => {});

  // Bridge the message to the PDS (fire-and-forget, non-fatal).
  base44.functions.invoke('atproto-bridge', {
    collection: NSID.DIRECT_MESSAGE,
    record: {
      conversationRef: conversation.at_uri || '',
      recipientDid,
      body: trimmed,
      createdAt: new Date().toISOString(),
    },
  }).then((res) => {
    const uri = res?.uri;
    const cid = res?.cid;
    if (uri) base44.entities.DirectMessage.update(created.id, { at_uri: uri, cid: cid || '', bridged: true }).catch(() => {});
  }).catch(() => {});

  // Notify the recipient via notify-interaction so they get an in-app + push notification.
  if (recipientDid && recipientDid !== did) {
    base44.functions.invoke('notify-interaction', {
      recipientDid,
      actionType: 'message',
      actorDid: did,
      actorName: user?.display_name || user?.full_name || '',
      actorHandle: user?.bsky_handle || user?.username || '',
      actorAvatar: user?.avatar || '',
      post: { id: conversation.id, at_uri: conversation.at_uri, cid: conversation.cid, content: trimmed.slice(0, 80) },
      postUri: conversation.at_uri,
      origin: 'local',
      commentText: trimmed.slice(0, 200),
    }).catch(() => {});
  }

  return created;
}

// Mark all messages in a conversation as read (called when the recipient opens the thread).
export async function markConversationRead(conversationId, myDid) {
  try {
    const unread = await base44.entities.DirectMessage.filter(
      { conversation_id: conversationId, recipient_did: myDid, read: false },
      '-created_date',
      200,
    );
    if (!unread.length) return;
    await base44.entities.DirectMessage.bulkUpdate(
      unread.map((m) => ({ id: m.id, read: true })),
    );
  } catch {}
}