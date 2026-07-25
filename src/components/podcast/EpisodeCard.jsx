import React from 'react';
import { Play, Pause } from 'lucide-react';
import { usePodcastPlayer } from '@/lib/podcastPlayer';
import { timeAgo } from '@/lib/format';

function fmtDur(s) {
  if (!s) return '0 min';
  return `${Math.max(1, Math.round(s / 60))} min`;
}

// §Alpha 1.4 - episode list card for the profile Podcasts tab and the
// Voice Spaces Recordings tab. Shows cover (or gradient + episode number),
// title, duration + date, a partial-listen progress bar, and a play button
// bound to the global podcast player.
export default function EpisodeCard({ episode }) {
  const { play, toggle, playing, episode: current, progress } = usePodcastPlayer();
  const isCurrent = current?.id === episode.id;
  const isPlaying = isCurrent && playing;
  const listened = progress[episode.id] || 0;
  const pct = episode.duration_seconds ? Math.min(100, (listened / episode.duration_seconds) * 100) : 0;
  const cover = episode.cover_image_url;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-base" style={{ minHeight: 88 }}>
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded" style={{ background: 'linear-gradient(135deg, #6d4aff, #8b5cf6)' }}>
        {cover ? (
          <img src={cover} alt={episode.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-2xl font-bold text-white">
            {episode.episode_number || '•'}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{episode.title}</p>
        <p className="text-xs text-muted-foreground">{fmtDur(episode.duration_seconds)} · {timeAgo(episode.published_at)}</p>
        {pct > 0 && (
          <div className="mt-2 h-[3px] w-full rounded-full bg-border">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <button
        onClick={() => (isCurrent ? toggle() : play(episode))}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
      </button>
    </div>
  );
}