import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Fingerprint } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Admin tool to backfill PDS identities for existing users who registered
// before auto-provisioning was live. Idempotent — safe to re-run until
// failed=0 and provisioned stops increasing.
export default function ProvisionIdentitiesSection() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('provision-all-identities', {});
      const data = res?.data || res;
      setResult(data);
      toast({
        title: 'Backfill complete',
        description: `${data.provisioned || 0} provisioned, ${data.repaired || 0} repaired, ${data.skipped || 0} skipped, ${data.failed || 0} failed`,
      });
    } catch (err) {
      toast({
        title: 'Backfill failed',
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
        <Fingerprint className="h-4 w-4 text-primary" />
        Provision Federated Identities
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Ensures every existing user has a PDS identity (did:plc + username.swappulse.org
        handle) and a stored bridge credential on the current PDS. Users with an existing
        did:plc but no credential are repaired (app password re-issued) instead of
        recreated. Idempotent, re-run until failed is 0.
      </p>
      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
        {running ? 'Running…' : 'Provision Identities'}
      </button>
      {result && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
          <div className="rounded-lg bg-secondary p-2 text-center">
            <p className="font-bold text-primary">{result.provisioned || 0}</p>
            <p className="text-xs text-muted-foreground">Provisioned</p>
          </div>
          <div className="rounded-lg bg-secondary p-2 text-center">
            <p className="font-bold text-success">{result.repaired || 0}</p>
            <p className="text-xs text-muted-foreground">Repaired</p>
          </div>
          <div className="rounded-lg bg-secondary p-2 text-center">
            <p className="font-bold">{result.skipped || 0}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
          <div className="rounded-lg bg-secondary p-2 text-center">
            <p className={`font-bold ${result.failed > 0 ? 'text-destructive' : ''}`}>{result.failed || 0}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
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