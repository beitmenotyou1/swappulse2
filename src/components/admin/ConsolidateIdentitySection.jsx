import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Merge } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Admin tool to run the one-time PdsCredential → User identity consolidation.
// Copies each user's PdsCredential (did, pds_url, app_password) onto their User
// record as encrypted pds_app_password + pds_url, so identity lives in one
// cohesive place. Idempotent — safe to re-run; skips users already consolidated.
export default function ConsolidateIdentitySection() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('consolidate-identity', {});
      const data = res?.data || res;
      setResult(data);
      toast({
        title: 'Consolidation complete',
        description: `${data.consolidated || 0} consolidated, ${data.skipped || 0} skipped, ${data.failed || 0} failed`,
      });
    } catch (err) {
      toast({
        title: 'Consolidation failed',
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
        <Merge className="h-4 w-4 text-primary" />
        Consolidate Identity Records
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        One-time migration: copies each user's legacy PdsCredential (did, PDS URL,
        app password) onto their User record as an encrypted <code>pds_app_password</code> +
        <code>pds_url</code>, so identity lives in one cohesive place. Idempotent —
        re-run safely; skips users already consolidated.
      </p>
      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />}
        {running ? 'Running…' : 'Consolidate Identities'}
      </button>
      {result && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-secondary p-2 text-center">
            <p className="font-bold text-primary">{result.consolidated || 0}</p>
            <p className="text-xs text-muted-foreground">Consolidated</p>
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