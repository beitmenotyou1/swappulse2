import React, { useState } from 'react';
import { Download, Globe, Loader2, ArrowRightLeft, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function AtProtoSection({ settings, update }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [newPdsUrl, setNewPdsUrl] = useState('');

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('export-repo', {});
      if (res?.data) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `swappulse-repo-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast({
          title: 'Repository exported',
          description: `${res.data.totalRecords || 0} records downloaded as an AT Protocol-compatible archive.`,
        });
      }
    } catch (e) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleMigrate = async () => {
    if (!newPdsUrl.trim()) return;
    if (!newPdsUrl.startsWith('https://')) {
      toast({ title: 'Invalid URL', description: 'PDS URL must start with https://', variant: 'destructive' });
      return;
    }
    setMigrating(true);
    try {
      const res = await base44.functions.invoke('migrate-pds', { newPdsUrl: newPdsUrl.trim() });
      if (res?.data?.ok) {
        toast({
          title: 'Repository migrated',
          description: res.data.message || 'Your repo has been transferred to the new PDS.',
        });
        setNewPdsUrl('');
      } else {
        throw new Error(res?.data?.error || 'Migration failed');
      }
    } catch (e) {
      toast({ title: 'Migration failed', description: e.message, variant: 'destructive' });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Download className="h-4 w-4 text-primary" /> Repository Export
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Download your full SwapPulse data as an AT Protocol-compatible repository archive.
          Includes all your posts, collection entries, trade listings, follows, achievements,
          and more — portable to any compatible PDS.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? 'Exporting...' : 'Export Repository'}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <ArrowRightLeft className="h-4 w-4 text-primary" /> PDS Migration
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Move your repository to a different AT Protocol PDS host. This transfers all your
          records to the new PDS. You'll need to update your PLC directory entry separately
          to complete the migration.
        </p>
        <input
          type="url"
          value={newPdsUrl}
          onChange={(e) => setNewPdsUrl(e.target.value)}
          placeholder="https://your-new-pds.example.com"
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={handleMigrate}
          disabled={migrating || !newPdsUrl.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
        >
          {migrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
          {migrating ? 'Migrating...' : 'Migrate to New PDS'}
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-border p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Info className="h-4 w-4" /> Federation Status
        </p>
        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <Globe className="h-3 w-3" />
            Feed Generator: <span className="font-medium text-foreground">did:web:feed.swappulse.org</span>
          </p>
          <p>• Active Trade Listings feed — public</p>
          <p>• Collection Posts feed — public</p>
          <p>• Who to Follow feed — personalized</p>
          <p className="mt-1.5">Labeler: <span className="font-medium text-foreground">did:web:labeler.swappulse.org</span></p>
          <p>Bridge: Session auto-refresh enabled</p>
          <p>PDS Sync: Every 5 minutes (scheduled polling)</p>
        </div>
      </div>
    </div>
  );
}