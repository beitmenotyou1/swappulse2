import React, { useState } from 'react';
import { Download, Loader2, ArrowRightLeft, Upload, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import BlueskyLinkCard from '@/components/settings/BlueskyLinkCard';
import SyncDashboard from '@/components/settings/SyncDashboard';

export default function AtProtoSection({ settings, update }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const importRef = React.useRef(null);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress('Reading archive…');
    try {
      const text = await file.text();
      const archive = JSON.parse(text);
      setImportProgress('Re-creating records on PDS…');
      const res = await base44.functions.invoke('import-repo', { archive });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Repository imported',
        description: `${data.created || 0} records re-created on the PDS, ${data.upserted || 0} local entries restored.`,
      });
    } catch (err) {
      toast({ title: 'Import failed', description: err?.message || 'Invalid archive', variant: 'destructive' });
    } finally {
      setImporting(false);
      setImportProgress('');
      if (importRef.current) importRef.current.value = '';
    }
  };

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

  return (
    <div className="space-y-4">
      <BlueskyLinkCard />

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Download className="h-4 w-4 text-primary" /> Repository Export
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Download your full SwapPulse data as an AT Protocol-compatible repository archive.
          Includes all your posts, collection entries, trade listings, follows, achievements,
          and more, portable to any compatible PDS.
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
          <Upload className="h-4 w-4 text-primary" /> Repository Import
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Restore a previously exported SwapPulse archive onto this PDS under your federated identity.
          Re-creates your records on the PDS and restores local entries. Requires a linked PDS account (did:plc).
        </p>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => importRef.current?.click()}
          disabled={importing}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {importing ? (importProgress || 'Importing…') : 'Import Repository'}
        </button>
      </div>

      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <ShieldAlert className="h-4 w-4 text-warning" /> PDS Migration Temporarily Unavailable
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Repository migration is paused while SwapPulse replaces the legacy transfer flow with a standards-correct process that authenticates independently to the destination PDS and updates DID/PLC state safely. Export and import remain available above.
        </p>
      </div>

      <SyncDashboard />
    </div>
  );
}