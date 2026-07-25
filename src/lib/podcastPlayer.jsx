import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ensureUserDid, stampRecord, NSID } from '@/lib/atproto';

// §Alpha 1.4 — global podcast player context. Owns a single <audio> element
// at the app root so playback persists across navigation. Tracks listen
// progress in org.swappulse.podcastPlay records and resumes from the last
// position when an episode is replayed.
const Ctx = createContext(null);

export function PodcastPlayerProvider({ children }) {
  const audioRef = useRef(typeof Audio !== 'undefined' ? new Audio() : null);
  const [episode, setEpisode] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState({}); // episodeId -> seconds (from podcastPlay records)
  const playRecs = useRef({}); // episodeId -> play record id
  const identity = useRef({ did: '', signingKey: '' });
  const countedRef = useRef({}); // episodeId -> incremented play_count

  // Load identity + the listener's existing podcastPlay records (progress map).
  useEffect(() => {
    (async () => {
      try {
        const { did, signingKey } = await ensureUserDid();
        identity.current = { did, signingKey };
        const plays = await base44.entities.PodcastPlay.filter({ did }, '-listened_at', 200).catch(() => []);
        const map = {};
        for (const p of plays) {
          const eid = p.episode_id;
          if (!eid) continue;
          if ((p.listen_duration_seconds || 0) > (map[eid] || 0)) {
            map[eid] = p.listen_duration_seconds || 0;
            playRecs.current[eid] = p.id;
          }
        }
        setProgress(map);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const savePlay = useCallback(async (completed) => {
    const a = audioRef.current;
    if (!a || !episode) return;
    const seconds = Math.floor(a.currentTime || 0);
    if (seconds < 1 && !completed) return;
    try {
      const { did, signingKey } = identity.current;
      const payload = {
        episode_ref: episode.at_uri || `at://${did}/${NSID.PODCAST_EPISODE}/${episode.id}`,
        episode_id: episode.id,
        listen_duration_seconds: seconds,
        completed: completed || (a.duration ? seconds >= a.duration - 3 : false),
        listened_at: new Date().toISOString(),
      };
      const existing = playRecs.current[episode.id];
      if (existing) {
        await base44.entities.PodcastPlay.update(existing, payload);
      } else if (did && signingKey) {
        const stamped = await stampRecord(payload, NSID.PODCAST_PLAY, did, signingKey);
        const rec = await base44.entities.PodcastPlay.create(stamped);
        playRecs.current[episode.id] = rec.id;
      }
      setProgress((m) => ({ ...m, [episode.id]: seconds }));
    } catch { /* non-fatal */ }
  }, [episode]);

  // Audio element event wiring.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setPosition(a.currentTime || 0);
    const onMeta = () => setDuration(a.duration || episode?.duration_seconds || 0);
    const onEnd = () => { setPlaying(false); savePlay(true); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, [episode, savePlay]);

  // Periodically persist listen position while playing.
  useEffect(() => {
    if (!playing || !episode) return;
    const t = setInterval(() => savePlay(false), 15000);
    return () => clearInterval(t);
  }, [playing, episode, savePlay]);

  const play = useCallback(async (ep) => {
    const a = audioRef.current;
    if (!a || !ep) return;
    if (episode?.id !== ep.id) {
      setEpisode(ep);
      a.src = ep.audio_url;
      a.playbackRate = speed;
      const resumeAt = progress[ep.id] || 0;
      if (resumeAt > 0) {
        const onMeta = () => {
          try { if (resumeAt < (a.duration || ep.duration_seconds || 0)) a.currentTime = resumeAt; } catch { /* */ }
          a.removeEventListener('loadedmetadata', onMeta);
        };
        a.addEventListener('loadedmetadata', onMeta);
      }
      if (!countedRef.current[ep.id]) {
        countedRef.current[ep.id] = true;
        base44.entities.PodcastEpisode.update(ep.id, { play_count: (ep.play_count || 0) + 1 }).catch(() => {});
      }
    }
    try { await a.play(); } catch { /* autoplay blocked */ }
  }, [episode, progress, speed]);

  const pause = useCallback(() => {
    const a = audioRef.current;
    if (a) { a.pause(); savePlay(false); }
  }, [savePlay]);

  const toggle = useCallback(() => {
    if (!episode) return;
    if (playing) pause(); else play(episode);
  }, [episode, playing, pause, play]);

  const seek = useCallback((sec) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(sec, a.duration || 0));
  }, []);

  const skip = useCallback((delta) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min((a.currentTime || 0) + delta, a.duration || 0));
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((s) => {
      const next = s === 1 ? 1.5 : s === 1.5 ? 2 : 1;
      const a = audioRef.current;
      if (a) a.playbackRate = next;
      return next;
    });
  }, []);

  const close = useCallback(() => {
    const a = audioRef.current;
    if (a) { a.pause(); a.src = ''; }
    setEpisode(null); setPlaying(false); setPosition(0); setDuration(0);
  }, []);

  return (
    <Ctx.Provider value={{ episode, playing, position, duration, speed, progress, play, pause, toggle, seek, skip, cycleSpeed, close }}>
      {children}
    </Ctx.Provider>
  );
}

export const usePodcastPlayer = () => useContext(Ctx);