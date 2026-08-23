import React, { useEffect, useRef, useState } from 'react';
import { Bell, Loader2, UserPlus, UserCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { createBridgedFollow, deleteBridgedFollow } from '@/lib/followBridge';

// Two-part follow + bell control. Following creates an app.bsky.graph.follow
// record plus a default (bell-off) followPreference. The bell toggles the
// preference's bell_enabled, opting into push notifications for the subject.
export default function FollowBellButton({ subjectDid, subjectName, subjectHandle, subjectAvatar }) {
  const [myDid, setMyDid] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [following, setFollowing] = useState(false);
  const [bell, setBell] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followId, setFollowId] = useState(null);
  const [prefId, setPrefId] = useState(null);
  const bellRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      const { did } = await ensureUserDid().catch(() => ({ did: me?.did || '' }));
      if (!active) return;
      setMyDid(did);
      setIsGuest(!me);
      if (!did || did === subjectDid) return;
      const [f, p] = await Promise.all([
        base44.entities.Follow.filter({ did, subject_did: subjectDid }).catch(() => []),
        base44.entities.FollowPreference.filter({ did, subject_did: subjectDid }).catch(() => []),
      ]);
      if (!active) return;
      setFollowing(f.length > 0);
      setFollowId(f[0]?.id || null);
      setBell(!!p[0]?.bell_enabled);
      setPrefId(p[0]?.id || null);
    })();
    return () => { active = false; };
  }, [subjectDid]);

  if (!subjectDid || myDid === subjectDid) return null;

  // Logged-out visitors can't create a bridged follow (no DID), so link them
  // to the subject's Bluesky profile to follow from their own AT Protocol app.
  if (isGuest) {
    return (
      <a
        href={`https://bsky.app/profile/${subjectDid}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        <UserPlus className="h-4 w-4" /> Follow on Bluesky
      </a>
    );
  }

  const pulse = () => {
    if (bellRef.current?.animate) {
      bellRef.current.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
        { duration: 300, easing: 'ease-out' },
      );
    }
  };

  const toggleFollow = async () => {
    setBusy(true);
    try {
      if (!following) {
        const f = await createBridgedFollow(subjectDid, subjectName, subjectHandle, subjectAvatar);
        setFollowing(true); setFollowId(f.id);
        const { did, signingKey } = await ensureUserDid();
        const ps = await stampRecord({
          subject_did: subjectDid, bell_enabled: false,
          notify_on: ['pack_opening', 'trade_listing'], priority: 'standard',
        }, NSID.FOLLOW_PREFERENCE, did, signingKey);
        const p = await base44.entities.FollowPreference.create(ps);
        setPrefId(p.id);
      } else {
        if (followId) await deleteBridgedFollow(followId);
        if (prefId) await base44.entities.FollowPreference.delete(prefId);
        setFollowing(false); setFollowId(null); setBell(false); setPrefId(null);
      }
    } catch (e) { console.error('follow error', e); } finally { setBusy(false); }
  };

  const toggleBell = async () => {
    if (!following || busy) return;
    const next = !bell;
    setBell(next);
    pulse();
    setBusy(true);
    try {
      if (prefId) {
        await base44.entities.FollowPreference.update(prefId, { bell_enabled: next });
      } else {
        const { did, signingKey } = await ensureUserDid();
        const ps = await stampRecord({
          subject_did: subjectDid, bell_enabled: next,
          notify_on: ['pack_opening', 'trade_listing'], priority: 'standard',
        }, NSID.FOLLOW_PREFERENCE, did, signingKey);
        const p = await base44.entities.FollowPreference.create(ps);
        setPrefId(p.id);
      }
    } catch (e) {
      setBell(!next);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleFollow}
        disabled={busy}
        className="relative flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 before:content-[''] before:absolute before:-inset-y-1"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {following ? 'Following' : 'Follow'}
      </button>
      {following && (
        <button
          ref={bellRef}
          onClick={toggleBell}
          disabled={busy}
          title={bell ? `Notifications on for @${subjectHandle || subjectName}` : 'Turn on notifications'}
          className={`relative grid h-8 w-8 place-items-center rounded-lg transition-colors disabled:opacity-50 before:content-[''] before:absolute before:-inset-1.5 ${bell ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-primary'}`}
        >
          <Bell className={`h-4 w-4 ${bell ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  );
}