import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import AchievementBadge from './AchievementBadge';
import ProofList from './ProofList';
import ExportProofButton from './ExportProofButton';
import { useFirehoseExplorer } from '@/hooks/useFirehoseExplorer';
import { ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

export default function ProofViewerModal({ spec, achievement, onClose }) {
  const { generateVerifierLink } = useFirehoseExplorer();
  const open = !!spec;
  const revoked = achievement?.status === 'revoked';
  const pending = !revoked && !!achievement?.pending_revocation_at;
  const meta = achievement?.metadata || {};
  const proofRecords = meta.proofRecords || [];
  const lastEval = meta.lastEvaluatedAt;
  const userDid = achievement?.did;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {spec && <AchievementBadge spec={spec} size="large" unlocked={!revoked} revoked={revoked} hoverable={false} />}
            <span>{spec?.name}</span>
          </DialogTitle>
          <DialogDescription>{spec?.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {revoked ? (
              <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
                <ShieldAlert className="h-3 w-3" /> Revoked
              </Badge>
            ) : pending ? (
              <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                <ShieldAlert className="h-3 w-3" /> Pending revocation
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 border-success/40 text-success">
                <ShieldCheck className="h-3 w-3" /> Active
              </Badge>
            )}
            {typeof meta.metricValue === 'number' && (
              <Badge variant="secondary">Metric: {meta.metricValue}</Badge>
            )}
            {spec?.tier && <Badge variant="outline" className="capitalize">{spec.tier}</Badge>}
          </div>

          {revoked && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              This achievement has been revoked — the eligibility proof no longer holds.
            </div>
          )}
          {pending && (
            <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
              Eligibility is at risk. The badge will be revoked after the grace period if the proof is not restored.
            </div>
          )}

          {meta.proofSummary && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">{meta.proofSummary}</div>
          )}

          <ProofList records={proofRecords} generateVerifierLink={generateVerifierLink} />

          <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {achievement?.unlocked_at && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Earned {new Date(achievement.unlocked_at).toLocaleString()}
              </span>
            )}
            {lastEval && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Last verified {new Date(lastEval).toLocaleString()}
              </span>
            )}
          </div>

          <ExportProofButton spec={spec} achievement={achievement} userDid={userDid} />
        </div>
      </DialogContent>
    </Dialog>
  );
}