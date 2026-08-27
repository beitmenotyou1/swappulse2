import React from 'react';
import { CheckCircle2, XCircle, Clock, HelpCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/I18nProvider';

// Reusable status badge for blockchain transactions.
// success = green, failed = red, pending = yellow, unknown = gray.
export default function StatusBadge({ status }) {
  const t = useT();
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> {t('explorer.success')}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
        <XCircle className="h-3.5 w-3.5" /> {t('explorer.failed')}
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
        <Clock className="h-3.5 w-3.5 animate-pulse" /> {t('explorer.pending')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      <HelpCircle className="h-3.5 w-3.5" /> {t('explorer.unknown')}
    </span>
  );
}