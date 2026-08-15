import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Activity, RefreshCw, Globe, CheckCircle2, AlertTriangle, XCircle, MinusCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const STATUS_META = {
  ok: { label: 'OK', chip: 'bg-success/15 text-success', Icon: CheckCircle2 },
  handle_mismatch: { label: 'Handle mismatch', chip: 'bg-warning/15 text-warning', Icon: AlertTriangle },
  not_in_plc: { label: 'Not in public PLC', chip: 'bg-destructive/15 text-destructive', Icon: XCircle },
  no_pds_account: { label: 'No PDS account', chip: 'bg-destructive/15 text-destructive', Icon: XCircle },
  no_credential: { label: 'No credential', chip: 'bg-secondary text-muted-foreground', Icon: MinusCircle },
};

export default function FederationDiagnosticsSection() {
  const [running, setRunning] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [report, setReport] = useState(null);
  const [crawl, setCrawl] = useState(null);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setRunning(true);
    setReport(null);
    try {
      const res = await base44.functions.invoke('federation-diagnostics', {});
      const data = res?.data || res;
      setReport(data);
      toast({ title: 'Diagnostics complete', description: `${data.total || 0} accounts checked` });
    } catch (err) {
      toast({ title: 'Diagnostics failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const runCrawl = async () => {
    setCrawling(true);
    setCrawl(null);
    try {
      const res = await base44.functions.invoke('request-appview-crawl', {});
      const data = res?.data || res;
      setCrawl(data);
      toast({ title: 'Crawl request complete', description: `${data.indexed || 0}/${data.total || 0} indexed by bsky.app` });
    } catch (err) {
      toast({ title: 'Crawl request failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setCrawling(false);
    }
  };

  const counts = report?.report?.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}) || {};

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-base">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <Activity className="h-4 w-4 text-primary" />
        Federation Diagnostics
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Checks every provisioned account against the PDS, the public plc.directory, and
        handle resolution — so you can see exactly what blocks discoverability on bsky.app.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={runDiagnostics}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {running ? 'Running…' : 'Run diagnostics'}
        </button>
        <button
          onClick={runCrawl}
          disabled={crawling}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-bold transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {crawling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          {crawling ? 'Requesting…' : 'Request AppView crawl'}
        </button>
      </div>

      {report && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <span key={key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
                <meta.Icon className="h-3 w-3" />
                {meta.label}: {counts[key] || 0}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Account</th>
                  <th className="px-3 py-2 font-semibold">Handle</th>
                  <th className="px-3 py-2 font-semibold">DID</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.report.map((r) => {
                  const meta = STATUS_META[r.status] || STATUS_META.no_credential;
                  return (
                    <tr key={r.userId} className="border-t border-border">
                      <td className="px-3 py-2">{r.username || r.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.handle || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {r.did ? `${r.did.slice(0, 18)}…` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
                          <meta.Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {crawl && (
        <div className="mt-3 rounded-lg bg-secondary p-3 text-sm">
          <p className="font-semibold">AppView indexing: {crawl.indexed}/{crawl.total} accounts</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Accounts not indexed won't appear on bsky.app until their DID is in the public
            plc.directory and their handle resolves — run diagnostics to check.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm">
        <p className="mb-1 font-semibold">Stage 2 — server-side steps (you control the PDS &amp; DNS)</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Reconfigure the PDS to use the public <code className="font-mono text-xs">plc.directory</code> URL.</li>
          <li>Re-provision existing accounts so fresh DIDs are published to the public directory (use "Provision Federated Identities" above after clearing stale credentials).</li>
          <li>Add a wildcard <code className="font-mono text-xs">*.swappulse.org</code> DNS record → PDS so <code className="font-mono text-xs">/.well-known/atproto-did</code> resolves each handle.</li>
          <li>Run "Request AppView crawl" so bsky.app indexes the repos.</li>
        </ol>
      </div>
    </section>
  );
}