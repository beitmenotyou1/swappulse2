import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Headphones } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { base44 } from '@/api/base44Client';

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function PodcastPlayer({ episode }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(episode.duration_seconds || 0);
  const countedRef = useRef(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime || 0);
    const onMeta = () => setDuration(a.duration || episode.duration_seconds || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [episode.id]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
        if (!countedRef.current) {
          countedRef.current = true;
          base44.entities.PodcastEpisode.update(episode.id, { play_count: (episode.play_count || 0) + 1 }).catch(() => {});
        }
      } catch { /* autoplay blocked */ }
    }
  };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <audio ref={audioRef} src={episode.audio_url} preload="metadata" />
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Headphones className="h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="truncate text-sm font-bold">{episode.title}</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">By {episode.host_name || 'Collector'} · {episode.play_count || 0} plays</p>
        </div>
        <Avatar name={episode.host_name} src={episode.host_avatar} size={36} />
      </div>
      <div className="mt-3">
        <div className="h-1.5 w-full cursor-pointer rounded-full bg-secondary" onClick={seek}>
          <div className="h-full rounded-full bg-primary" style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{fmt(progress)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
      {episode.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{episode.description}</p>}
    </div>
  );
}