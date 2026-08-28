import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { detectVideoPlatform } from '@/lib/mediaEmbed';

// Inline video player for embeddable platforms (YouTube, TikTok, etc.).
// Shows a thumbnail with a play button; clicking loads the iframe embed.
// This avoids loading third-party iframes until the user opts in.
export default function VideoEmbed({ video }) {
  const [playing, setPlaying] = useState(false);
  if (!video?.url) return null;

  const detected = detectVideoPlatform(video.url);
  if (!detected) return null;

  const thumbnail = video.thumbnail || detected.thumbnail;
  const altText = video.alt_text || `Video from ${detected.platform}`;

  if (playing) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        <div className="relative aspect-video w-full bg-black">
          <iframe
            src={detected.embedUrl}
            title={altText}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="mt-3 block w-full overflow-hidden rounded-xl border border-border bg-black text-left"
      aria-label={`Play video: ${altText}`}
    >
      <div className="relative aspect-video w-full">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={altText}
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <Play className="h-12 w-12 text-foreground/60" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30">
          <div className="rounded-full bg-primary/90 p-4 transition-transform hover:scale-110">
            <Play className="h-8 w-8 fill-white text-white" />
          </div>
        </div>
      </div>
    </button>
  );
}