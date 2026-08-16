import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, RefreshCw, SwitchCamera, Type, CreditCard, Loader2, Upload, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, generateRkey, NSID } from '@/lib/atproto';
import { bridgeStory } from '@/lib/federatedBridge';
import { cardImageUrl } from '@/lib/tcgdex';
import { useToast } from '@/components/ui/use-toast';
import CardSearchModal from '@/components/cards/CardSearchModal';

// Camera-first story composer (Instagram/Snapchat style). Opens the device
// camera, captures a photo, optionally adds a text overlay, and posts. Falls
// back to a file picker when the camera is unavailable (no HTTPS, denied
// permission, or desktop without webcam). Text-only and card-embed modes are
// available via the toolbar so all story types remain reachable.

const BG_COLORS = ['#6d4aff', '#10b981', '#fbbf24', '#ef4444', '#ec4899', '#1e293b'];
const POSITIONS = [
  { key: 'top', label: 'Top' },
  { key: 'center', label: 'Center' },
  { key: 'bottom', label: 'Bottom' },
];
const POS_CLASS = { top: 'items-start pt-20', center: 'items-center', bottom: 'items-end pb-28' };

export default function StoryCamera({ open, onClose, onCreated, myDid }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [facing, setFacing] = useState('user');
  const [capture, setCapture] = useState(null); // data: URL (camera) or http URL (upload)
  const [textOverlay, setTextOverlay] = useState('');
  const [textPosition, setTextPosition] = useState('center');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardSeg, setCardSeg] = useState(null);
  const [mode, setMode] = useState('camera'); // camera | text | card
  const [bgColor, setBgColor] = useState('#6d4aff');
  const [camError, setCamError] = useState(false);
  const { toast } = useToast();

  const stopStream = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open || mode !== 'camera' || capture) return;
    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamError(false);
      } catch {
        setCamError(true);
      }
    })();
    return () => { active = false; stopStream(); };
  }, [open, facing, mode, capture]);

  useEffect(() => () => stopStream(), []);

  if (!open) return null;

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapture(canvas.toDataURL('image/jpeg', 0.9));
    stopStream();
  };

  const retake = () => { setCapture(null); setTextOverlay(''); };

  const switchCamera = () => { stopStream(); setFacing((f) => (f === 'user' ? 'environment' : 'user')); };

  const onFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCapture(file_url);
      setMode('camera');
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const post = async () => {
    let finalSegs = [];
    setPosting(true);
    try {
      if (mode === 'camera' && capture) {
        let mediaUrl = capture;
        if (capture.startsWith('data:')) {
          const blob = await (await fetch(capture)).blob();
          const file = new File([blob], 'story.jpg', { type: 'image/jpeg' });
          const res = await base44.integrations.Core.UploadFile({ file });
          mediaUrl = res.file_url;
        }
        finalSegs = [{ order: 0, media_type: 'image', media_blob: mediaUrl, text_overlay: textOverlay, text_position: textPosition, duration: 5 }];
      } else if (mode === 'text') {
        if (!textOverlay.trim()) { setPosting(false); return; }
        finalSegs = [{ order: 0, media_type: 'text', text_overlay: textOverlay, text_position: textPosition, background_color: bgColor, duration: 5 }];
      } else if (mode === 'card' && cardSeg) {
        finalSegs = [{ ...cardSeg, order: 0, text_overlay: textOverlay, text_position: textPosition, duration: 5 }];
      }
      if (!finalSegs.length) { setPosting(false); return; }

      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me().catch(() => null);
      const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const story_group = generateRkey();
      const stamped = await stampRecord({
        segments: finalSegs, audience: 'friends', story_group, expires_at,
        author_name: me?.display_name || me?.full_name || '',
        author_handle: me?.username || me?.bsky_handle || '',
        author_avatar: me?.avatar || '', did,
      }, NSID.STORY, did, signingKey);
      const created = await base44.entities.Story.create(stamped);
      bridgeStory(stamped).then((res) => {
        if (res.bridged) base44.entities.Story.update(created.id, res).catch(() => {});
      }).catch(() => {});
      base44.functions.invoke('dispatchBellNotifications', {
        author_did: did, author_name: me?.display_name || me?.full_name || '', category: 'story',
        preview: finalSegs[0]?.text_overlay || 'Shared a story', url: '/',
      }).catch(() => {});
      setCapture(null); setTextOverlay(''); setCardSeg(null); setMode('camera');
      onCreated?.();
      onClose();
    } catch {
      toast({ title: 'Could not post story', variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const hasContent = mode === 'camera' ? capture : (mode === 'text' ? textOverlay.trim() : cardSeg);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between p-4">
        <button onClick={onClose} className="rounded-full bg-black/40 p-2 text-white backdrop-blur hover:bg-black/60">
          <X className="h-5 w-5" />
        </button>
        <div className="flex gap-2">
          <button onClick={() => { stopStream(); setMode('text'); setCapture(null); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur ${mode === 'text' ? 'bg-primary text-white' : 'bg-black/40 text-white'}`}>
            <Type className="inline h-3.5 w-3.5" /> Text
          </button>
          <button onClick={() => { stopStream(); setMode('card'); setCapture(null); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur ${mode === 'card' ? 'bg-primary text-white' : 'bg-black/40 text-white'}`}>
            <CreditCard className="inline h-3.5 w-3.5" /> Card
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex-1 overflow-hidden">
        {/* Camera mode */}
        {mode === 'camera' && !capture && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <Camera className="h-12 w-12 text-white/40" />
                <p className="text-sm text-white/70">Camera unavailable. You can upload a photo instead.</p>
                <button onClick={() => fileRef.current?.click()} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
                  <Upload className="mr-1.5 inline h-4 w-4" /> Choose photo
                </button>
              </div>
            )}
          </>
        )}

        {/* Capture preview */}
        {mode === 'camera' && capture && (
          <>
            <img src={capture} alt="" className="h-full w-full object-contain" />
            {textOverlay && (
              <div className={`absolute left-0 right-0 flex ${POS_CLASS[textPosition]} px-6`}>
                <p className="rounded-lg bg-black/60 px-3 py-2 text-center text-2xl font-bold text-white">{textOverlay}</p>
              </div>
            )}
          </>
        )}

        {/* Text mode */}
        {mode === 'text' && (
          <div className="flex h-full w-full items-center justify-center p-8" style={{ background: bgColor }}>
            <p className="text-center text-2xl font-bold text-white">{textOverlay || 'Type your story…'}</p>
          </div>
        )}

        {/* Card mode */}
        {mode === 'card' && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-slate-900 p-8">
            {cardSeg?.card_image && <img src={cardSeg.card_image} alt={cardSeg.card_name} className="max-h-[60%] rounded-xl object-contain" />}
            <p className="text-lg font-bold text-white">{cardSeg?.card_name || 'Embed a card'}</p>
            <button onClick={() => setCardOpen(true)} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white">
              <CreditCard className="mr-1.5 inline h-4 w-4" /> {cardSeg ? 'Change card' : 'Choose card'}
            </button>
          </div>
        )}
      </div>

      {/* Text overlay input + colour picker (shown for camera-captured and text modes) */}
      {((mode === 'camera' && capture) || mode === 'text') && (
        <div className="absolute bottom-28 left-0 right-0 z-30 px-4">
          {mode === 'text' && (
            <div className="mb-2 flex justify-center gap-2">
              {BG_COLORS.map((c) => (
                <button key={c} onClick={() => setBgColor(c)} className={`h-7 w-7 rounded-full ring-2 ${bgColor === c ? 'ring-white' : 'ring-transparent'}`} style={{ background: c }} />
              ))}
            </div>
          )}
          <input
            type="text"
            value={textOverlay}
            onChange={(e) => setTextOverlay(e.target.value.slice(0, 200))}
            placeholder="Add a caption…"
            maxLength={200}
            className="w-full rounded-full border border-white/30 bg-black/40 px-4 py-2.5 text-center text-sm text-white placeholder:text-white/50 outline-none backdrop-blur"
          />
          <div className="mt-2 flex justify-center gap-2">
            {POSITIONS.map((p) => (
              <button key={p.key} onClick={() => setTextPosition(p.key)} className={`rounded-full px-3 py-1 text-xs font-semibold ${textPosition === p.key ? 'bg-primary text-white' : 'bg-black/40 text-white/70'}`}>{p.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="relative z-30 flex items-center justify-center gap-6 px-6 pb-10 pt-4">
        {mode === 'camera' && !capture && !camError && (
          <>
            <button onClick={switchCamera} className="rounded-full bg-black/40 p-3 text-white backdrop-blur hover:bg-black/60" aria-label="Switch camera">
              <SwitchCamera className="h-5 w-5" />
            </button>
            <button onClick={takePhoto} className="h-18 w-18 rounded-full border-4 border-white p-1" aria-label="Take photo">
              <span className="block h-full w-full rounded-full bg-white" />
            </button>
            <button onClick={() => fileRef.current?.click()} className="rounded-full bg-black/40 p-3 text-white backdrop-blur hover:bg-black/60" aria-label="Upload photo">
              <Upload className="h-5 w-5" />
            </button>
          </>
        )}
        {mode === 'camera' && capture && (
          <>
            <button onClick={retake} className="rounded-full bg-black/40 p-3 text-white backdrop-blur hover:bg-black/60" aria-label="Retake">
              <RefreshCw className="h-5 w-5" />
            </button>
            <button onClick={post} disabled={posting} className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-white disabled:opacity-50" aria-label="Post story">
              {posting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              Post
            </button>
          </>
        )}
        {mode === 'text' && (
          <button onClick={post} disabled={posting || !textOverlay.trim()} className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-white disabled:opacity-50">
            {posting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Post
          </button>
        )}
        {mode === 'card' && (
          <button onClick={post} disabled={posting || !cardSeg} className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-white disabled:opacity-50">
            {posting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Post
          </button>
        )}
        {uploading && <Loader2 className="h-5 w-5 animate-spin text-white" />}
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFilePick} />

      <CardSearchModal
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        onSelect={(card) => {
          setCardSeg({ media_type: 'card', card_embed_uri: card.id, card_name: card.name, card_image: cardImageUrl(card.image) || '' });
          setCardOpen(false);
        }}
        title="Embed a card"
      />
    </div>
  );
}