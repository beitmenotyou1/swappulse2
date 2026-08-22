import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

// NativeVideoPlayer — inline player for native (uploaded) pack-opening
// reveal videos. External-link embeds use the existing VideoEmbed component;
// this renders when embed_video.platform is 'other' (native upload).
export default function NativeVideoPlayer({ url, altText }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const ref = React.useRef(null);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };

  const toggleMute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-border bg-black">
      <video
        ref={ref}
        src={url}
        muted={muted}
        loop
        playsInline
        onClick={toggle}
        aria-label={altText || 'Pack opening video'}
        className="max-h-[420px] w-full object-contain"
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <button
          onClick={toggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}