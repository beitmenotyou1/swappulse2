import React, { useState } from 'react';
import { Link2, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import AtProtoForm from '@/components/auth/AtProtoForm';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

// BlueskyLinkCard — the primary AT Protocol onboarding surface in Settings.
// If the user has linked a Bluesky account (bsky_handle is set), shows their
// linked identity. If not, shows the AtProtoForm so they can link one.
// On successful link, refreshes the user context and fires re-bridge-content
// to migrate existing shared-bridge posts to their own DID.
export default function BlueskyLinkCard() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [rebridging, setRebridging] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const linked = !!user?.bsky_handle;

  const handleLinked = async (data) => {
    toast({
      title: 'Bluesky account linked',
      description: `You're now posting as @${data.handle}.`,
    });
    setShowForm(false);
    await checkUserAuth?.();
    // Fire-and-forget re-bridge of existing content to the new DID
    setRebridging(true);
    try {
      await base44.functions.invoke('re-bridge-content', {});
      toast({
        title: 'Content migrated',
        description: 'Your existing posts are being moved to your Bluesky account.',
      });
    } catch {
      // non-fatal — re-bridge is best-effort
    } finally {
      setRebridging(false);
    }
  };

  if (linked && !showForm) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <CheckCircle2 className="h-4 w-4 text-success" /> Bluesky Account Linked
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You're federating as <span className="font-medium text-foreground">@{user.bsky_handle}</span>.
          Your posts, replies, likes, and follows are written to your own Bluesky repository.
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          <RefreshCw className="h-4 w-4" /> Re-link Account
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Link2 className="h-4 w-4 text-primary" /> Link Your Bluesky Account
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        SwapPulse federates via the AT Protocol. Link your existing Bluesky account so your
        posts, replies, likes, and follows are attributed to <em>you</em> across the network —
        not the shared SwapPulse bridge account.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Don't have a Bluesky account yet?{' '}
        <a
          href="https://bsky.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Create one at bsky.app
        </a>
        , then come back here to link it.
      </p>
      <div className="mt-3">
        <AtProtoForm mode="link" onSuccess={handleLinked} submitLabel="Link Bluesky Account" />
      </div>
      {rebridging && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Migrating your existing content...
        </p>
      )}
    </div>
  );
}