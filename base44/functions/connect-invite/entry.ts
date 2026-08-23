// connect-invite — called when an already-joined member clicks an invite link.
// Silently auto-creates a Follow (invitee → inviter) and an accepted
// Friendship, notifies the inviter, and returns the inviter's profile so the
// landing page can redirect there. Does NOT mark the code used — the link
// stays shareable so other existing members can still connect via it.
// Idempotent: re-clicking is a no-op (existing Follow/Friendship are skipped).
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const code = String(body.code || '').trim();
    if (!code) return Response.json({ error: 'code required' }, { status: 400 });

    const found = await base44.asServiceRole.entities.InviteCode.filter({ code }, '-created_date', 1);
    const invite = found[0];
    if (!invite || invite.status !== 'active') {
      return Response.json({ error: 'invalid or expired invite' }, { status: 400 });
    }
    if (!invite.inviter_did) {
      // Admin-generated code — no inviter to connect to.
      return Response.json({ connected: false, inviter: null });
    }

    const myDid = user.data?.did || '';
    const inviterDid = invite.inviter_did;
    if (myDid && myDid === inviterDid) {
      return Response.json({ error: 'This is your own invite link.' }, { status: 400 });
    }

    // 1. Auto-follow the inviter (idempotent).
    if (myDid) {
      const alreadyFollowing = await base44.entities.Follow.filter(
        { subject_did: inviterDid, did: myDid }, '-created_date', 1,
      ).catch(() => []);
      if (!alreadyFollowing.length) {
        await base44.entities.Follow.create({
          subject_did: inviterDid,
          subject_name: invite.inviter_name || '',
          subject_handle: invite.inviter_handle || '',
          subject_avatar: invite.inviter_avatar || '',
          did: myDid,
        }).catch(() => {});
      }
    }

    // 2. Auto-create an accepted Friendship (idempotent).
    const existingFriendship = await base44.entities.Friendship.filter(
      { friend_did: inviterDid, did: myDid }, '-created_date', 1,
    ).catch(() => []);
    if (!existingFriendship.length) {
      await base44.entities.Friendship.create({
        friend_did: inviterDid,
        friend_name: invite.inviter_name || '',
        friend_handle: invite.inviter_handle || '',
        status: 'accepted',
        initiated_by: myDid,
        acknowledged_at: new Date().toISOString(),
        did: myDid,
        description: 'Connected via invite link',
      }).catch(() => {});
    }

    // 3. Notify the inviter (non-fatal).
    base44.functions.invoke('notify-interaction', {
      recipientDid: inviterDid,
      actionType: 'invite_accepted',
      actorDid: myDid,
      actorName: user.full_name || user.email || '',
      actorHandle: user.data?.bsky_handle || '',
      actorAvatar: user.data?.avatar_url || '',
      origin: 'local',
    }).catch(() => {});

    return Response.json({
      connected: true,
      inviter: {
        did: inviterDid,
        name: invite.inviter_name || '',
        handle: invite.inviter_handle || '',
      },
    });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}