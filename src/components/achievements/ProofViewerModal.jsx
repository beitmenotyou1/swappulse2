import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ShieldCheck, ShieldAlert, FileText, Clock, ExternalLink, Copy, Download } from 'lucide-react';
import { buildAttestation, downloadAttestation } from '@/lib/achievementAttestation';

export default function ProofViewerModal({ spec, achievement, onClose }) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const open = !!spec;
  const revoked = achievement?.status === 'revoked';
  const meta = achievement?.metadata || {};
  const proofUris = meta.proofUris || [];
  const lastEval = meta.lastEvaluatedAt;

  const copyUri = async (u) => {
    try {
      await navigator.clipboard.writeText(u);
      toast({ title: 'AT URI copied', description: u });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  const exportProof = async () => {
    setExporting(true);
    try {
      const credential = await buildAttestation(spec, achievement, achievement?.did);
      downloadAttestation(credential, `swappulse-${spec.key}.jsonld`);
      toast({ title: 'Proof exported', description: 'Signed JSON-LD attestation downloaded.' });
    } catch (e) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <spec.icon className={`h-5 w-5 ${revoked ? 'text-muted-foreground' : 'text-accent'}`} />
            {spec?.label}
          </DialogTitle>
          <DialogDescription>{spec?.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {revoked ? (
              <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                <ShieldAlert className="h-3 w-3" /> Revoked
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-success/40 text-success">
                <ShieldCheck className="h-3 w-3" /> Granted
              </Badge>
            )}
            {typeof meta.metricValue === 'number' && (
              <Badge variant="secondary">Metric: {meta.metricValue}</Badge>
            )}
          </div>

          {meta.proofSummary && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              {meta.proofSummary}
            </div>
          )}

          {proofUris.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Constituent records
              </p>
              <ul className="space-y-1.5">
                {proofUris.map((u, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => copyUri(u)}
                      title="Copy AT URI"
                      className="group flex w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="truncate font-mono text-xs text-muted-foreground group-hover:text-foreground" title={u}>
                        {u}
                      </span>
                      <Copy className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
                {proofUris.length < (meta.metricValue || proofUris.length) && (
                  <li className="px-1 text-xs italic text-muted-foreground">
                    …and {(meta.metricValue || 0) - proofUris.length} more
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {achievement?.unlocked_at && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Unlocked {new Date(achievement.unlocked_at).toLocaleString()}
              </span>
            )}
            {revoked && achievement?.revoked_at && (
              <span className="flex items-center gap-1.5 text-destructive">
                <ShieldAlert className="h-3 w-3" /> Revoked {new Date(achievement.revoked_at).toLocaleString()}
              </span>
            )}
            {lastEval && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Last verified {new Date(lastEval).toLocaleString()}
              </span>
            )}
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={exportProof} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? 'Generating…' : 'Export proof (JSON-LD)'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}