import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, Download, Scissors, Plus, Trash2, UploadCloud, Rss } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { updateBridgedRecord } from '@/lib/atprotoRecords';
import { useToast } from '@/components/ui/use-toast';

function parseTs(str) {
  const parts = String(str || '').split(':').map((n) => Number(n) || 0);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
function fmtTs(s) {
  s = Math.max(0, Math.round(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

// Podcast editor — post-recording metadata + cover + chapter editing, start/end
// audio trimming (decoded + re-encoded in-browser), download to device, and
// save. Re-bridges the updated episode to the PDS so the RSS feed reflects it.
export default function PodcastEditorModal({ episode, onClose, onSaved }) {
  const { toast } = useToast();
  const [title, setTitle] = useState(episode?.title || '');
  const [description, setDescription] = useState(episode?.description || '');
  const [showNotes, setShowNotes] = useState(episode?.show_notes || '');
  const [tags, setTags] = useState(episode?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [chapters, setChapters] = useState(
    (episode?.chapter_marks?.length ? episode.chapter_marks : []).map((c) => ({
      ts: fmtTs(c.timestamp_seconds || 0),
      title: c.title || '',
      card: c.card_uri || '',
    })),
  );
  const [coverFile, setCoverFile] = useState(null);
  const [coverUrl, setCoverUrl] = useState(episode?.cover_image_url || '');
  const [trimStart, setTrimStart] = useState(episode?.trim_start_seconds || 0);
  const [trimEnd, setTrimEnd] = useState(episode?.trim_end_seconds || episode?.duration_seconds || 0);
  const [duration, setDuration] = useState(episode?.duration_seconds || 0);
  const [busy, setBusy] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const coverInput = useRef(null);

  useEffect(() => {
    // Probe the audio duration if missing so the trim sliders are accurate.
    if (episode?.audio_url && !duration) {
      const a = new Audio();
      a.src = episode.audio_url;
      a.onloadedmetadata = () => {
        if (Number.isFinite(a.duration) && a.duration > 0) {
          setDuration(Math.round(a.duration));
          setTrimEnd((te) => te || Math.round(a.duration));
        }
      };
    }
  }, [episode?.audio_url, duration]);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').slice(0, 30);
    if (!t || tags.includes(t) || tags.length >= 10) { setTagInput(''); return; }
    setTags((arr) => [...arr, t]);
    setTagInput('');
  };

  const applyTrim = async () => {
    if (trimming) return;
    const start = Math.max(0, Math.min(trimStart, duration));
    const end = Math.max(start + 1, Math.min(trimEnd, duration));
    if (end - start < 1) { toast({ title: 'Trim too short', variant: 'destructive' }); return; }
    setTrimming(true);
    try {
      // Fetch + decode the source audio.
      const resp = await fetch(episode.audio_url);
      const buf = await resp.arrayBuffer();
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const decodeCtx = new Ctx();
      const audioBuffer = await decodeCtx.decodeAudioData(buf);
      decodeCtx.close();

      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(start * sampleRate);
      const endSample = Math.min(Math.floor(end * sampleRate), audioBuffer.length);
      const frameCount = endSample - startSample;
      const trimmed = decodeCtx.createBuffer(audioBuffer.numberOfChannels, frameCount, sampleRate);
      // Reuse a fresh context for rendering.
      const renderCtx = new Ctx();
      const trimmedBuffer = renderCtx.createBuffer(audioBuffer.numberOfChannels, frameCount, sampleRate);
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const src = audioBuffer.getChannelData(ch).subarray(startSample, endSample);
        trimmedBuffer.copyToChannel(src, ch);
      }

      // Render trimmed buffer through a MediaStreamDestination + MediaRecorder.
      const src = renderCtx.createBufferSource();
      src.buffer = trimmedBuffer;
      const dest = renderCtx.createMediaStreamDestination();
      src.connect(dest);
      const rec = new MediaRecorder(dest.stream);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res) => { rec.onstop = res; });
      src.start();
      rec.start();
      await stopped;
      const blob = new Blob(chunks, { type: 'audio/webm' });
      renderCtx.close();

      if (blob.size === 0) { toast({ title: 'Trim failed', variant: 'destructive' }); return; }
      const file = new File([blob], `episode-${episode.id}-trimmed.webm`, { type: 'audio/webm' });
      const up = await base44.integrations.Core.UploadFile({ file });
      const newDuration = Math.max(1, Math.round(end - start));
      const original = episode.original_audio_url || episode.audio_url;
      await base44.entities.PodcastEpisode.update(episode.id, {
        audio_url: up.file_url,
        duration_seconds: newDuration,
        original_audio_url: original,
        trim_start_seconds: start,
        trim_end_seconds: end,
      });
      if (episode.bridged && episode.at_uri) {
        updateBridgedRecord({ id: episode.id, at_uri: episode.at_uri, bridged: true }, 'PodcastEpisode').then((res) => {
          if (res?.cid) base44.entities.PodcastEpisode.update(episode.id, { cid: res.cid, content_hash: res.content_hash || '' }).catch(() => {});
        }).catch(() => {});
      }
      setDuration(newDuration);
      setTrimStart(0);
      setTrimEnd(newDuration);
      toast({ title: 'Audio trimmed', description: `Saved ${fmtTs(newDuration)} of audio.` });
    } catch (e) {
      console.error('trim failed', e);
      toast({ title: 'Could not trim audio', description: e.message, variant: 'destructive' });
    } finally {
      setTrimming(false);
    }
  };

  const downloadAudio = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const resp = await fetch(episode.audio_url);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(episode.title || 'episode').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: 'Download failed', description: e.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let finalCover = coverUrl;
      if (coverFile) {
        try {
          const r = await base44.integrations.Core.UploadFile({ file: coverFile });
          finalCover = r.file_url;
        } catch { /* cover optional */ }
      }
      const chapterMarks = chapters
        .filter((c) => c.title.trim())
        .map((c) => ({
          timestamp_seconds: parseTs(c.ts),
          title: c.title.trim().slice(0, 100),
          ...(c.card.trim() ? { card_uri: c.card.trim() } : {}),
        }))
        .filter((c) => Number.isFinite(c.timestamp_seconds) && c.timestamp_seconds >= 0);

      const patch = {
        title: title.trim(),
        description: description.trim().slice(0, 2000),
        show_notes: showNotes.trim().slice(0, 5000),
        tags,
        chapter_marks: chapterMarks,
        cover_image_url: finalCover,
      };
      await base44.entities.PodcastEpisode.update(episode.id, patch);
      // Re-bridge so the PDS record + RSS feed reflect the edits.
      if (episode.bridged && episode.at_uri) {
        updateBridgedRecord({ id: episode.id, at_uri: episode.at_uri, bridged: true }, 'PodcastEpisode').then((res) => {
          if (res?.cid) base44.entities.PodcastEpisode.update(episode.id, { cid: res.cid, content_hash: res.content_hash || '' }).catch(() => {});
        }).catch(() => {});
      }
      toast({ title: 'Episode updated' });
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const rssUrl = `${window.location.origin}/api/functions/podcast-rss-feed?did=${encodeURIComponent(episode.did || '')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Episode</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Show notes</label>
            <textarea value={showNotes} onChange={(e) => setShowNotes(e.target.value)} maxLength={5000} rows={3} className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary" />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tags (up to 10)</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs">
                  #{t}
                  <button onClick={() => setTags((arr) => arr.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag"
                maxLength={30}
                className="w-24 rounded-full border border-border bg-secondary px-2 py-1 text-xs outline-none focus:border-primary"
              />
              <button onClick={addTag} className="rounded-full p-1 text-muted-foreground hover:text-primary"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          {/* Cover */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cover image</label>
            <div onClick={() => coverInput.current?.click()} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/50 p-3 hover:border-primary">
              <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setCoverFile(f); setCoverUrl(URL.createObjectURL(f)); } }} />
              {coverUrl ? (
                <img src={coverUrl} alt="cover" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-secondary"><UploadCloud className="h-5 w-5 text-muted-foreground" /></div>
              )}
              <span className="text-xs text-muted-foreground">{coverFile ? coverFile.name : 'Tap to upload cover'}</span>
            </div>
          </div>

          {/* Chapters */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">Chapter marks</label>
              <button onClick={() => setChapters((c) => [...c, { ts: '00:00', title: '', card: '' }])} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {chapters.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={c.ts} onChange={(e) => setChapters((arr) => arr.map((x, j) => (j === i ? { ...x, ts: e.target.value } : x)))} placeholder="mm:ss" className="w-16 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs outline-none focus:border-primary" />
                  <input value={c.title} onChange={(e) => setChapters((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Chapter title" maxLength={100} className="flex-1 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs outline-none focus:border-primary" />
                  <button onClick={() => setChapters((arr) => arr.filter((_, j) => j !== i))} className="rounded-md p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {chapters.length === 0 && <p className="text-xs text-muted-foreground">No chapters yet.</p>}
            </div>
          </div>

          {/* Trim */}
          <div className="rounded-xl border border-border bg-secondary p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Scissors className="h-3.5 w-3.5" /> Trim audio</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-10 text-muted-foreground">Start</span>
                <input type="range" min={0} max={duration || 1} value={trimStart} onChange={(e) => setTrimStart(Number(e.target.value))} className="flex-1 accent-primary" />
                <span className="w-12 font-mono text-right">{fmtTs(trimStart)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-10 text-muted-foreground">End</span>
                <input type="range" min={1} max={duration || 1} value={trimEnd} onChange={(e) => setTrimEnd(Number(e.target.value))} className="flex-1 accent-primary" />
                <span className="w-12 font-mono text-right">{fmtTs(trimEnd)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Trimmed length: {fmtTs(Math.max(0, trimEnd - trimStart))} of {fmtTs(duration)}</p>
              <button onClick={applyTrim} disabled={trimming} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                {trimming ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Trimming…</> : <><Scissors className="h-3.5 w-3.5" /> Apply trim</>}
              </button>
            </div>
          </div>

          {/* Download + RSS */}
          <div className="flex gap-2">
            <button onClick={downloadAudio} disabled={downloading} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary py-2.5 text-sm font-semibold disabled:opacity-50">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
            </button>
            <a href={rssUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary py-2.5 text-sm font-semibold">
              <Rss className="h-4 w-4" /> RSS feed
            </a>
          </div>

          <button onClick={save} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}