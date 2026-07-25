import React, { useEffect, useState } from 'react';
import { Clock, UserPlus, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

// Add-friend link - only renders for users you already follow. Sends a pending
// org.swappulse.friendship record. If the other party sent us a pending request,
// shows an Accept control instead. Friendship is active only when both parties
// have accepted records.
export default function AddFriendLink({ subjectDid, subjectName, subjectHandle }) {
  const [myDid, setMyDid] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [myF, setMyF] = useState(null);
  const [theirF, setTheirF] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubs = [];
    const reload = async (did) => {
      const [f, mine, theirs] = await Promise.all([
        base44.entities.Follow.filter({ did, subject_did: subjectDid }).catch(() => []),
        base44.entities.Friendship.filter({ did, friend_did: subjectDid }).catch(() => []),
        base44.entities.Friendship.filter({ did: subjectDid, friend_did: did }).catch(() => []),
      ]);
      if (!active) return;
      setIsFollowing(f.length > 0);
      setMyF(mine[0] || null);
      setTheirF(theirs[0] || null);
    };
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      const { did } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
      if (!active) return;
      setMyDid(did);
      if (!did || did === subjectDid) return;
      await reload(did);
      unsubs.push(base44.entities.Follow.subscribe(() => { if (active) reload(did); }));
      unsubs.push(base44.entities.Friendship.subscribe(() => { if (active) reload(did); }));
    })();
    return () => { active = false; unsubs.forEach((u) => { try { u(); } catch {} }); };
  }, [subjectDid]);

  if (!isFollowing || !subjectDid || myDid === subjectDid) return null;

  const isFriend = myF?.status === 'accepted' && theirF?.status === 'accepted';
  if (isFriend) return null;

  const sendRequest = async () => {
    setBusy(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const stamped = await stampRecord({
        friend_did: subjectDid, friend_name: subjectName, friend_handle: subjectHandle,
        status: 'pending', initiated_by: did,
      }, NSID.FRIENDSHIP, did, signingKey);
      const rec = await base44.entities.Friendship.create(stamped);
      setMyF(rec);
    } catch (e) { console.error('friend request error', e); } finally { setBusy(false); }
  };

  const acceptRequest = async () => {
    setBusy(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const now = new Date().toISOString();
      const stamped = await stampRecord({
        friend_did: subjectDid, friend_name: subjectName, friend_handle: subjectHandle,
        status: 'accepted', initiated_by: theirF.initiated_by, acknowledged_at: now,
      }, NSID.FRIENDSHIP, did, signingKey);
      const rec = await base44.entities.Friendship.create(stamped);
      setMyF(rec);
      if (theirF?.id) {
        await base44.entities.Friendship.update(theirF.id, { status: 'accepted', acknowledged_at: now });
      }
      setTheirF({ ...theirF, status: 'accepted', acknowledged_at: now });
    } catch (e) { console.error('accept error', e); } finally { setBusy(false); }
  };

  // They sent us a pending request → Accept
  if (theirF && theirF.status === 'pending' && (!myF || myF.status !== 'accepted')) {
    return (
      <div className="mt-2 flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Wants to be friends</span>
        <button onClick={acceptRequest} disabled={busy} className="inline-flex items-center gap-1 font-medium text-[#8b5cf6] disabled:opacity-50">
          <Check className="h-4 w-4" /> Accept
        </button>
      </div>
    );
  }

  // We sent a pending request
  if (myF && myF.status === 'pending') {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" /> Friend Request Sent
      </div>
    );
  }

  // No request yet → Add Friend
  return (
    <button onClick={sendRequest} disabled={busy} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#8b5cf6] disabled:opacity-50">
      <UserPlus className="h-4 w-4" /> Add Friend
    </button>
  );
}