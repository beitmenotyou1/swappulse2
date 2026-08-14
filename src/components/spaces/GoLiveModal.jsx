import React, { useState, useMemo } from 'react';
import { X, Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';
import { bridgeVoiceSpace } from '@/lib/federatedBridge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

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

// Manual Go Live modal - the collector declares themselves live by pasting an
// external stream URL and choosing a planned duration. No OAuth, no platform
// webhooks: SwapPulse just records the declaration and notifies bell-enabled
// followers. The red live ring is driven by the resulting VoiceSpace record.
export default function GoLiveModal({ onClose, onLive }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [platform, setPlatform] = useState('twitch');
  const [duration, setDuration] = useState(60);
  const [customMode, setCustomMode] = useState(false);
  const [customMins, setCustomMins] = useState(60);
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

  const canSubmit =
    title.trim().length >= 5 &&
    title.trim().length <= 120 &&
    validUrl(streamUrl) &&
    effectiveDuration >= 15 &&
    effectiveDuration <= 480;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const { did, signingKey } = await ensureUserDid();
      const now = new Date();
      const autoEnd = new Date(now.getTime() + effectiveDuration * 60000);
      const handle = user?.email?.split('@')[0] || 'collector';
      const payload = {
        title: title.trim(),
        status: 'live',
        stream_url: streamUrl.trim(),
        platform,
        planned_duration_minutes: effectiveDuration,
        auto_end_at: autoEnd.toISOString(),
        started_at: now.toISOString(),
        topic_tags: [],
        viewer_count_estimate: 0,
        recording_available: false,
        host_name: user?.full_name || 'Collector',
        host_handle: handle,
        host_avatar: user?.avatar_url || '',
      };
      const stamped = await stampRecord(payload, NSID.VOICE_SPACE, did, signingKey);
      const space = await base44.entities.VoiceSpace.create(stamped);
      bridgeVoiceSpace(stamped).then((res) => {
        if (res.bridged) base44.entities.VoiceSpace.update(space.id, res).catch(() => {});
      }).catch(() => {});
      // Notify bell-enabled followers who opted into goes_live alerts.
      try {
        await base44.functions.invoke('dispatchBellNotifications', {
          author_did: did,
          author_name: user?.full_name || 'Collector',
          category: 'goes_live',
          preview: `@${handle} is now live: ${title.trim()}`,
          url: streamUrl.trim(),
        });
      } catch {
        /* non-fatal - push may be unconfigured */
      }
      toast({
        title: 'You are live!',
        description: `Streaming for ${effectiveDuration} min - your profile ring is now red.`,
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
        className="w-full max-w-lg animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Radio className="h-5 w-5 text-destructive" /> Go Live
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Stream title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you streaming today?"
              maxLength={120}
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
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
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
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
            Stream will auto-end in <b className="text-foreground">{effectiveDuration}</b> minutes
            (around {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) -
            or tap End Stream to stop early.
          </p>
          <button
            onClick={submit}
            disabled={!canSubmit || busy}
            className="w-full rounded-xl bg-destructive py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Going live…' : 'Start Streaming'}
          </button>
        </div>
      </div>
    </div>
  );
}