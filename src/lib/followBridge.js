// Shared follow/unfollow helpers that bridge to the AT Protocol PDS.
//
// createBridgedFollow: stamps + creates a local Follow entity, then fires a
//   PDS bridge to mint a real app.bsky.graph.follow record. On success the
//   Follow is updated with at_uri/cid/bridged=true. Non-fatal: the local follow
//   persists even if the PDS is unreachable.
// deleteBridgedFollow: reads the Follow's at_uri, deletes the local entity,
//   then deletes the PDS record if it was bridged. Non-fatal: local delete
//   succeeds even if the PDS delete fails.

import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

export async function createBridgedFollow(subjectDid, subjectName, subjectHandle, subjectAvatar) {
  const { did, signingKey } = await ensureUserDid();
  const stamped = await stampRecord({
    subject_did: subjectDid,
    subject_name: subjectName,
    subject_handle: subjectHandle,
    subject_avatar: subjectAvatar,
  }, NSID.FOLLOW, did, signingKey);
  const follow = await base44.entities.Follow.create(stamped);
  // Fire-and-forget PDS bridge — non-fatal.
  base44.functions.invoke('atproto-bridge', {
    collection: 'app.bsky.graph.follow',
    record: { subject: subjectDid, createdAt: new Date().toISOString() },
  }).then((res) => {
    const uri = res?.data?.uri || res?.uri;
    const cid = res?.data?.cid || res?.cid;
    if (uri) {
      base44.entities.Follow.update(follow.id, { at_uri: uri, cid: cid || '', bridged: true }).catch(() => {});
    }
  }).catch(() => {});
  return follow;
}

export async function deleteBridgedFollow(followId) {
  const follow = await base44.entities.Follow.get(followId).catch(() => null);
  await base44.entities.Follow.delete(followId);
  if (follow?.at_uri?.startsWith('at://did:')) {
    base44.functions.invoke('atproto-bridge', { action: 'delete', uri: follow.at_uri }).catch(() => {});
  }
}