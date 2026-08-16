import React from 'react';
import { Globe } from 'lucide-react';

// ExternalProfileBanner — informational strip shown directly below the banner
// image on a non-member's profile, declaring their Bluesky origin. No external
// link: the user is already viewing the profile on-site, and the goal is to
// keep everyone inside SwapPulse. The Globe badge is informational only.
export default function ExternalProfileBanner({ did, handle }) {
  if (!did) return null;
  return (
    <div className="flex items-center gap-2 border border-t-0 border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
      <Globe className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 font-semibold">
        This collector is on Bluesky — not a SwapPulse member
      </p>
    </div>
  );
}