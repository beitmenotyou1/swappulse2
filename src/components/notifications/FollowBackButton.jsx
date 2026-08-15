import React, { useEffect, useState } from 'react';
import { Loader2, UserPlus, UserCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import { createBridgedFollow, deleteBridgedFollow } from '@/lib/followBridge';

// Inline "Follow back" button shown on follow notification cards. Creates a
// real bridged Follow record (mirrored to Bluesky via the existing follow
// bridge) without navigating away from the notifications panel.
export default function FollowBackButton({ n, onResponded }) {
  const [myDid, setMyDid] = useState('');
  const [following, setFollowing] = useState(false);
  const [followId, setFollowId] = useState(null);
  const [busy, setBusy] = useState(false);

  const actorDid = n?.actor_did;

  useEffect(() => {
    if (!actorDid) return;
    let active = true;
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      const { did } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
      if (!active || !did || did === actorDid) return;
      setMyDid(did);
      const f = await base44.entities.Follow.filter({ did, subject_did: actorDid }).catch(() => []);
      if (!active) return;
      setFollowing(f.length > 0);
      setFollowId(f[0]?.id || null);
    })();
    return () => { active = false; };
  }, [actorDid]);

  if (!actorDid || !myDid || myDid === actorDid) return null;

  const toggle = async (e) => {
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (!following) {
        const f = await createBridgedFollow(actorDid, n.actor_name, n.actor_handle, n.actor_avatar);
        setFollowing(true);
        setFollowId(f.id);
        onResponded?.();
      } else if (followId) {
        await deleteBridgedFollow(followId);
        setFollowing(false);
        setFollowId(null);
      }
    } catch (err) {
      console.error('follow-back error', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={following ? 'Unfollow' : 'Follow back'}
      aria-pressed={following}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${following ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-secondary'}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : following ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {following ? 'Following' : 'Follow back'}
    </button>
  );
}