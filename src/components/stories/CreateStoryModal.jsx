import React, { useState } from 'react';
import { X, Loader2, Image as ImageIcon, Type } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid } from '@/lib/atproto';

const GRADIENTS = [
  { key: 'purple', css: 'linear-gradient(135deg, hsl(252 100% 64%), hsl(276 80% 50%))' },
  { key: 'sunset', css: 'linear-gradient(135deg, hsl(15 90% 55%), hsl(330 80% 55%))' },
  { key: 'ocean', css: 'linear-gradient(135deg, hsl(190 90% 50%), hsl(252 80% 55%))' },
];

export default function CreateStoryModal({ open, onClose, onCreated, myDid }) {
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [gradient, setGradient] = useState('purple');
  const [image, setImage] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (mode === 'text' && !text.trim()) return;
    if (mode === 'image' && !image) return;
    setSaving(true);
    try {
      const did = myDid || (await ensureUserDid().then((r) => r.did).catch(() => ''));
      const me = await base44.auth.me().catch(() => null);
      const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await base44.entities.Story.create({
        content: mode === 'text' ? text.trim() : '',
        image_uri: mode === 'image' ? image : '',
        bg_gradient: gradient,
        expires_at,
        viewed_by: [],
        author_name: me?.full_name || '',
        author_handle: (me?.email || '').split('@')[0],
        author_avatar: '',
        did,
      });
      base44.functions.invoke('dispatchBellNotifications', {
        author_did: did, author_name: me?.full_name || '', category: 'story',
        preview: mode === 'text' ? text.trim() : 'Shared a story', url: '/',
      }).catch(() => {});
      setText(''); setImage(''); setGradient('purple'); setMode('text');
      onCreated?.();
      onClose();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const upload = async (file) => {
    setSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImage(file_url);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const field = 'w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md animate-slide-up rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Share a story</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-3 flex gap-2">
          <button onClick={() => setMode('text')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${mode === 'text' ? 'bg-primary text-white' : 'bg-secondary'}`}><Type className="h-4 w-4" /> Text</button>
          <button onClick={() => setMode('image')} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold ${mode === 'image' ? 'bg-primary text-white' : 'bg-secondary'}`}><ImageIcon className="h-4 w-4" /> Image</button>
        </div>

        {mode === 'text' ? (
          <>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={280} placeholder="Share a fleeting moment…" className={`resize-none ${field}`} />
            <div className="mt-3 flex gap-2">
              {GRADIENTS.map((g) => (
                <button key={g.key} onClick={() => setGradient(g.key)} className={`h-8 w-8 rounded-full ring-2 ${gradient === g.key ? 'ring-foreground' : 'ring-transparent'}`} style={{ background: g.css }} />
              ))}
            </div>
          </>
        ) : (
          <label className="block cursor-pointer rounded-xl border border-dashed border-border bg-secondary p-6 text-center text-sm text-muted-foreground">
            {image ? 'Image selected ✓' : 'Tap to upload an image'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        )}

        <button onClick={submit} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Share story
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Stories disappear after 24 hours.</p>
      </div>
    </div>
  );
}