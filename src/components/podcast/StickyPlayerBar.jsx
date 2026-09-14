import React, { useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, X } from 'lucide-react';
import { usePodcastPlayer } from '@/lib/podcastPlayer';
import ChapterDropdown from './ChapterDropdown';

function fmt(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// §Alpha 1.4 - sticky bottom player bar. Persists across navigation (rendered
// inside Layout so it never unmounts on route change). Scrubber, skip 15/30s,
// chapter dropdown, speed control via long-press on play/pause.
export default function StickyPlayerBar() {
  const { episode, playing, position, duration, speed, toggle, seek, skip, cycleSpeed, close } = usePodcastPlayer();
  const [pressTimer, setPressTimer] = useState(null);
  const [showSpeed, setShowSpeed] = useState(false);
  if (!episode) return null;

  const safeDuration = Number.isFinite(duration) ? Math.max(0, Math.floor(duration)) : 0;
  const safePosition = Math.min(safeDuration, Math.max(0, Math.floor(position || 0)));
  const startPress = () => {
    const t = setTimeout(() => {
      cycleSpeed();
      setShowSpeed(true);
      setTimeout(() => setShowSpeed(false), 1400);
    }, 500);
    setPressTimer(t);
  };
  const endPress = () => { if (pressTimer) { clearTimeout(pressTimer); setPressTimer(null); } };

  return (
    <div className="sticky bottom-16 z-40 mx-auto flex h-[72px] w-full items-center gap-2 rounded-t-xl border border-t-border bg-card px-3 shadow-elevated sm:bottom-0 sm:gap-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded" style={{ background: 'linear-gradient(135deg, #6d4aff, #8b5cf6)' }}>
        {episode.cover_image_url ? (
          <img src={episode.cover_image_url} className="h-full w-full object-cover" alt={episode.title} />
        ) : (
          <div className="grid h-full w-full place-items-center text-lg font-bold text-white">{episode.episode_number || '•'}</div>
        )}
      </div>
      <p className="hidden w-28 shrink-0 truncate text-sm font-medium sm:block">{episode.title}</p>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmt(position)}</span>
      <input
        type="range"
        className="min-h-11 min-w-0 flex-1 cursor-pointer accent-primary"
        min={0}
        max={safeDuration}
        step={1}
        value={safePosition}
        disabled={!safeDuration}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label={`Seek in ${episode.title || 'podcast episode'}`}
        aria-valuetext={`${fmt(safePosition)} of ${fmt(safeDuration)}`}
      />
      <span className="w-9 shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(duration)}</span>
      {episode.chapter_marks?.length > 0 && <ChapterDropdown chapters={episode.chapter_marks} onSeek={seek} />}
      <button onClick={() => skip(-15)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground" title="Back 15s" aria-label="Back 15 seconds">
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        onClick={toggle}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
        {showSpeed && <span className="absolute -top-6 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">{speed}x</span>}
      </button>
      <button onClick={() => skip(30)} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground" title="Forward 30s" aria-label="Forward 30 seconds">
        <RotateCw className="h-4 w-4" />
      </button>
      <button onClick={close} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Close player">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}