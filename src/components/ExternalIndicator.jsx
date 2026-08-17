import React from 'react';
import { Globe } from 'lucide-react';
import { useMembership } from '@/lib/membershipContext';

// ExternalIndicator — a small Globe icon shown next to an author name when the
// author is not a registered SwapPulse member (a Bluesky-only / federated
// collector). Driven by the batch membership lookup so it never triggers
// per-card network calls. Pass the `external` prop to override the lookup when
// membership is already known (e.g. federated search results). Renders null
// for members or unresolved DIDs.
export default function ExternalIndicator({ did, external, className = '' }) {
  const { isExternal } = useMembership();
  const show = external !== undefined ? !!external : isExternal(did);
  if (!show) return null;
  return (
    <span
      className={`inline-flex items-center ${className}`}
      title="On Bluesky, not a SwapPulse member"
      aria-label="On Bluesky, not a SwapPulse member"
    >
      <Globe className="h-3.5 w-3.5 text-primary/70" aria-hidden="true" />
    </span>
  );
}