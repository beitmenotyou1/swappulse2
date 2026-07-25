import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';
import Avatar from '@/components/Avatar';

const GRADIENTS = {
  purple: 'linear-gradient(135deg, hsl(252 100% 64%), hsl(276 80% 50%))',
  sunset: 'linear-gradient(135deg, hsl(15 90% 55%), hsl(330 80% 55%))',
  ocean: 'linear-gradient(135deg, hsl(190 90% 50%), hsl(252 80% 55%))',
};
const DURATION = 5000;

export default function StoryViewer({ grouped, startDid, myDid, onClose, onViewed }) {
  const startIdx = Math.max(0, grouped.findIndex((u) => u.did === startDid));
  const [userIdx, setUserIdx] = useState(startIdx);
  const [itemIdx, setItemIdx] = useState(0);
  const [viewerDid, setViewerDid] = useState('');

  useEffect(() => {
    (async () => { try { const { did } = await ensureUserDid(); setViewerDid(did || myDid); } catch { /* ignore */ } })();
  }, [myDid]);

  const user = grouped[userIdx];
  const story = user?.items[itemIdx];

  const markViewed = async (s) => {
    if (!s || !viewerDid || (s.viewed_by || []).includes(viewerDid)) return;
    try {
      await base44.entities.Story.update(s.id, { viewed_by: [...(s.viewed_by || []), viewerDid] });
      onViewed?.();
    } catch { /* ignore */ }
  };

  useEffect(() => { if (story) markViewed(story); /* eslint-disable-next-line */ }, [story?.id, viewerDid]);

  const advance = () => {
    if (user && itemIdx < user.items.length - 1) setItemIdx(itemIdx + 1);
    else if (userIdx < grouped.length - 1) { setUserIdx(userIdx + 1); setItemIdx(0); }
    else onClose();
  };
  const back = () => {
    if (itemIdx > 0) setItemIdx(itemIdx - 1);
    else if (userIdx > 0) { setUserIdx(userIdx - 1); setItemIdx((grouped[userIdx - 1]?.items.length || 1) - 1); }
  };

  useEffect(() => {
    if (!story) return;
    const t = setTimeout(advance, DURATION);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [story?.id]);

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur" onClick={onClose}>
      <button className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); onClose(); }}>
        <X className="h-5 w-5" />
      </button>
      <div className="relative h-full max-h-[92vh] w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="absolute left-4 right-4 top-5 z-10 flex gap-1">
          {user.items.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className={`h-full bg-white transition-all ${i <= itemIdx ? 'w-full' : 'w-0'}`} />
            </div>
          ))}
        </div>
        <div className="absolute left-4 right-4 top-9 z-10 flex items-center gap-2">
          <Avatar name={user.author_name} src={user.author_avatar} size={28} />
          <span className="text-sm font-semibold text-white">{user.author_name || 'Collector'}</span>
        </div>

        <div className="flex h-full w-full items-center justify-center">
          {story.image_uri ? (
            <img src={story.image_uri} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-10" style={{ background: GRADIENTS[story.bg_gradient] || GRADIENTS.purple }}>
              <p className="whitespace-pre-wrap text-center text-xl font-bold text-white">{story.content}</p>
            </div>
          )}
        </div>

        <button className="absolute left-0 top-0 h-full w-1/3" onClick={back} aria-label="Previous" />
        <button className="absolute right-0 top-0 h-full w-1/3" onClick={advance} aria-label="Next" />
      </div>
    </div>
  );
}