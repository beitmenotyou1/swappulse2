import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import Avatar from '@/components/Avatar';
import LiveAvatar from '@/components/LiveAvatar';
import StoryViewer from './StoryViewer';
import { useLivePresence } from '@/lib/livePresence';
import StoryCamera from './StoryCamera';
import { useAuth } from '@/lib/AuthContext';

// Returns the set of DIDs the current user follows (outgoing follows).
async function followedDids(me) {
  const follows = await base44.entities.Follow.filter({ did: me }).catch(() => []);
  return new Set(follows.map((f) => f.subject_did).filter(Boolean));
}

export default function StoriesBar() {
  const [stories, setStories] = useState([]);
  const [myDid, setMyDid] = useState('');
  const [seenIds, setSeenIds] = useState(new Set());
  const [startDid, setStartDid] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { liveByDid } = useLivePresence();
  const { user } = useAuth();
  const myDisplayName = user?.display_name || user?.full_name || 'You';
  const myAvatar = user?.avatar || '';

  const load = async (did) => {
    const cutoff = new Date().toISOString();
    // Parallelize the three independent fetches (Story, mutual friends, StoryView).
    const [active, follows, views] = await Promise.all([
      base44.entities.Story.filter({ expires_at: { $gte: cutoff } }, '-created_date', 100).catch(() => []),
      did ? followedDids(did) : Promise.resolve(new Set()),
      did ? base44.entities.StoryView.filter({ viewer_did: did }).catch(() => []) : Promise.resolve([]),
    ]);
    // Only show stories from collectors the user follows (plus their own).
    const visible = active.filter((s) => s.did === did || follows.has(s.did));
    setStories(visible);
    if (did) setSeenIds(new Set(views.map((v) => v.story_id)));
  };

  useEffect(() => {
    let active = true;
    const unsubs = [];
    (async () => {
      const { did } = await ensureUserDid().catch(() => ({ did: '' }));
      const me = await base44.auth.me().catch(() => null);
      const d = did || me?.did || '';
      if (active) setMyDid(d);
      await load(d);
      if (active) {
        unsubs.push(base44.entities.Story.subscribe(() => { if (active) load(d); }));
        unsubs.push(base44.entities.StoryView.subscribe(() => { if (active) load(d); }));
      }
    })();
    return () => { active = false; unsubs.forEach((u) => { try { u(); } catch {} }); };
  }, []);

  // Group active stories by author, preserving arrival order.
  const grouped = [];
  const seen = new Set();
  for (const s of stories) {
    if (s.did && !seen.has(s.did)) {
      seen.add(s.did);
      grouped.push({
        did: s.did,
        author_name: s.author_name,
        author_avatar: s.author_avatar,
        items: stories.filter((x) => x.did === s.did).sort((a, b) => (a.created_date || '').localeCompare(b.created_date || '')),
      });
    }
  }
  const hasMine = myDid && stories.some((s) => s.did === myDid);
  const others = grouped.filter((u) => u.did !== myDid);

  const ringFor = (u) => {
    // an author's story is "seen" only once every segment has been viewed
    const seenAll = u.items.length > 0 && u.items.every((it) => seenIds.has(it.id));
    return seenAll;
  };

  return (
    <div className="flex items-center gap-4 overflow-x-auto border-b border-border bg-card px-4 py-3">
      {/* Own slot is always first */}
      <button
        onClick={() => (hasMine ? setStartDid(myDid) : setCameraOpen(true))}
        className="flex shrink-0 flex-col items-center gap-1"
      >
        <div className="relative">
          {hasMine ? (
            <div className="rounded-full bg-gradient-to-tr from-[#6d4aff] to-[#8b5cf6] p-[3px]">
              <div className="rounded-full ring-2 ring-card"><Avatar name={myDisplayName} src={myAvatar} size={72} /></div>
            </div>
          ) : (
            <Avatar name={myDisplayName} src={myAvatar} size={72} />
          )}
          {!hasMine && (
            <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-white ring-2 ring-card">
              <Plus className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <span className="max-w-[72px] truncate text-[12px] font-medium text-foreground">Your story</span>
      </button>

      {others.map((u) => {
        const seenAll = ringFor(u);
        const liveInfo = u.did ? liveByDid.get(u.did) : null;
        return (
          <button key={u.did} onClick={() => setStartDid(u.did)} className="flex shrink-0 flex-col items-center gap-1">
            {liveInfo ? (
              <LiveAvatar did={u.did} name={u.author_name} src={u.author_avatar} size={72} />
            ) : seenAll ? (
              <div className="rounded-full p-[3px] bg-[#cbd5e1]">
                <div className="rounded-full ring-2 ring-card"><Avatar name={u.author_name} src={u.author_avatar} size={72} /></div>
              </div>
            ) : (
              <div className="rounded-full bg-gradient-to-tr from-[#6d4aff] to-[#8b5cf6] p-[3px]">
                <div className="rounded-full ring-2 ring-card"><Avatar name={u.author_name} src={u.author_avatar} size={72} /></div>
              </div>
            )}
            <span className={`max-w-[72px] truncate text-[12px] font-medium ${seenAll ? 'text-[#94a3b8]' : 'text-[#1e293b] dark:text-foreground'}`}>
              {u.author_name || 'Collector'}
            </span>
          </button>
        );
      })}

      {startDid && (
        <StoryViewer grouped={grouped} startDid={startDid} myDid={myDid} onClose={() => setStartDid(null)} onViewed={(d) => load(d)} />
      )}
      <StoryCamera open={cameraOpen} onClose={() => setCameraOpen(false)} onCreated={() => load(myDid)} myDid={myDid} />
    </div>
  );
}