import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

// BlueskyLinkPrompt — a non-blocking banner shown on federated entry points
// (Compose, first follow/like) for users who haven't linked a Bluesky account.
// Dismissal is per-session (sessionStorage); the prompt reappears next visit.
// Dismissing does NOT block the action — federated actions fall back to the
// shared bridge account until the user links their own.
const STORAGE_KEY = 'swappulse_bsky_prompt_dismissed';

export default function BlueskyLinkPrompt() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === '1');
    } catch {}
  }, []);

  // Show only for logged-in users with no did:plc AND no linked handle —
  // auto-provisioned users (did:plc set) never see this prompt.
  if (!user || user.did?.startsWith('did:plc:') || user.bsky_handle || dismissed) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setDismissed(true);
  };

  return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="flex-1 text-xs">
        <p className="font-semibold text-foreground">Post as yourself on Bluesky</p>
        <p className="mt-0.5 text-muted-foreground">
          Link your Bluesky account so your posts are attributed to you, not the shared
          SwapPulse bridge. You can keep posting without linking, this is just a nudge.
        </p>
        <button
          onClick={() => navigate('/settings')}
          className="mt-1.5 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
        >
          Link account <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}