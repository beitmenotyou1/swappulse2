import React, { useState } from 'react';
import { BadgeCheck, Copy, Check, ExternalLink } from 'lucide-react';

// Shared profile-header handle display. Shows the federated handle
// prominently as @username.swappulse.org with the full did:plc on a
// secondary line (copyable) and a "View on Bluesky" link when the handle
// resolves externally. Falls back to the local username when no federated
// handle is set yet.
export default function ProfileHandle({ bskyHandle, username, did, verified }) {
  const [copied, setCopied] = useState(false);
  // Federated handle (username.swappulse.org) only when one is actually set —
  // never fabricate the domain for users without a real federated identity.
  // Falls back to the local username (no domain) gracefully.
  const display = bskyHandle || username || 'collector';
  // Prefer a DID-based Bluesky URL — it resolves on bsky.app even before the
  // handle's DNS/well-known is set up. Falls back to the handle if no DID.
  const bskyUrl = did
    ? `https://bsky.app/profile/${did}`
    : (bskyHandle ? `https://bsky.app/profile/${bskyHandle}` : null);

  const copyDid = () => {
    if (!did) return;
    navigator.clipboard?.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-foreground">@{display}</p>
        {verified && <BadgeCheck className="h-4 w-4 text-success" />}
      </div>
      {did && (
        <button
          type="button"
          onClick={copyDid}
          className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="font-mono">{did.length > 22 ? `${did.slice(0, 22)}…` : did}</span>
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        </button>
      )}
      {bskyUrl && (
        <a
          href={bskyUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View on Bluesky <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}