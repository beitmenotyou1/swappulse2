import React from 'react';
import { CheckCircle2, XCircle, Clock, HelpCircle, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';

// Reusable status badge for blockchain transactions.
// success = green, failed = red, pending = amber (animated spinner), unknown = gray.
// Bold filled style for instant scannability in transaction lists.
export default function StatusBadge({ status }) {
  const t = useT();
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-success-foreground">
          <CheckCircle2 className="h-3 w-3" />
        </span>
        {t('explorer.success')}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/15 px-2.5 py-1 text-xs font-bold text-destructive">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
          <XCircle className="h-3 w-3" />
        </span>
        {t('explorer.failed')}
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-xs font-bold text-warning animate-pulse">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-warning text-warning-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
        </span>
        {t('explorer.pending')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground text-background">
        <HelpCircle className="h-3 w-3" />
      </span>
      {t('explorer.unknown')}
    </span>
  );
}