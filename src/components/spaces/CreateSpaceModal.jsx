import React, { useState } from 'react';
import { X, Mic, CalendarClock, Disc3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

export default function CreateSpaceModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('live');
  const [scheduledAt, setScheduledAt] = useState('');
  const [tags, setTags] = useState('');
  const [recording, setRecording] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const payload = {
        title: title.trim(),
        description: description.trim(),
        status: mode === 'live' ? 'live' : 'scheduled',
        scheduled_at: mode === 'scheduled' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        recording_enabled: recording,
        max_listeners: 100,
        topic_tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5),
        host_name: user?.full_name || 'Collector',
        host_handle: user?.custom_handle || user?.username || user?.bsky_handle || 'collector',
        host_avatar: user?.avatar_url || '',
      };
      const stamped = await stampRecord(payload, NSID.VOICE_SPACE, did, signingKey);
      const space = await base44.entities.VoiceSpace.create(stamped);
      if (mode === 'live') {
        try { await base44.functions.invoke('provisionSpace', { space_id: space.id }); } catch (e) { /* non-fatal */ }
      }
      toast({ title: 'Voice Space created', description: mode === 'live' ? 'You are now live' : 'Scheduled - followers notified when you go live' });
      onCreated?.(space);
      onClose?.();
    } catch (e) {
      toast({ title: 'Could not create space', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Start a Voice Space</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Space title e.g. Vintage Card Market Talk" maxLength={120} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will you discuss?" maxLength={1000} rows={2} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <div className="flex gap-2">
            <button onClick={() => setMode('live')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${mode === 'live' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border bg-secondary'}`}><Mic className="h-4 w-4" /> Go Live Now</button>
            <button onClick={() => setMode('scheduled')} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${mode === 'scheduled' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary'}`}><CalendarClock className="h-4 w-4" /> Schedule</button>
          </div>
          {mode === 'scheduled' && (
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          )}
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Topics (comma separated) e.g. vintage, market, prerelease" className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <label className="flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm">
            <input type="checkbox" checked={recording} onChange={(e) => setRecording(e.target.checked)} className="accent-primary" />
            <Disc3 className="h-4 w-4 text-primary" /> Record & publish as podcast
          </label>
          <button onClick={submit} disabled={!title.trim() || busy} className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy ? 'Starting…' : mode === 'live' ? 'Go Live' : 'Schedule Space'}
          </button>
        </div>
      </div>
    </div>
  );
}