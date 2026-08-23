import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Redeem an invite code after a new user verifies their email. Marks the code
// used, then auto-creates a Follow (invitee → inviter) and an accepted
// Friendship so the two collectors are immediately connected. Runs as the
// authenticated new user (user-scoped client) so created_by_id is set correctly;
// the InviteCode update uses the service role.
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
    if (!invite || invite.status !== 'active') return Response.json({ error: 'invalid or expired invite' }, { status: 400 });
    if (!invite.inviter_did) {
      // Admin-generated alpha code: just mark used, no auto-follow/friend.
      await base44.asServiceRole.entities.InviteCode.update(invite.id, {
        status: 'used', used_by_did: user.email || user.id, used_at: new Date().toISOString(),
      });
      return Response.json({ redeemed: true, autoFollow: false });
    }

    const myDid = user.data?.did || '';
    const inviterDid = invite.inviter_did;
    if (myDid && myDid === inviterDid) return Response.json({ error: 'cannot redeem your own invite' }, { status: 400 });

    // 1. Auto-follow the inviter (invitee → inviter).
    if (myDid) {
      const alreadyFollowing = await base44.entities.Follow.filter({ subject_did: inviterDid, did: myDid }, '-created_date', 1).catch(() => []);
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

    // 2. Auto-create an accepted Friendship (one bidirectional record).
    //    created_by_id = invitee, friend_did = inviter, status accepted.
    const existingFriendship = await base44.entities.Friendship.filter(
      { friend_did: inviterDid, did: myDid },
      '-created_date', 1,
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

    // 3. Mark the invite code used.
    await base44.asServiceRole.entities.InviteCode.update(invite.id, {
      status: 'used', used_by_did: user.email || user.id, used_at: new Date().toISOString(),
    });

    // 4. Notify the inviter they brought a new collector in (non-fatal).
    base44.functions.invoke('notify-interaction', {
      recipientDid: inviterDid,
      actionType: 'invite_accepted',
      actorDid: myDid,
      actorName: user.full_name || user.email || '',
      actorHandle: user.data?.bsky_handle || '',
      actorAvatar: user.data?.avatar_url || '',
      origin: 'local',
    }).catch(() => {});

    return Response.json({ redeemed: true, autoFollow: true, inviterDid });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}