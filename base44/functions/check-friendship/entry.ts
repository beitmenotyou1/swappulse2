import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Check the friendship status between the current user and a target DID.
// Returns { status: 'accepted' | 'pending' | 'declined' | 'none', direction }.
// Used by the MessageButton to gate DMs to accepted friends only.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const targetDid = String(body.targetDid || '').trim();
    if (!targetDid) return Response.json({ error: 'targetDid required' }, { status: 400 });

    const myDid = user.data?.did || '';
    if (!myDid) return Response.json({ status: 'none' });

    // I initiated: records where targetDid is my friend (created_by me).
    const mine = await base44.entities.Friendship.filter({ friend_did: targetDid, did: myDid }, '-created_date', 1).catch(() => []);
    if (mine[0]) return Response.json({ status: mine[0].status, direction: 'outgoing', recordId: mine[0].id });

    // They initiated: records where I'm the friend and target is the creator.
    const theirs = await base44.entities.Friendship.filter({ friend_did: myDid, did: targetDid }, '-created_date', 1).catch(() => []);
    if (theirs[0]) return Response.json({ status: theirs[0].status, direction: 'incoming', recordId: theirs[0].id });

    return Response.json({ status: 'none' });
  } catch (e) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}