import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import Avatar from '@/components/Avatar';
import StoryViewer from './StoryViewer';
import CreateStoryModal from './CreateStoryModal';

export default function StoriesBar() {
  const [stories, setStories] = useState([]);
  const [myDid, setMyDid] = useState('');
  const [startDid, setStartDid] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    try {
      const cutoff = new Date().toISOString();
      setStories(await base44.entities.Story.filter({ expires_at: { $gte: cutoff } }, '-created_date', 100));
    } catch {
      setStories([]);
    }
  };

  useEffect(() => {
    let active = true;
    let stopSub = () => {};
    (async () => {
      try { const { did } = await ensureUserDid(); if (active) setMyDid(did); } catch { /* ignore */ }
      await load();
      if (active) stopSub = base44.entities.Story.subscribe(() => load());
    })();
    return () => { active = false; stopSub(); };
  }, []);

  // Group active stories by author (preserve arrival order).
  const grouped = [];
  const seen = new Set();
  for (const s of stories) {
    if (s.did && !seen.has(s.did)) {
      seen.add(s.did);
      grouped.push({
        did: s.did,
        author_name: s.author_name,
        author_avatar: s.author_avatar,
        items: stories.filter((x) => x.did === s.did),
      });
    }
  }
  const hasMine = myDid && stories.some((s) => s.did === myDid);

  return (
    <div className="flex items-center gap-4 overflow-x-auto border-b border-border bg-card px-4 py-3">
      <button
        onClick={() => (hasMine ? setStartDid(myDid) : setCreateOpen(true))}
        className="flex shrink-0 flex-col items-center gap-1"
      >
        <div className="relative">
          <Avatar name="You" size={56} />
          {!hasMine && (
            <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-white ring-2 ring-card">
              <Plus className="h-3 w-3" />
            </span>
          )}
        </div>
        <span className="text-[11px] font-medium">Your story</span>
      </button>

      {grouped.filter((u) => u.did !== myDid).map((u) => (
        <button key={u.did} onClick={() => setStartDid(u.did)} className="flex shrink-0 flex-col items-center gap-1">
          <div className="rounded-full bg-gradient-to-tr from-primary to-accent p-0.5">
            <div className="rounded-full ring-2 ring-card"><Avatar name={u.author_name} src={u.author_avatar} size={54} /></div>
          </div>
          <span className="max-w-[64px] truncate text-[11px] font-medium">{u.author_name || 'Collector'}</span>
        </button>
      ))}

      {startDid && (
        <StoryViewer grouped={grouped} startDid={startDid} myDid={myDid} onClose={() => setStartDid(null)} onViewed={load} />
      )}
      <CreateStoryModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} myDid={myDid} />
    </div>
  );
}