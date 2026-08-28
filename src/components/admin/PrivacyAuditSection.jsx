import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function Metric({ label, value, warn = false }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-secondary/40'}`}>
      <p className={`text-lg font-bold ${warn ? 'text-destructive' : 'text-foreground'}`}>{value ?? 0}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function PrivacyAuditSection() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const runAudit = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('privacy-audit', {});
      const data = res?.data || res;
      setResult(data);
      const c = data?.counts || {};
      const exposed = (c.collection_entries_bridged || 0) + (c.bridged_binders_followers || 0) + (c.bridged_binders_private || 0);
      toast({
        title: 'Privacy audit complete',
        description: `${c.collection_entries_bridged || 0} bridged collection entries found${exposed ? ' — review remediation counts below.' : '.'}`,
      });
    } catch (err) {
      toast({
        title: 'Privacy audit failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  const c = result?.counts || {};
  const capped = result?.capped || {};
  const hasCap = capped.users || capped.collection_entries || capped.binders;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-base">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <ShieldCheck className="h-4 w-4 text-primary" />
        AT Protocol Privacy Audit
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Read-only service-role audit of collection and binder federation. It returns counts only and never returns purchase prices, notes, or other sensitive field contents.
      </p>

      <button
        onClick={runAudit}
        disabled={running}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {running ? 'Auditing…' : 'Run Privacy Audit'}
      </button>

      {result && (
        <div className="mt-4 space-y-4">
          {hasCap && (
            <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>One or more audit reads hit the {capped.limit || 5000} record ceiling. Treat those counts as minimums until pagination is added.</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Collection entries</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Total entries" value={c.collection_entries_total} />
              <Metric label="Bridged entries" value={c.collection_entries_bridged} warn={(c.collection_entries_bridged || 0) > 0} />
              <Metric label="Bridged with purchase price" value={c.bridged_with_purchase_price} warn={(c.bridged_with_purchase_price || 0) > 0} />
              <Metric label="Bridged with notes" value={c.bridged_with_notes} warn={(c.bridged_with_notes || 0) > 0} />
              <Metric label="Bridged with market value" value={c.bridged_with_market_value} warn={(c.bridged_with_market_value || 0) > 0} />
              <Metric label="Bridged with acquisition date" value={c.bridged_with_acquisition_date} warn={(c.bridged_with_acquisition_date || 0) > 0} />
              <Metric label="Bridged entries in non-public binders" value={c.bridged_entries_referenced_by_non_public_binders} warn={(c.bridged_entries_referenced_by_non_public_binders || 0) > 0} />
              <Metric label="Affected users" value={c.affected_users} warn={(c.affected_users || 0) > 0} />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Binders</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Total binders" value={c.binders_total} />
              <Metric label="Public" value={c.binders_public} />
              <Metric label="Followers" value={c.binders_followers} />
              <Metric label="Private" value={c.binders_private} />
              <Metric label="Bridged binders" value={c.binders_bridged} />
              <Metric label="Bridged followers binders" value={c.bridged_binders_followers} warn={(c.bridged_binders_followers || 0) > 0} />
              <Metric label="Bridged private binders" value={c.bridged_binders_private} warn={(c.bridged_binders_private || 0) > 0} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Generated {result.generated_at ? new Date(result.generated_at).toLocaleString() : 'now'}. This audit does not mutate any record.</p>
        </div>
      )}
    </section>
  );
}
