import React, { useState, useMemo } from 'react';
import { X, Radio, Mic, Disc3, Hash, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeVoiceSpace } from '@/lib/federatedBridge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import SettingSelect from '@/components/settings/SettingSelect';

const PLATFORMS = [
  { value: 'twitch', label: 'Twitch' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'kick', label: 'Kick' },
  { value: 'facebook_gaming', label: 'Facebook Gaming' },
  { value: 'rumble', label: 'Rumble' },
  { value: 'custom', label: 'Custom' },
  { value: 'other', label: 'Other' },
];

const DURATIONS = [30, 60, 90, 120];

function detectPlatform(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('twitch.tv')) return 'twitch';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('kick.com')) return 'kick';
  if (u.includes('facebook.com') || u.includes('fb.gg')) return 'facebook_gaming';
  if (u.includes('rumble.com')) return 'rumble';
  return 'custom';
}

function validUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Go Live modal — two modes:
//   • external: manual Go Live with an external stream URL (Twitch/YouTube/…)
//   • in_platform: a true in-platform audio Space (X-Spaces style) using a
//     WebRTC peer mesh; no stream URL needed, optional recording toggle.
export default function GoLiveModal({ onClose, onLive }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState('in_platform');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topicTags, setTopicTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [platform, setPlatform] = useState('twitch');
  const [duration, setDuration] = useState(60);
  const [customMode, setCustomMode] = useState(false);
  const [customMins, setCustomMins] = useState(60);
  const [recordFromStart, setRecordFromStart] = useState(true);
  const [busy, setBusy] = useState(false);

  const effectiveDuration = customMode
    ? Math.max(15, Math.min(480, Number(customMins) || 15))
    : duration;
  const endTime = useMemo(
    () => new Date(Date.now() + effectiveDuration * 60000),
    [effectiveDuration],
  );

  const onUrlChange = (v) => {
    setStreamUrl(v);
    if (validUrl(v)) setPlatform(detectPlatform(v));
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').slice(0, 30);
    if (!t || topicTags.includes(t) || topicTags.length >= 5) { setTagInput(''); return; }
    setTopicTags((arr) => [...arr, t]);
    setTagInput('');
  };

  const canSubmit =
    title.trim().length >= 5 &&
    title.trim().length <= 120 &&
    (mode === 'in_platform' || validUrl(streamUrl)) &&
    effectiveDuration >= 15 &&
    effectiveDuration <= 480;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const now = new Date();
      const autoEnd = new Date(now.getTime() + effectiveDuration * 60000);
      const handle = user?.custom_handle || user?.username || user?.bsky_handle || 'collector';
      const payload = {
        title: title.trim(),
        description: description.trim().slice(0, 1000),
        space_mode: mode,
        status: 'live',
        platform: mode === 'external' ? platform : undefined,
        stream_url: mode === 'external' ? streamUrl.trim() : undefined,
        planned_duration_minutes: effectiveDuration,
        auto_end_at: autoEnd.toISOString(),
        started_at: now.toISOString(),
        topic_tags: topicTags,
        recording_enabled: mode === 'in_platform' && recordFromStart,
        recording_available: false,
        viewer_count_estimate: 0,
        host_name: user?.full_name || 'Collector',
        host_handle: handle,
        host_avatar: user?.avatar_url || '',
      };
      const stamped = await stampRecord(payload, NSID.VOICE_SPACE, did, signingKey);
      const space = await base44.entities.VoiceSpace.create(stamped);
      bridgeVoiceSpace(stamped).then((res) => {
        if (res.bridged) base44.entities.VoiceSpace.update(space.id, res).catch(() => {});
      }).catch(() => {});
      try {
        await base44.functions.invoke('dispatchBellNotifications', {
          author_did: did,
          author_name: user?.full_name || 'Collector',
          category: 'goes_live',
          preview: `@${handle} is now live: ${title.trim()}`,
          url: mode === 'external' ? streamUrl.trim() : `/spaces/${space.id}`,
        });
      } catch { /* non-fatal */ }
      toast({
        title: mode === 'in_platform' ? 'Your Space is live!' : 'You are live!',
        description: mode === 'in_platform'
          ? 'Share the stage, listeners can join now.'
          : `Streaming for ${effectiveDuration} min, your profile ring is now red.`,
      });
      onLive?.(space);
      onClose?.();
    } catch (e) {
      toast({ title: 'Could not go live', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Radio className="h-5 w-5 text-destructive" /> Go Live
          </h2>
          <button aria-label="Close go live form" onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode picker */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('in_platform')}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${mode === 'in_platform' ? 'border-primary bg-primary/5 shadow-raised' : 'border-border bg-secondary'}`}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold"><Mic className="h-4 w-4 text-primary" /> In-Platform Space</span>
            <span className="text-[11px] text-muted-foreground">Live audio stage. Listeners join and you bring them up to speak.</span>
          </button>
          <button
            onClick={() => setMode('external')}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${mode === 'external' ? 'border-primary bg-primary/5 shadow-raised' : 'border-border bg-secondary'}`}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold"><Radio className="h-4 w-4 text-destructive" /> External Stream</span>
            <span className="text-[11px] text-muted-foreground">Paste a Twitch/YouTube/Kick link. We just link out.</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">{mode === 'in_platform' ? 'Space title' : 'Stream title'}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'in_platform' ? "What's your Space about?" : 'What are you streaming today?'}
              maxLength={120}
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          {mode === 'in_platform' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short summary of the conversation"
                maxLength={1000}
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          {mode === 'external' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Stream URL</label>
                <input
                  value={streamUrl}
                  onChange={(e) => onUrlChange(e.target.value)}
                  placeholder="Paste your stream link (Twitch, YouTube, Kick, etc.)"
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Platform</label>
                <SettingSelect
                  value={platform}
                  onChange={setPlatform}
                  label="Platform"
                  options={PLATFORMS}
                />
              </div>
            </>
          )}

          {/* Topic tags (both modes) */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Topic tags (up to 5)</label>
            <div className="flex flex-wrap gap-1.5">
              {topicTags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs">
                  <Hash className="h-3 w-3 text-muted-foreground" />{t}
                  <button aria-label="Remove topic tag" onClick={() => setTopicTags((arr) => arr.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
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
              <button aria-label="Add topic tag" onClick={addTag} className="rounded-full p-1 text-muted-foreground hover:text-primary"><Plus className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          {mode === 'in_platform' && (
            <button
              onClick={() => setRecordFromStart((v) => !v)}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${recordFromStart ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-secondary'}`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Disc3 className={`h-4 w-4 ${recordFromStart ? 'text-destructive animate-spin' : 'text-muted-foreground'}`} style={recordFromStart ? { animationDuration: '2.5s' } : undefined} />
                Record this Space
              </span>
              <span className={`relative h-6 w-11 rounded-full transition ${recordFromStart ? 'bg-destructive' : 'bg-border-strong'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${recordFromStart ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Planned duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => { setDuration(d); setCustomMode(false); }}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${!customMode && duration === d ? 'bg-primary text-primary-foreground shadow-raised' : 'border border-border bg-secondary'}`}
                >
                  {d} min
                </button>
              ))}
              <button
                onClick={() => setCustomMode(true)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${customMode ? 'bg-primary text-primary-foreground shadow-raised' : 'border border-border bg-secondary'}`}
              >
                Custom…
              </button>
            </div>
            {customMode && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={15}
                  max={480}
                  value={customMins}
                  onChange={(e) => setCustomMins(e.target.value)}
                  className="w-28 rounded-xl border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">minutes (15–480)</span>
              </div>
            )}
          </div>
          <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
            {mode === 'in_platform' ? 'Your Space' : 'Stream'} will auto-end in <b className="text-foreground">{effectiveDuration}</b> minutes
            (around {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}), or end it manually.
          </p>
          <button
            onClick={submit}
            disabled={!canSubmit || busy}
            className="w-full rounded-xl bg-destructive py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Starting…' : mode === 'in_platform' ? 'Start Space' : 'Start Streaming'}
          </button>
        </div>
      </div>
    </div>
  );
}