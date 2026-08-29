import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ShieldCheck, AlertTriangle, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CONFIRM_PHRASE = 'DELETE_PDS_PRIVACY_COPIES';

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
  const [previewRunning, setPreviewRunning] = useState(false);
  const [preview, setPreview] = useState(null);
  const [remediationRunning, setRemediationRunning] = useState(false);
  const [remediationResult, setRemediationResult] = useState(null);
  const [confirmation, setConfirmation] = useState('');
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

  const runPreview = async () => {
    setPreviewRunning(true);
    setPreview(null);
    setRemediationResult(null);
    try {
      const res = await base44.functions.invoke('privacy-remediate-pds', { execute: false });
      const data = res?.data || res;
      setPreview(data);
      toast({
        title: 'Remediation preview ready',
        description: `${data?.summary?.total_operations || 0} PDS deletion operation(s) identified. No records changed.`,
      });
    } catch (err) {
      toast({
        title: 'Preview failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setPreviewRunning(false);
    }
  };

  const runRemediationBatch = async () => {
    if (confirmation !== CONFIRM_PHRASE) return;
    setRemediationRunning(true);
    try {
      const res = await base44.functions.invoke('privacy-remediate-pds', {
        execute: true,
        confirm: CONFIRM_PHRASE,
        batch_size: 50,
      });
      const data = res?.data || res;
      setRemediationResult(data);
      setConfirmation('');
      toast({
        title: data?.batch?.failed ? 'Remediation batch completed with errors' : 'Remediation batch complete',
        description: `${data?.batch?.succeeded || 0} removed, ${data?.batch?.failed || 0} failed.`,
        variant: data?.batch?.failed ? 'destructive' : undefined,
      });
      await runPreview();
      await runAudit();
    } catch (err) {
      toast({
        title: 'Remediation failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRemediationRunning(false);
    }
  };

  const c = result?.counts || {};
  const capped = result?.capped || {};
  const hasCap = capped.users || capped.collection_entries || capped.binders;
  const s = preview?.summary || {};

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-base">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <ShieldCheck className="h-4 w-4 text-primary" />
        AT Protocol Privacy Audit
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Service-role audit of collection and binder federation. The audit returns counts only and never returns purchase prices, notes, or other sensitive field contents.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={runAudit}
          disabled={running || remediationRunning}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {running ? 'Auditing…' : 'Run Privacy Audit'}
        </button>
        <button
          onClick={runPreview}
          disabled={previewRunning || remediationRunning}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-secondary disabled:opacity-50"
        >
          {previewRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          {previewRunning ? 'Checking…' : 'Preview PDS Cleanup'}
        </button>
      </div>

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

      {preview && (
        <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Trash2 className="h-4 w-4 text-destructive" />
            Historical PDS cleanup
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            The preview is non-destructive. Cleanup deletes public federation copies only and preserves the private Base44 Binder and CollectionEntry source records.
          </p>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="CollectionEntry PDS records" value={s.collection_entry_pds_records} warn={(s.collection_entry_pds_records || 0) > 0} />
            <Metric label="Non-public binder PDS records" value={s.non_public_binder_pds_records} warn={(s.non_public_binder_pds_records || 0) > 0} />
            <Metric label="Non-public standard.site documents" value={s.non_public_binder_standard_documents} warn={(s.non_public_binder_standard_documents || 0) > 0} />
            <Metric label="Total deletion operations" value={s.total_operations} warn={(s.total_operations || 0) > 0} />
          </div>

          {(s.total_operations || 0) > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">
                To process the next batch of 50, type {CONFIRM_PHRASE}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                 aria-label={CONFIRM_PHRASE}/>
                <button
                  onClick={runRemediationBatch}
                  disabled={remediationRunning || confirmation !== CONFIRM_PHRASE}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50"
                >
                  {remediationRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {remediationRunning ? 'Removing…' : 'Remove PDS Copies'}
                </button>
              </div>
            </div>
          )}

          {remediationResult?.batch && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last batch: {remediationResult.batch.succeeded || 0} succeeded, {remediationResult.batch.failed || 0} failed.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
