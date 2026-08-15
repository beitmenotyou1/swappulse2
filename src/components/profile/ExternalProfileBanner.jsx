import React from 'react';
import { Globe, ExternalLink } from 'lucide-react';

// ExternalProfileBanner — prominent full-width strip shown directly below the
// banner image on a non-member's profile, declaring their Bluesky origin with
// a View-on-Bluesky link. The primary origin cue for external collectors.
export default function ExternalProfileBanner({ did, handle }) {
  if (!did) return null;
  const bskyUrl = `https://bsky.app/profile/${did}`;
  return (
    <div className="flex items-center gap-2 border border-t-0 border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
      <Globe className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 font-semibold">
        This collector is on Bluesky — not a SwapPulse member
      </p>
      <a
        href={bskyUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
      >
        View on Bluesky <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}