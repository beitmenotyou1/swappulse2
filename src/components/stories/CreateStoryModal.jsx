import React, { useState } from 'react';
import { X, Loader2, Image as ImageIcon, Type, CreditCard, Trash2, Plus, Globe, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, generateRkey, NSID } from '@/lib/atproto';
import { cardImageUrl } from '@/lib/tcgdex';
import CardSearchModal from '@/components/cards/CardSearchModal';

const COLORS = ['#6d4aff', '#10b981', '#fbbf24', '#ef4444', '#ec4899', '#1e293b'];
const POSITIONS = [
  { key: 'top', label: 'Top' },
  { key: 'center', label: 'Center' },
  { key: 'bottom', label: 'Bottom' },
];

const emptySeg = () => ({
  media_type: 'text',
  media_blob: '',
  text_overlay: '',
  text_position: 'center',
  background_color: '#6d4aff',
  card_embed_uri: '',
  card_name: '',
  card_image: '',
  duration: 5,
});

export default function CreateStoryModal({ open, onClose, onCreated, myDid }) {
  const [segments, setSegments] = useState([]);
  const [seg, setSeg] = useState(emptySeg());
  const [audience, setAudience] = useState('friends');
  const [saving, setSaving] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  if (!open) return null;

  const upload = async (file, isVideo) => {
    setSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSeg((s) => ({ ...s, media_blob: file_url, media_type: isVideo ? 'video' : 'image', duration: isVideo ? 15 : 5 }));
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const addSegment = () => {
    if (seg.media_type === 'text' && !seg.text_overlay.trim()) return;
    if ((seg.media_type === 'image' || seg.media_type === 'video') && !seg.media_blob) return;
    if (seg.media_type === 'card' && !seg.card_embed_uri) return;
    setSegments((prev) => [...prev, { ...seg, order: prev.length }]);
    setSeg(emptySeg());
  };

  const removeSegment = (i) => setSegments((prev) => prev.filter((_, idx) => idx !== i));

  const publish = async () => {
    const finalSegs = segments.length ? segments : (seg.media_type === 'text' && seg.text_overlay.trim() ? [{ ...seg, order: 0 }] : []);
    if (!finalSegs.length) return;
    setSaving(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const me = await base44.auth.me().catch(() => null);
      const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const story_group = generateRkey();
      const stamped = await stampRecord({
        segments: finalSegs,
        audience,
        story_group,
        expires_at,
        author_name: me?.full_name || '',
        author_handle: me?.email?.split('@')[0] || '',
        author_avatar: '',
        did,
      }, NSID.STORY, did, signingKey);
      await base44.entities.Story.create(stamped);
      base44.functions.invoke('dispatchBellNotifications', {
        author_did: did, author_name: me?.full_name || '', category: 'story',
        preview: finalSegs[0]?.text_overlay || 'Shared a story', url: '/',
      }).catch(() => {});
      setSegments([]); setSeg(emptySeg()); setAudience('friends');
      onCreated?.();
      onClose();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const input = 'w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md animate-slide-up rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Compose story</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {/* Preview */}
        <div className="relative mb-3 flex h-56 w-full items-center justify-center overflow-hidden rounded-xl bg-black">
          {seg.media_type === 'image' && seg.media_blob && (
            <img src={seg.media_blob} alt="" className="h-full w-full object-contain" />
          )}
          {seg.media_type === 'video' && seg.media_blob && (
            <video src={seg.media_blob} className="h-full w-full object-contain" muted autoPlay loop playsInline />
          )}
          {seg.media_type === 'card' && (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900 p-4">
              {seg.card_image && <img src={seg.card_image} alt={seg.card_name} className="max-h-[70%] rounded-lg object-contain" />}
              <p className="text-sm font-bold text-white">{seg.card_name || 'Card'}</p>
            </div>
          )}
          {seg.media_type === 'text' && (
            <div className="flex h-full w-full items-center justify-center p-6" style={{ background: seg.background_color }}>
              <p className="text-center text-lg font-bold text-white">{seg.text_overlay || 'Text overlay preview'}</p>
            </div>
          )}
          {seg.text_overlay && seg.media_type !== 'text' && (
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/60 px-3 py-2">
              <p className="text-sm font-bold text-white">{seg.text_overlay}</p>
            </div>
          )}
        </div>

        {/* Media type picker */}
        <div className="mb-3 flex gap-2">
          <button onClick={() => setSeg((s) => ({ ...s, media_type: 'text', media_blob: '' }))} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${seg.media_type === 'text' ? 'bg-primary text-white' : 'bg-secondary'}`}><Type className="h-4 w-4" /> Text</button>
          <label className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${seg.media_type === 'image' || seg.media_type === 'video' ? 'bg-primary text-white' : 'bg-secondary'}`}>
            <ImageIcon className="h-4 w-4" /> Photo / Video
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, f.type.startsWith('video/')); }} />
          </label>
          <button onClick={() => setCardOpen(true)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${seg.media_type === 'card' ? 'bg-primary text-white' : 'bg-secondary'}`}><CreditCard className="h-4 w-4" /> Card</button>
        </div>

        {/* Text overlay */}
        {seg.media_type === 'text' && (
          <div className="mb-3 flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setSeg((s) => ({ ...s, background_color: c }))} className={`h-7 w-7 rounded-full ring-2 ${seg.background_color === c ? 'ring-foreground' : 'ring-transparent'}`} style={{ background: c }} />
            ))}
          </div>
        )}
        <textarea
          value={seg.text_overlay}
          onChange={(e) => setSeg((s) => ({ ...s, text_overlay: e.target.value.slice(0, 200) }))}
          rows={2}
          maxLength={200}
          placeholder="Add a text overlay…"
          className={`mb-2 resize-none ${input}`}
        />
        <div className="mb-3 flex gap-2">
          {POSITIONS.map((p) => (
            <button key={p.key} onClick={() => setSeg((s) => ({ ...s, text_position: p.key }))} className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${seg.text_position === p.key ? 'bg-primary text-white' : 'bg-secondary'}`}>{p.label}</button>
          ))}
        </div>

        <button onClick={addSegment} className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-border py-2 text-sm font-semibold text-primary hover:bg-secondary">
          <Plus className="h-4 w-4" /> Add segment ({segments.length})
        </button>

        {/* Added segments tray */}
        {segments.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {segments.map((s, i) => (
              <div key={i} className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-900">
                {s.media_blob && <img src={s.media_blob} alt="" className="h-full w-full object-cover" />}
                {s.media_type === 'card' && s.card_image && <img src={s.card_image} alt="" className="h-full w-full object-cover" />}
                {s.media_type === 'text' && <div className="h-full w-full" style={{ background: s.background_color }} />}
                <button onClick={() => removeSegment(i)} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Audience selector */}
        <div className="mb-4 flex gap-2">
          <button onClick={() => setAudience('friends')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${audience === 'friends' ? 'bg-primary text-white' : 'bg-secondary'}`}><Users className="h-4 w-4" /> Friends</button>
          <button onClick={() => setAudience('public')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${audience === 'public' ? 'bg-primary text-white' : 'bg-secondary'}`}><Globe className="h-4 w-4" /> Public</button>
        </div>

        <button onClick={publish} disabled={saving} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Post Story
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Stories disappear after 24 hours from your public feed. They are removed from your repository automatically.</p>
      </div>

      <CardSearchModal
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        onSelect={(card) => {
          setSeg((s) => ({ ...s, media_type: 'card', card_embed_uri: card.id, card_name: card.name, card_image: cardImageUrl(card.image) || '', media_blob: '' }));
          setCardOpen(false);
        }}
        title="Embed a card"
      />
    </div>
  );
}