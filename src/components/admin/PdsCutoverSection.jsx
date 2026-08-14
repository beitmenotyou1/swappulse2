import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ServerCog, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Database } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// PdsCutoverSection — guided admin panel for switching the whole site to a new
// self-hosted PDS. Three sequenced steps:
//   1. Provision all identities on the new PDS (re-provisions simulated-DID and
//      bsky.social-linked users).
//   2. Migrate & re-bridge content onto the new PDS (re-creates posts/follows/
//      likes under each user's new DID; deletes old records from the old PDS).
//   3. Verify federation end-to-end (handle resolves on the network + records
//      present on the new PDS).
//
// Prerequisites (shown to the admin): create the bridge account on the new PDS,
// set PDS_INVITE_REQUIRED=false, point *.swappulse.org DNS at the PDS, then
// update the four PDS secrets. Set OLD_PDS_* secrets BEFORE flipping the main
// ones so step 2 can clean up old records.
export default function PdsCutoverSection() {
  const { toast } = useToast();
  const [step, setStep] = useState(null);
  const [provisionResult, setProvisionResult] = useState(null);
  const [migrateResult, setMigrateResult] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [blobStats, setBlobStats] = useState(null);
  const [blobLoading, setBlobLoading] = useState(false);

  const loadBlobStats = async () => {
    setBlobLoading(true);
    try {
      const res = await base44.functions.invoke('pds-blob-stats', {});
      setBlobStats(res?.data || res);
    } catch { /* ignore */ } finally { setBlobLoading(false); }
  };

  useEffect(() => { loadBlobStats(); }, []);

  const runProvision = async () => {
    setStep('provision');
    setProvisionResult(null);
    try {
      const res = await base44.functions.invoke('provision-all-identities', {});
      const data = res?.data || res;
      setProvisionResult(data);
      toast({
        title: 'Identities provisioned',
        description: `${data.provisioned || 0} provisioned, ${data.skipped || 0} skipped, ${data.failed || 0} failed`,
      });
    } catch (err) {
      toast({ title: 'Provisioning failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setStep(null);
    }
  };

  const runMigrate = async () => {
    setStep('migrate');
    setMigrateResult(null);
    try {
      const res = await base44.functions.invoke('re-bridge-all-content', {});
      const data = res?.data || res;
      setMigrateResult(data);
      toast({
        title: 'Content migrated',
        description: `${data.rebridged || 0} records re-bridged across ${data.users || 0} users`,
      });
    } catch (err) {
      toast({ title: 'Migration failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setStep(null);
    }
  };

  const runVerify = async () => {
    setStep('verify');
    setVerifyResult(null);
    try {
      const res = await base44.functions.invoke('verify-federation', {});
      const data = res?.data || res;
      setVerifyResult(data);
      toast({
        title: data.ok ? 'Federation verified' : 'Verification incomplete',
        description: data.ok
          ? `Handle @${data.handle} resolves and ${data.postsOnPds} posts found on the PDS.`
          : 'Handle not yet resolvable and no posts found — allow time for propagation, then re-run.',
        variant: data.ok ? 'default' : 'destructive',
      });
    } catch (err) {
      toast({ title: 'Verification failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setStep(null);
    }
  };

  const StepButton = ({ id, label, icon: Icon, onClick, done }) => (
    <button
      onClick={onClick}
      disabled={step !== null}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {step === id ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      {step === id ? 'Running…' : label}
    </button>
  );

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-base">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <ServerCog className="h-4 w-4 text-primary" />
        PDS Cutover — Switch to Self-Hosted PDS
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Runs the full migration to your new self-hosted PDS. Complete the prerequisites below first, then run each step in order.
      </p>

      <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Prerequisites (do these before running)
        </p>
        <ul className="ml-5 list-disc space-y-0.5">
          <li>Create a shared bridge account on the new PDS (the one <code className="font-mono">PDS_IDENTIFIER</code> authenticates).</li>
          <li>Set <code className="font-mono">PDS_INVITE_REQUIRED=false</code> on the new PDS (or pre-generate invite codes).</li>
          <li>Point <code className="font-mono">*.swappulse.org</code> DNS at the new PDS so handles resolve.</li>
          <li><em>Optional:</em> set <code className="font-mono">OLD_PDS_URL</code> / <code className="font-mono">OLD_PDS_IDENTIFIER</code> / <code className="font-mono">OLD_PDS_APP_PASSWORD</code> to the <strong>old</strong> PDS values so step 2 can delete old records. If unset, old records are orphaned (not deleted) — that's safe.</li>
          <li>Then update <code className="font-mono">PDS_URL</code> / <code className="font-mono">PDS_IDENTIFIER</code> / <code className="font-mono">PDS_APP_PASSWORD</code> / <code className="font-mono">PDS_ADMIN_PASSWORD</code> to the new PDS.</li>
        </ul>
      </div>

      <div className="space-y-3">
        {/* Step 1 */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
            Provision all identities on the new PDS
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Re-provisions every user (including simulated-DID and bsky.social-linked users) with a real did:plc + username.swappulse.org handle. Re-run until failed is 0.
          </p>
          <StepButton id="provision" label="Provision Identities" icon={ServerCog} onClick={runProvision} done={!!provisionResult && !(provisionResult.failed > 0)} />
          {provisionResult && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-secondary p-2 text-center"><p className="font-bold text-primary">{provisionResult.provisioned || 0}</p><p className="text-xs text-muted-foreground">Provisioned</p></div>
              <div className="rounded-lg bg-secondary p-2 text-center"><p className="font-bold">{provisionResult.skipped || 0}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
              <div className="rounded-lg bg-secondary p-2 text-center"><p className={`font-bold ${provisionResult.failed > 0 ? 'text-destructive' : ''}`}>{provisionResult.failed || 0}</p><p className="text-xs text-muted-foreground">Failed</p></div>
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
            Migrate & re-bridge content
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Re-creates each user's posts, reposts, likes, and follows on the new PDS under their new DID, then deletes old records from the old PDS. Processes 25 users per run — re-run until rebridged stops increasing.
          </p>
          <StepButton id="migrate" label="Migrate Content" icon={RefreshCw} onClick={runMigrate} done={!!migrateResult} />
          {migrateResult && (
            <div className="mt-2 text-xs">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-secondary p-2 text-center"><p className="font-bold text-primary">{migrateResult.rebridged || 0}</p><p className="text-xs text-muted-foreground">Records re-bridged</p></div>
                <div className="rounded-lg bg-secondary p-2 text-center"><p className="font-bold">{migrateResult.users || 0}</p><p className="text-xs text-muted-foreground">Users processed</p></div>
                <div className="rounded-lg bg-secondary p-2 text-center"><p className={`font-bold ${migrateResult.oldPdsConnected ? 'text-success' : 'text-warning'}`}>{migrateResult.oldPdsConnected ? 'Yes' : 'No'}</p><p className="text-xs text-muted-foreground">Old PDS cleanup</p></div>
              </div>
              {!migrateResult.oldPdsConnected && (
                <p className="mt-1.5 text-warning">OLD_PDS_* secrets not set — old records were orphaned, not deleted.</p>
              )}
            </div>
          )}
        </div>

        {/* Step 3 */}
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
            Verify federation
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Checks that a provisioned user's handle resolves on the federated network and their posts are present on the new PDS. Handles can take a few minutes to propagate — re-run if it fails initially.
          </p>
          <StepButton id="verify" label="Verify Federation" icon={CheckCircle2} onClick={runVerify} done={!!verifyResult?.ok} />
          {verifyResult && (
            <div className="mt-2 rounded-lg bg-secondary p-2 text-xs">
              <p className="font-mono text-foreground">{verifyResult.handle ? `@${verifyResult.handle}` : '(no handle)'}</p>
              <p className="text-muted-foreground">Handle resolves: {verifyResult.handleResolved ? '✅ Yes' : '❌ Not yet'}</p>
              <p className="text-muted-foreground">Posts on PDS: {verifyResult.postsOnPds ?? 0}</p>
              <p className="truncate text-muted-foreground">DID: {verifyResult.did}</p>
            </div>
          )}
        </div>
      </div>

      {/* PDS Blob Storage status */}
      <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Database className="h-3.5 w-3.5 text-primary" /> PDS Blob Storage
          </p>
          <button onClick={loadBlobStats} disabled={blobLoading} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
            {blobLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
          </button>
        </div>
        {blobStats ? (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-background p-1.5"><p className="font-bold text-primary">{blobStats.pds || 0}</p><p className="text-muted-foreground">PDS-backed</p></div>
            <div className="rounded-lg bg-background p-1.5"><p className="font-bold">{blobStats.external || 0}</p><p className="text-muted-foreground">External</p></div>
            <div className="rounded-lg bg-background p-1.5"><p className="font-bold">{blobStats.total || 0}</p><p className="text-muted-foreground">Total media</p></div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{blobLoading ? 'Loading…' : 'No blob data yet — run a scan to populate.'}</p>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">New uploads are stored as PDS blobs (portable & federated); legacy media stays on external storage until re-uploaded.</p>
      </div>

      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
        After verification passes, the firehose-ingest workflow will automatically pull remote records from the new PDS on its next run.
      </p>
    </section>
  );
}