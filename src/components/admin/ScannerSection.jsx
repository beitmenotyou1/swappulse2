import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Download, Sparkles, RefreshCw, GraduationCap } from 'lucide-react';

export default function ScannerSection() {
  const [report, setReport] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [rep, snaps] = await Promise.all([
        base44.functions.invoke('scannerTrainingReport', {}),
        base44.entities.ScannerTrainingSnapshot.list('-generated_at', 5).catch(() => []),
      ]);
      setReport(rep.data);
      setSnapshots(snaps.data ?? snaps ?? []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load scanner report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const buildSnapshot = async () => {
    setBuilding(true);
    setError('');
    try {
      await base44.functions.invoke('build-training-snapshot', {});
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to build snapshot');
    } finally {
      setBuilding(false);
    }
  };

  const downloadSnapshot = async (s) => {
    setDownloading(s.id);
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: s.file_uri });
      const url = res?.signed_url || res?.data?.signed_url;
      if (url) window.open(url, '_blank');
    } catch (e) {
      setError(e.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading scanner report…
        </CardContent>
      </Card>
    );
  }

  const accuracyPct = report ? Math.round((report.accuracy_estimate || 0) * 100) : 0;
  const rarityEntries = report?.rarity_breakdown ? Object.entries(report.rarity_breakdown) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Scanner Learning Loop</CardTitle>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Top-line metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Model version" value={report?.model_version || '-'} />
          <Metric label="Accuracy" value={`${accuracyPct}%`} />
          <Metric label="Corrections" value={report?.total_corrections ?? 0} />
          <Metric
            label="Catalog synced"
            value={report?.catalog_last_synced ? new Date(report.catalog_last_synced).toLocaleDateString() : 'Pending'}
            sub={report?.catalog_last_synced ? `${report.catalog_lang} · ${report.catalog_sets_synced ?? 0} sets` : 'Run sync to populate'}
          />
        </div>

        {/* Retrain candidate */}
        {report?.new_version_candidate && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <Sparkles className="h-4 w-4 text-warning" />
            <span className="font-medium">Retraining threshold reached</span>
            <span className="text-muted-foreground">
              {report.corrections_since_snapshot} new corrections since the last snapshot — build a training dataset and retrain.
            </span>
          </div>
        )}

        {/* Rarity breakdown */}
        {rarityEntries.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Accuracy by rarity</p>
            <div className="flex flex-wrap gap-2">
              {rarityEntries.map(([rarity, counts]) => {
                const total = (counts.correct || 0) + (counts.wrong || 0);
                const pct = total > 0 ? Math.round(((counts.correct || 0) / total) * 100) : 0;
                return (
                  <Badge key={rarity} variant="outline" className="gap-1">
                    {rarity}: {pct}% ({total})
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Build + snapshots */}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={buildSnapshot} disabled={building}>
            {building ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Database className="mr-1.5 h-4 w-4" />}
            Build training dataset
          </Button>
          {report?.last_snapshot_version && (
            <span className="text-xs text-muted-foreground">
              Last snapshot: {report.last_snapshot_version}
            </span>
          )}
        </div>

        {snapshots.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Recent snapshots</p>
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.version_tag}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.row_count} rows · {new Date(s.generated_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadSnapshot(s)}
                  disabled={downloading === s.id}
                >
                  {downloading === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* LLM insights */}
        {report?.insights && (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Improvement insights</summary>
            <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{report.insights}</p>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-bold">{value}</p>
      {sub && <p className="truncate text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}