import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Eye, Volume2, VolumeX, Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { startOrFindConversation, sendDirectMessage } from '@/lib/dmBridge';
import { useToast } from '@/components/ui/use-toast';
import Avatar from '@/components/Avatar';

// Story reactions reuse the Alpha 1.2 reaction record with a subset of types.
const STORY_REACTIONS = {
  insane_pull: { emoji: '🔥', label: 'Insane Pull' },
  jealous: { emoji: '😏', label: 'Jealous' },
  congrats: { emoji: '🎉', label: 'Congrats' },
  wow: { emoji: '🤯', label: 'Wow' },
  trade_interest: { emoji: '🤝', label: 'Trade Interest' },
};
const DEFAULT_DURATION = 5;
const GRADIENTS = {
  purple: 'linear-gradient(135deg, hsl(252 100% 64%), hsl(276 80% 50%))',
  sunset: 'linear-gradient(135deg, hsl(15 90% 55%), hsl(330 80% 55%))',
  ocean: 'linear-gradient(135deg, hsl(190 90% 50%), hsl(252 80% 55%))',
};
const POS_CLASS = { top: 'items-start pt-16', center: 'items-center', bottom: 'items-end pb-24' };

function segmentsOf(story) {
  if (Array.isArray(story?.segments) && story.segments.length) return story.segments;
  // Legacy single-segment stories.
  return [{
    media_type: story?.image_uri ? 'image' : 'text',
    media_blob: story?.image_uri || '',
    text_overlay: story?.content || '',
    background_color: story?.bg_gradient || 'purple',
    text_position: 'center',
    duration: DEFAULT_DURATION,
  }];
}

function segDuration(seg) {
  if (seg.media_type === 'video') return 15;
  return Math.min(15, Math.max(3, seg.duration || DEFAULT_DURATION));
}

