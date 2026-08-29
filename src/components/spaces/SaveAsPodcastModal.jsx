import React, { useRef, useState } from 'react';
import { X, UploadCloud, Plus, Trash2, Loader2, Mic } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgePodcastEpisode } from '@/lib/federatedBridge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { assertImageUpload, assertPodcastMediaUpload } from '@/lib/uploadGuard';

// "mm:ss" or "hh:mm:ss" or plain seconds → seconds
function parseTs(str) {
  const parts = String(str || '').split(':').map((n) => Number(n) || 0);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// Convert an ended VoiceSpace into a published org.swappulse.podcastEpisode.
// The audio recording is uploaded as a blob; the episode's source_space_id
// references the original stream record.
export default function SaveAsPodcastModal({ space, onClose, onPublished }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [title, setTitle] = useState(space?.title || '');
  const [description, setDescription] = useState(space?.description || '');
  const [chapters, setChapters] = useState([{ ts: '00:00', title: '', card: '' }]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const audioInput = useRef(null);
  const coverInput = useRef(null);

  const canPublish = !!audioFile && title.trim().length >= 1 && title.length <= 200 && !busy;

  const pickAudio = (file) => {
    if (!file) return;
    try {
      assertPodcastMediaUpload(file);
      setAudioFile(file);
    } catch (error) {
      setAudioFile(null);
      toast({ title: 'Recording rejected', description: error?.message || 'Choose a smaller audio or video file.', variant: 'destructive' });
    }
  };

  const publish = async () => {
    if (!canPublish) return;
    setBusy(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const { file_url: audioUrl } = await base44.integrations.Core.UploadFile({ file: audioFile });

      let duration = 1;
      try {
        const a = new Audio();
        a.src = audioUrl;
        await Promise.race([
          new Promise((res, rej) => { a.onloadedmetadata = () => res(); a.onerror = () => rej(); }),
          new Promise((res) => setTimeout(res, 4000)),
        ]);
        if (Number.isFinite(a.duration) && a.duration > 0) duration = Math.round(a.duration);
      } catch { /* fall back to 1s */ }

      let coverUrl = '';
      if (coverFile) {
        try {
          assertImageUpload(coverFile);
          const r = await base44.integrations.Core.UploadFile({ file: coverFile });
          coverUrl = r.file_url;
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

      const handle = user?.custom_handle || user?.username || user?.bsky_handle || 'collector';
      const payload = {
        title: title.trim(),
        description: description.trim().slice(0, 2000),
        audio_url: audioUrl,
        duration_seconds: duration,
        cover_image_url: coverUrl,
        source_space_id: space?.id,
        chapter_marks: chapterMarks,
        show_notes: description.trim().slice(0, 5000),
        tags: space?.topic_tags || [],
        play_count: 0,
        published_at: new Date().toISOString(),
        host_name: user?.full_name || 'Collector',
        host_handle: handle,
        host_avatar: user?.avatar_url || '',
      };
      const stamped = await stampRecord(payload, NSID.PODCAST_EPISODE, did, signingKey);
      const ep = await base44.entities.PodcastEpisode.create(stamped);
      bridgePodcastEpisode(stamped).then((res) => {
        if (res.bridged) base44.entities.PodcastEpisode.update(ep.id, res).catch(() => {});
      }).catch(() => {});

      // Link the episode back to the source stream.
      try {
        await base44.entities.VoiceSpace.update(space.id, {
          recording_available: true,
          podcast_episode_uri: ep.at_uri,
        });
      } catch { /* non-fatal */ }

      toast({ title: 'Episode published', description: title.trim() });
      onPublished?.(ep);
      onClose?.();
    } catch (e) {
      console.error('save-as-podcast error', e);
      toast({ title: 'Could not publish', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Mic className="h-5 w-5 text-primary" /> Save as Podcast
          </h2>
          <button aria-label="Close save as podcast" onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Audio upload */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Audio recording</label>
            <div
              onClick={() => audioInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pickAudio(e.dataTransfer.files?.[0]); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-6 text-center transition ${drag ? 'border-primary bg-primary/5' : 'border-muted-foreground/50 hover:border-primary'}`}
            >
              <input
                ref={audioInput}
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={(e) => pickAudio(e.target.files?.[0])}
              />
              {audioFile ? (
                <>
                  <UploadCloud className="h-6 w-6 text-primary" />
                  <p className="text-sm font-semibold">{audioFile.name}</p>
                  <p className="text-xs text-muted-foreground">Tap to replace</p>
                </>
              ) : (
                <>
                  <UploadCloud className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-semibold">Drag & drop your recording</p>
                  <p className="text-xs text-muted-foreground">MP3, M4A or WebM - processed audio</p>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="a11y-efc785aeaf">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
             id="a11y-efc785aeaf"/>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="a11y-e9cc12bec7">Description / show notes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
             id="a11y-e9cc12bec7"/>
          </div>

          {/* Chapter marks */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground">Chapter marks (optional)</label>
              <button
                onClick={() => setChapters((c) => [...c, { ts: '00:00', title: '', card: '' }])}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {chapters.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={c.ts}
                    onChange={(e) => setChapters((arr) => arr.map((x, j) => (j === i ? { ...x, ts: e.target.value } : x)))}
                    placeholder="mm:ss"
                    className="w-16 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs outline-none focus:border-primary"
                   aria-label="mm:ss"/>
                  <input
                    value={c.title}
                    onChange={(e) => setChapters((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="Chapter title"
                    maxLength={100}
                    className="flex-1 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs outline-none focus:border-primary"
                   aria-label="Chapter title"/>
                  <input
                    value={c.card}
                    onChange={(e) => setChapters((arr) => arr.map((x, j) => (j === i ? { ...x, card: e.target.value } : x)))}
                    placeholder="card id (optional)"
                    className="hidden w-28 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs outline-none focus:border-primary sm:block"
                  />
                  <button aria-label="Remove podcast chapter"
                    onClick={() => setChapters((arr) => arr.filter((_, j) => j !== i))}
                    className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cover image (300×300 recommended)</label>
            <div
              onClick={() => coverInput.current?.click()}
              className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/50 p-3 hover:border-primary"
            >
              <input
                ref={coverInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    assertImageUpload(file);
                    setCoverFile(file);
                  } catch (error) {
                    setCoverFile(null);
                    toast({ title: 'Cover rejected', description: error?.message || 'Choose a smaller image file.', variant: 'destructive' });
                  } finally {
                    e.target.value = '';
                  }
                }}
              />
              {coverFile ? (
                <img src={URL.createObjectURL(coverFile)} alt="cover" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-secondary">
                  <UploadCloud className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <span className="text-xs text-muted-foreground">{coverFile ? coverFile.name : 'Tap to upload cover'}</span>
            </div>
          </div>

          <button
            onClick={publish}
            disabled={!canPublish}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</> : 'Publish Episode'}
          </button>
        </div>
      </div>
    </div>
  );
}