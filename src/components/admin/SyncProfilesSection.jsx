import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, UserCog } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Admin tool to backfill app.bsky.actor.profile records on the PDS for every
// provisioned user, so Bluesky (and other AT Protocol apps) show real display
// names, avatars, and bios instead of blank accounts. Idempotent — re-run
// until failed is 0.
export default function SyncProfilesSection() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('sync-profile-records', { adminBackfill: true });
      const data = res?.data || res;
      setResult(data);
      toast({
        title: 'Profile sync complete',
        description: `${data.synced || 0} synced, ${data.failed || 0} failed`,
      });
    } catch (err) {
      toast({
        title: 'Profile sync failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-base">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <UserCog className="h-4 w-4 text-primary" />
        Sync Federated Profiles
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Creates an app.bsky.actor.profile record on the PDS for every provisioned user from
        their local display name, avatar, and bio, so Bluesky and other AT Protocol apps show
        real profiles instead of blank accounts. Run after "Provision Federated Identities".
        Idempotent, re-run until failed is 0.
      </p>
      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCog className="h-4 w-4" />}
        {running ? 'Running…' : 'Sync Profiles'}
      </button>
      {result && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-secondary p-2 text-center">
            <p className="font-bold text-primary">{result.synced || 0}</p>
            <p className="text-xs text-muted-foreground">Synced</p>
          </div>
          <div className="rounded-lg bg-secondary p-2 text-center">
            <p className={`font-bold ${result.failed > 0 ? 'text-destructive' : ''}`}>{result.failed || 0}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
          <div className="rounded-lg bg-secondary p-2 text-center">
            <p className="font-bold">{result.total || 0}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          {result.failed > 0 && result.errors?.length > 0 && (
            <div className="col-span-3 mt-1 rounded-lg border border-border p-2 text-xs text-muted-foreground">
              <p className="mb-1 font-semibold">First {result.errors.length} error(s):</p>
              <ul className="space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i} className="truncate">{e.id}: {e.error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}