export default function StoryViewer({ grouped, startDid, myDid, onClose, onViewed }) {
  const startUser = Math.max(0, grouped.findIndex((u) => u.did === startDid));
  const [userIdx, setUserIdx] = useState(startUser);
  const [storyIdx, setStoryIdx] = useState(0);
  const [segIdx, setSegIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [showSeenBy, setShowSeenBy] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [viewerDid, setViewerDid] = useState('');
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const dragStartY = useRef(null);
  const videoRef = useRef(null);
  const viewedRef = useRef(new Set());
  const { toast } = useToast();

  const user = grouped[userIdx];
  const stories = user?.items || [];
  const story = stories[storyIdx];
  const segs = story ? segmentsOf(story) : [];
  const seg = segs[segIdx];
  const isOwn = story?.did === myDid;

  useEffect(() => {
    (async () => { try { const { did } = await ensureUserDid(); setViewerDid(did || myDid || ''); } catch { /* ignore */ } })();
  }, [myDid]);

  const markViewed = useCallback(async (s) => {
    if (!s || !viewerDid || viewedRef.current.has(s.id)) return;
    viewedRef.current.add(s.id);
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me().catch(() => null);
      const stamped = await stampRecord({
        story_id: s.id,
        story_ref: s.at_uri || `at://${did}/${NSID.STORY}/${s.id}`,
        viewer_did: did,
        viewer_name: me?.full_name || '',
        viewer_handle: me?.email?.split('@')[0] || '',
        viewer_avatar: '',
        viewed_at: new Date().toISOString(),
      }, NSID.STORY_VIEW, did, signingKey);
      await base44.entities.StoryView.create(stamped);
      onViewed?.(did);
    } catch { /* ignore */ }
  }, [viewerDid, onViewed]);

  useEffect(() => { if (story) markViewed(story); }, [story?.id, markViewed]);

  // Navigate at the segment level: segment → next story → next user → close.
  const advance = useCallback(() => {
    const u = grouped[userIdx];
    const items = u?.items || [];
    const curSegs = items[storyIdx] ? segmentsOf(items[storyIdx]) : [];
    if (segIdx < curSegs.length - 1) { setProgress(0); setSegIdx(segIdx + 1); return; }
    if (storyIdx < items.length - 1) { setProgress(0); setStoryIdx(storyIdx + 1); setSegIdx(0); return; }
    if (userIdx < grouped.length - 1) { setProgress(0); setUserIdx(userIdx + 1); setStoryIdx(0); setSegIdx(0); return; }
    onClose();
  }, [segIdx, storyIdx, userIdx, grouped, onClose]);

  const back = useCallback(() => {
    if (segIdx > 0) { setProgress(0); setSegIdx(segIdx - 1); return; }
    if (storyIdx > 0) { const prev = segmentsOf(grouped[userIdx].items[storyIdx - 1]); setProgress(0); setStoryIdx(storyIdx - 1); setSegIdx(Math.max(0, prev.length - 1)); return; }
    if (userIdx > 0) { const pu = grouped[userIdx - 1]; const prevStory = pu.items[pu.items.length - 1]; setProgress(0); setUserIdx(userIdx - 1); setStoryIdx(Math.max(0, pu.items.length - 1)); setSegIdx(Math.max(0, segmentsOf(prevStory).length - 1)); }
  }, [segIdx, storyIdx, userIdx, grouped]);

  // Progress timer for the current segment.
  useEffect(() => {
    if (!story || paused) return;
    const total = segDuration(seg) * 1000;
    const step = 50;
    let elapsed = progress * total;
    const id = setInterval(() => {
      elapsed += step;
      setProgress(Math.min(1, elapsed / total));
      if (elapsed >= total) { clearInterval(id); advance(); }
    }, step);
    return () => clearInterval(id);
    /* eslint-disable-next-line */
  }, [story?.id, segIdx, paused]);

  // Video element controls follow pause/mute state.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause(); else v.play().catch(() => {});
    v.muted = muted;
  }, [paused, muted, story?.id, segIdx]);

  const sendReaction = async (type) => {
    if (!story) return;
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me().catch(() => null);
      const stamped = await stampRecord({
        subject: story.at_uri || `at://did:web:swappulse.org/${NSID.STORY}/${story.id}`,
        post_id: story.id,
        reaction_type: type,
        reactor_name: me?.full_name || '',
        reactor_handle: me?.email?.split('@')[0] || '',
      }, NSID.REACTION, did, signingKey);
      await base44.entities.Reaction.create(stamped);
      toast({ title: `Sent @${story.author_handle || story.author_name || 'collector'} a reaction`, description: STORY_REACTIONS[type].label });
    } catch { /* ignore */ }
  };

  const sendReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !story?.did || isOwn) return;
    setSendingReply(true);
    try {
      const me = await base44.auth.me().catch(() => null);
      const convo = await startOrFindConversation(story.did, story.author_name, story.author_handle, story.author_avatar);
      await sendDirectMessage(convo, trimmed, me);
      toast({ title: `Replied to @${story.author_handle || story.author_name || 'collector'}` });
      setReplyText('');
    } catch {
      toast({ title: 'Reply failed', variant: 'destructive' });
    } finally {
      setSendingReply(false);
    }
  };

  const loadViewers = async () => {
    if (!story) return;
    const v = await base44.entities.StoryView.filter({ story_id: story.id }, '-viewed_at', 200).catch(() => []);
    setViewers(v);
  };

  useEffect(() => { if (showSeenBy) loadViewers(); /* eslint-disable-next-line */ }, [showSeenBy, story?.id]);

  const onPointerDown = (e) => { dragStartY.current = e.clientY; };
  const onPointerUp = (e) => {
    if (dragStartY.current == null) return;
    if (e.clientY - dragStartY.current > 70) onClose();
    dragStartY.current = null;
  };

  if (!story) return null;
  const isVideo = seg.media_type === 'video' && seg.media_blob;
  const isImage = seg.media_type === 'image' && seg.media_blob;
  const isCard = seg.media_type === 'card';
  const bg = seg.background_color;
  const bgStyle = bg && bg.startsWith('#') ? { background: bg } : { background: GRADIENTS[bg] || GRADIENTS.purple };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="relative h-[736px] max-h-screen w-[414px] max-w-full overflow-hidden bg-black">
        {/* Progress segments for the current story */}
        <div className="absolute left-3 right-3 top-3 z-30 flex gap-1.5">
          {segs.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/40">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
                style={{ width: i < segIdx ? '100%' : i === segIdx ? `${progress * 100}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Author header */}
        <div className="absolute left-3 right-3 top-7 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar name={user?.author_name} src={user?.author_avatar} size={32} />
            <span className="text-sm font-semibold text-white">{user?.author_name || 'Collector'}</span>
          </div>
          <button className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segment render */}
        <div className="absolute inset-0 flex flex-col items-stretch justify-center" style={!isImage && !isVideo && !isCard ? bgStyle : {}}>
          {isImage && <img src={seg.media_blob} alt="" className="h-full w-full object-contain" />}
          {isVideo && (
            <video ref={videoRef} src={seg.media_blob} className="h-full w-full object-contain" autoPlay muted={muted} playsInline loop />
          )}
          {isCard && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-900 p-6">
              {seg.card_image && <img src={seg.card_image} alt={seg.card_name} className="max-h-[60%] rounded-xl object-contain" />}
              <p className="text-center text-base font-bold text-white">{seg.card_name || 'Embedded card'}</p>
            </div>
          )}
          {seg.text_overlay && (
            <div className={`absolute left-0 right-0 flex ${POS_CLASS[seg.text_position || 'center']} px-6`}>
              <div className="rounded-lg bg-black/60 px-3 py-2">
                <p className="text-[24px] font-bold leading-tight text-white">{seg.text_overlay}</p>
              </div>
            </div>
          )}
        </div>

        {/* Mute toggle for video */}
        {isVideo && (
          <button className="absolute bottom-36 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/50 p-2 text-white" onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        )}

        {/* Tap zones: left=prev, right=next, hold anywhere to pause */}
        <div className="absolute inset-0 z-20 flex">
          <button
            className="h-full flex-1"
            onClick={back}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerCancel={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
            aria-label="Previous"
          />
          <button
            className="h-full flex-[2]"
            onClick={advance}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerCancel={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
            aria-label="Next"
          />
        </div>

        {/* Reply bar + quick reactions */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-6" onClick={(e) => e.stopPropagation()}>
          {!isOwn && (
            <div className="mb-3 flex justify-center gap-2">
              {Object.entries(STORY_REACTIONS).map(([type, r]) => (
                <button key={type} onClick={() => sendReaction(type)} title={r.label} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-black/40 text-base backdrop-blur transition hover:bg-primary/80">
                  <span>{r.emoji}</span>
                </button>
              ))}
            </div>
          )}
          {isOwn ? (
            <p className="text-center text-xs text-white/60">Your story</p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder={`Reply to @${story.author_handle || story.author_name || 'collector'}…`}
                className="flex-1 rounded-full border border-white/30 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/60 outline-none backdrop-blur"
              />
              <button
                onClick={sendReply}
                disabled={sendingReply || !replyText.trim()}
                className="rounded-full bg-primary p-2.5 text-white disabled:opacity-50"
                aria-label="Send reply"
              >
                {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>

        {/* Seen-by toggle for own stories */}
        {isOwn && (
          <button className="absolute bottom-20 right-4 z-30 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white" onClick={(e) => { e.stopPropagation(); setShowSeenBy((v) => !v); }}>
            <Eye className="h-4 w-4" /> {viewers.length || 'Views'}
          </button>
        )}

        {/* Seen-by panel */}
        {isOwn && showSeenBy && (
          <div className="absolute bottom-0 left-0 right-0 z-40 max-h-[60%] animate-slide-up overflow-y-auto rounded-t-2xl bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">{viewers.length} views</p>
              <button onClick={() => setShowSeenBy(false)} className="rounded-full p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            {viewers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No views yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {viewers.map((v) => (
                  <li key={v.id} className="flex items-center gap-3">
                    <Avatar name={v.viewer_name} src={v.viewer_avatar} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{v.viewer_name || 'Collector'}</p>
                      <p className="text-xs text-muted-foreground">{new Date(v.viewed_at).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}